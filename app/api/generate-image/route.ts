import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";
import {
  assertDailyQuotaAvailable,
  consumeDailyQuota,
  enforceIpRateLimit,
  QuotaExceededError,
  recordAiUsageEvent,
  refundDailyQuota,
  toAiSecurityErrorResponse,
  ValidationError,
} from "@/lib/server/ai-security";
import { ALLOWED_ASPECT_RATIOS } from "@/lib/constants";

// ─── Cloudinary setup
(function validateAndConfigureCloudinary() {
  const missing = (
    [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ] as const
  ).filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const msg = `[generate-image] Cloudinary misconfiguration — missing env vars: ${missing.join(", ")}. Image uploads will fail.`;
    console.error(msg);
    // Throw during module init in production so the server surfaces the problem
    // immediately rather than hiding it inside the first request.
    if (process.env.NODE_ENV === "production") throw new Error(msg);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
})();

async function uploadToCloudinary(
  blobArrayBuffer: ArrayBuffer,
  uid: string,
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials are not configured (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).",
    );
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: `postora_images/${uid}` },
      (error, result) => {
        if (error) reject(error);
        else if (result) resolve(result.secure_url);
        else reject(new Error("Unknown cloudinary upload error"));
      },
    );
    uploadStream.end(Buffer.from(blobArrayBuffer));
  });
}

// ─── Image models ─────────────────────────────────────────────────────────────
const HUGGING_FACE_IMAGE_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "black-forest-labs/FLUX.1-dev",
  "stabilityai/sdxl-turbo",
];

function getHuggingFaceToken(): string {
  return (
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACEHUB_API_TOKEN ||
    process.env.HF_API_TOKEN ||
    ""
  )
    .replace(/['"]/g, "")
    .trim();
}

type ImagePayload = {
  prompt: string;
  aspectRatio: string;
  style: string;
  projectId: string;
  cardId: string;
};

function validateImagePayload(payload: unknown): ImagePayload {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid request payload.");
  }

  const raw = payload as Record<string, unknown>;
  const prompt = raw.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new ValidationError("Image prompt is required.");
  }

  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length > 1_200) {
    throw new ValidationError(
      "Image prompt is too long. Max length is 1200 characters.",
    );
  }

  const aspectRatio =
    typeof raw.aspectRatio === "string" && raw.aspectRatio.trim()
      ? raw.aspectRatio.trim()
      : "4:5";
  if (!ALLOWED_ASPECT_RATIOS.includes(aspectRatio as any)) {
    throw new ValidationError(
      `Invalid aspect ratio. Allowed values: ${ALLOWED_ASPECT_RATIOS.join(", ")}`,
    );
  }

  const style = typeof raw.style === "string" ? raw.style.trim() : "minimal";
  if (style.length > 50) {
    throw new ValidationError("Style name is too long.");
  }

  const projectId =
    typeof raw.projectId === "string" ? raw.projectId.trim() : "";
  const cardId = typeof raw.cardId === "string" ? raw.cardId.trim() : "";

  if (projectId.length > 64) throw new ValidationError("Invalid Project ID.");
  if (cardId.length > 64) throw new ValidationError("Invalid Card ID.");

  return {
    prompt: normalizedPrompt,
    aspectRatio,
    style,
    projectId,
    cardId,
  };
}

async function generateWithHuggingFace(
  prompt: string,
  hfKey: string,
): Promise<{ buffer: ArrayBuffer; model: string } | null> {
  const client = new InferenceClient(hfKey);

  for (const model of HUGGING_FACE_IMAGE_MODELS) {
    try {
      const imageBlob = await client.textToImage(
        {
          model,
          inputs: prompt,
          provider: "auto",
        },
        {
          outputType: "blob",
        },
      );

      const blob = await imageBlob.arrayBuffer();

      if (!blob || blob.byteLength === 0) {
        console.warn(
          `[generate-image] Hugging Face ${model} returned empty image data`,
        );
        continue;
      }

      return {
        buffer: blob,
        model,
      };
    } catch (error: any) {
      console.warn(
        `[generate-image] Hugging Face ${model} failed:`,
        error?.message?.substring(0, 240) ?? error,
      );
    }
  }

  return null;
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let uid = "";
  let promptLength = 0;
  let selectedModel = "";
  let idempotencyKey: string | null = null;
  let idempotencyClaimed = false;

  const rawIdempotencyKey = req.headers.get("x-idempotency-key");
  if (rawIdempotencyKey) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawIdempotencyKey)) {
      return NextResponse.json(
        { error: "Invalid idempotency key format." },
        { status: 400 },
      );
    }
    idempotencyKey = rawIdempotencyKey;
  }

  try {
    const decodedToken = await requireAuthenticatedUser(req);
    uid = decodedToken.uid;

    enforceIpRateLimit(req, "generate-image");

    const { prompt, aspectRatio, style, projectId, cardId } =
      validateImagePayload(await req.json());
    promptLength = prompt.length;

    const db = getFirebaseAdminDb();

    if (idempotencyKey) {
      const idKeyRef = db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`);
      const IDEMPOTENCY_STALE_MS = 120_000; // 2 minutes

      const idempotencyResult = await db.runTransaction(async (transaction) => {
        const idSnap = await transaction.get(idKeyRef);
        if (idSnap.exists) {
          const data = idSnap.data();
          const status = data?.status;
          const createdAt = data?.createdAt?.toMillis?.() || 0;
          const now = Date.now();
          const isStale =
            status === "pending" && now - createdAt > IDEMPOTENCY_STALE_MS;

          if (status === "completed") {
            return { exists: true, data };
          }
          if (status === "pending" && !isStale) {
            return { exists: true, data };
          }
        }

        transaction.set(idKeyRef, {
          status: "pending",
          projectId,
          cardId,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { exists: false };
      });

      if (!idempotencyResult.exists) {
        // We successfully claimed the pending slot
        idempotencyClaimed = true;
      }

      if (idempotencyResult.exists) {
        const idData = idempotencyResult.data;
        if (idData?.status === "completed" && idData?.secureUrl) {
          return NextResponse.json({
            imageUrl: idData.secureUrl,
            quotaRemaining: idData.quotaRemaining || 0,
            idempotent: true,
          });
        }
        return NextResponse.json(
          {
            status: "processing",
            message:
              "A request with this key is already in progress. Please wait.",
            retry_after: 5,
          },
          { status: 202 },
        );
      }
    }

    const promptHash = createHash("sha256")
      .update(`${prompt}|${aspectRatio}|${style}`)
      .digest("hex");

    const cacheRef = db.doc(`users/${uid}/generatedImagesCache/${promptHash}`);

    const cacheResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(cacheRef);
      if (snap.exists) {
        const data = snap.data();
        if (data?.status === "completed" && data?.secureUrl) {
          return { hit: true, data };
        }
        const createdAtMillis = data?.createdAt?.toMillis?.() || 0;
        const isStale =
          data?.status === "pending" && Date.now() - createdAtMillis > 120_000;

        if (data?.status === "pending" && !isStale) {
          return { pending: true };
        }
      }

      transaction.set(
        cacheRef,
        {
          status: "pending",
          prompt,
          aspectRatio,
          style,
          promptHash,
          uid,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { miss: true };
    });

    let secureUrl = "";
    let quotaRemaining = 0;

    if (cacheResult.hit) {
      secureUrl = cacheResult.data!.secureUrl;
      selectedModel = cacheResult.data!.providerModel || "cache";

      try {
        const quotaStatus = await assertDailyQuotaAvailable(
          uid,
          "generate-image",
        );
        quotaRemaining = quotaStatus.remaining;
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          quotaRemaining = 0;
        } else {
          throw error;
        }
      }
    } else if (cacheResult.pending) {
      return NextResponse.json(
        {
          status: "processing",
          message:
            "This image is currently being generated. Please check back in a few seconds.",
          retry_after: 5,
        },
        { status: 202 },
      );
    } else {
      // It's a MISS and we've reserved the cache record as "pending"
      let quotaConsumed = false;
      try {
        const quota = await consumeDailyQuota(uid, "generate-image");
        quotaRemaining = quota.remaining;
        quotaConsumed = true;

        const hfKey = getHuggingFaceToken();
        if (!hfKey) {
          throw new Error("Hugging Face token is missing.");
        }

        const hfResult = await generateWithHuggingFace(prompt, hfKey);
        if (!hfResult) {
          throw new Error("All configured Hugging Face image models failed.");
        }

        selectedModel = hfResult.model;
        secureUrl = await uploadToCloudinary(hfResult.buffer, uid);

        // Finalize transaction
        await cacheRef.set(
          {
            status: "completed",
            secureUrl,
            providerModel: selectedModel,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        await recordAiUsageEvent({
          uid,
          endpoint: "generate-image",
          success: true,
          inputChars: prompt.length,
          model: selectedModel,
          metadata: {
            quotaRemaining,
            projectId: projectId || undefined,
            cardId: cardId || undefined,
            aspectRatio,
            style,
          },
        });
      } catch (err: any) {
        console.error("[generate-image] Generation failed:", err);

        // Rollback quota
        if (quotaConsumed) {
          await refundDailyQuota(uid, "generate-image");
        }

        // Set cache to failed
        await cacheRef.set(
          {
            status: "failed",
            error: err.message || "Unknown error",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        throw err; // Re-throw to be caught by global catch block
      }
    }

    if (idempotencyKey) {
      await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
        {
          status: "completed",
          secureUrl,
          quotaRemaining,
          ...(projectId ? { projectId } : {}),
          ...(cardId ? { cardId } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({
      imageUrl: secureUrl,
      quotaRemaining,
    });
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    const db = getFirebaseAdminDb();

    const securityError = toAiSecurityErrorResponse(error);
    if (securityError) {
      if (uid) {
        await recordAiUsageEvent({
          uid,
          endpoint: "generate-image",
          success: false,
          inputChars: promptLength || undefined,
          model: selectedModel || undefined,
          error: error?.message,
          metadata: {
            errorType: error?.name || "SecurityError",
          },
        });
      }

      if (idempotencyKey && idempotencyClaimed) {
        await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
          {
            status: "failed",
            error: error?.message,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return securityError;
    }

    if (uid) {
      await recordAiUsageEvent({
        uid,
        endpoint: "generate-image",
        success: false,
        inputChars: promptLength || undefined,
        model: selectedModel || undefined,
        error: error?.message,
        metadata: {
          errorType: error?.name || "UnhandledError",
        },
      });

      if (idempotencyKey && idempotencyClaimed) {
        await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
          {
            status: "failed",
            error: error?.message,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    const rawError = error?.message || "Unknown image generation failure";
    console.error("[generate-image] Unhandled Error:", rawError);

    return NextResponse.json(
      {
        error:
          "Image generation failed. Our specialized image AI service is temporarily unavailable.",
      },
      { status: 500 },
    );
  }
}
