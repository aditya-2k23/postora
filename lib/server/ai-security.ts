import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";

export type AiEndpoint =
  | "generate-content"
  | "assistant-chat"
  | "generate-image"
  | "upload-image";

const COUNTER_FIELD_BY_ENDPOINT: Record<AiEndpoint, string> = {
  "generate-content": "generateContentCount",
  "assistant-chat": "assistantChatCount",
  "generate-image": "generateImageCount",
  "upload-image": "uploadImageCount",
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DAILY_LIMITS: Record<AiEndpoint, number> = {
  "generate-content": parsePositiveInteger(
    process.env.AI_DAILY_LIMIT_GENERATE_CONTENT,
    25,
  ),
  "assistant-chat": parsePositiveInteger(
    process.env.AI_DAILY_LIMIT_ASSISTANT_CHAT,
    80,
  ),
  "generate-image": parsePositiveInteger(
    process.env.AI_DAILY_LIMIT_GENERATE_IMAGE,
    40,
  ),
  "upload-image": parsePositiveInteger(
    process.env.AI_DAILY_LIMIT_UPLOAD_IMAGE,
    60,
  ),
};

const RATE_LIMITS_PER_MINUTE: Record<AiEndpoint, number> = {
  "generate-content": parsePositiveInteger(
    process.env.AI_RATE_LIMIT_GENERATE_CONTENT_PER_MINUTE,
    12,
  ),
  "assistant-chat": parsePositiveInteger(
    process.env.AI_RATE_LIMIT_ASSISTANT_CHAT_PER_MINUTE,
    20,
  ),
  "generate-image": parsePositiveInteger(
    process.env.AI_RATE_LIMIT_GENERATE_IMAGE_PER_MINUTE,
    16,
  ),
  "upload-image": parsePositiveInteger(
    process.env.AI_RATE_LIMIT_UPLOAD_IMAGE_PER_MINUTE,
    30,
  ),
};

const RATE_WINDOW_MS = 60_000;
const MAX_RATE_BUCKETS = 3_000;
const ipHashSalt = process.env.AI_USAGE_IP_HASH_SALT || "local-dev-ip-salt";

type RateBucket = {
  count: number;
  windowStart: number;
};

const rateBuckets = new Map<string, RateBucket>();

export class ValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ValidationError";
    this.status = status;
  }
}

export class RateLimitError extends Error {
  status: number;
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class QuotaExceededError extends Error {
  status: number;
  endpoint: AiEndpoint;
  used: number;
  limit: number;

  constructor(endpoint: AiEndpoint, used: number, limit: number) {
    super(
      `Daily quota exceeded for ${endpoint}. Limit: ${limit} requests per day.`,
    );
    this.name = "QuotaExceededError";
    this.status = 429;
    this.endpoint = endpoint;
    this.used = used;
    this.limit = limit;
  }
}

const getUtcDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const compactError = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.slice(0, 300);
  }
  return String(error).slice(0, 300);
};

const readClientIp = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((item) => item.trim())
      .find(Boolean);
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  const cloudflareIp = req.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp;

  return "unknown";
};

const cleanupRateBuckets = (now: number) => {
  if (rateBuckets.size <= MAX_RATE_BUCKETS) return;

  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.windowStart > RATE_WINDOW_MS * 5) {
      rateBuckets.delete(key);
    }
  }
};

const hashValue = (value: string) =>
  createHash("sha256").update(`${ipHashSalt}:${value}`).digest("hex");

export const getRequestIpHash = (req: Request) => hashValue(readClientIp(req));

export const enforceIpRateLimit = (req: Request, endpoint: AiEndpoint) => {
  const now = Date.now();
  const ip = readClientIp(req);
  const key = `${endpoint}:${ip}`;
  const limit = RATE_LIMITS_PER_MINUTE[endpoint];
  const existing = rateBuckets.get(key);

  if (!existing || now - existing.windowStart >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    cleanupRateBuckets(now);
    return;
  }

  if (existing.count >= limit) {
    const remainingMs = Math.max(
      0,
      RATE_WINDOW_MS - (now - existing.windowStart),
    );
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1_000));

    throw new RateLimitError(
      `Too many requests from this IP for ${endpoint}. Try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    );
  }

  existing.count += 1;
  rateBuckets.set(key, existing);
};

const getUsageDocPath = (uid: string, dateKey: string) =>
  `users/${uid}/aiUsageDaily/${dateKey}`;

export const assertDailyQuotaAvailable = async (
  uid: string,
  endpoint: AiEndpoint,
) => {
  if (process.env.ENFORCE_QUOTAS === "false") {
    const limit = DAILY_LIMITS[endpoint] || 1000;
    return { used: 0, limit, remaining: limit };
  }

  const db = getFirebaseAdminDb();
  const dateKey = getUtcDateKey();
  const usageDocRef = db.doc(getUsageDocPath(uid, dateKey));
  const usageSnap = await usageDocRef.get();

  const field = COUNTER_FIELD_BY_ENDPOINT[endpoint];
  const used = usageSnap.exists ? Number(usageSnap.get(field) ?? 0) : 0;
  const limit = DAILY_LIMITS[endpoint];

  if (used >= limit) {
    throw new QuotaExceededError(endpoint, used, limit);
  }

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
};

export const consumeDailyQuota = async (uid: string, endpoint: AiEndpoint) => {
  if (process.env.ENFORCE_QUOTAS === "false") {
    const limit = DAILY_LIMITS[endpoint] || 1000;
    return { used: 0, limit, remaining: limit };
  }

  const db = getFirebaseAdminDb();
  const dateKey = getUtcDateKey();
  const usageDocRef = db.doc(getUsageDocPath(uid, dateKey));
  const field = COUNTER_FIELD_BY_ENDPOINT[endpoint];
  const limit = DAILY_LIMITS[endpoint];

  let nextUsed = 0;

  await db.runTransaction(async (transaction) => {
    const usageSnap = await transaction.get(usageDocRef);
    const used = usageSnap.exists ? Number(usageSnap.get(field) ?? 0) : 0;

    if (used >= limit) {
      throw new QuotaExceededError(endpoint, used, limit);
    }

    nextUsed = used + 1;

    const payload: Record<string, unknown> = {
      userId: uid,
      date: dateKey,
      [field]: FieldValue.increment(1),
      totalCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!usageSnap.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
    }

    transaction.set(usageDocRef, payload, { merge: true });
  });

  return {
    used: nextUsed,
    limit,
    remaining: Math.max(0, limit - nextUsed),
  };
};

type AiUsageEventParams = {
  uid: string;
  endpoint: AiEndpoint;
  success: boolean;
  requestId?: string;
  inputChars?: number;
  outputChars?: number;
  model?: string;
  ipHash?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

export const recordAiUsageEvent = async ({
  uid,
  endpoint,
  success,
  requestId,
  inputChars,
  outputChars,
  model,
  ipHash,
  error,
  metadata,
}: AiUsageEventParams) => {
  try {
    const db = getFirebaseAdminDb();
    const eventsRef = db.collection(`users/${uid}/aiEvents`);
    const safeMetadata = metadata
      ? JSON.parse(JSON.stringify(metadata))
      : undefined;

    await eventsRef.add({
      endpoint,
      date: getUtcDateKey(),
      success,
      requestId: requestId || null,
      inputChars: Number.isFinite(inputChars) ? inputChars : null,
      outputChars: Number.isFinite(outputChars) ? outputChars : null,
      model: model || null,
      ipHash: ipHash || null,
      error: error ? error.slice(0, 300) : null,
      metadata: safeMetadata || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Non-fatal: failed telemetry should not break user-facing generation flow.
    console.warn(
      "[ai-security] Failed to record AI usage event:",
      compactError(error),
    );
  }
};

export const toAiSecurityErrorResponse = (error: unknown) => {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { error: error.message, errorType: "RateLimitExceeded" },
      {
        status: error.status,
        headers: {
          "Retry-After": String(error.retryAfterSeconds),
        },
      },
    );
  }

  if (error instanceof QuotaExceededError) {
    return NextResponse.json(
      {
        error: error.message,
        errorType: "QuotaExceeded",
        endpoint: error.endpoint,
        used: error.used,
        limit: error.limit,
      },
      { status: error.status },
    );
  }

  return null;
};
