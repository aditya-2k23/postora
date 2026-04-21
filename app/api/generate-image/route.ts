import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(
  blobArrayBuffer: ArrayBuffer,
  uid: string,
): Promise<string> {
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
  toAiSecurityErrorResponse,
  ValidationError,
} from "@/lib/server/ai-security";

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

  return {
    prompt: normalizedPrompt,
    aspectRatio: typeof raw.aspectRatio === "string" ? raw.aspectRatio : "4:5",
    style: typeof raw.style === "string" ? raw.style : "minimal",
    projectId: typeof raw.projectId === "string" ? raw.projectId : "",
    cardId: typeof raw.cardId === "string" ? raw.cardId : "",
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

// POST handler
export async function POST(req: Request) {
  let uid = "";
  let promptLength = 0;
  let selectedModel = "";
  let rawIdempotencyKey = req.headers.get("x-idempotency-key");
  let idempotencyKey: string | null = null;

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

    const db = getFirebaseAdminDb();

    if (idempotencyKey) {
      const idKeyRef = db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`);
      const idempotencyResult = await db.runTransaction(async (transaction) => {
        const idSnap = await transaction.get(idKeyRef);
        if (idSnap.exists) {
          return { exists: true, data: idSnap.data() };
        }
        transaction.set(idKeyRef, {
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
        });
        return { exists: false };
      });

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
            error:
              idData?.status === "pending"
                ? "A request with this idempotency key is already in progress."
                : "A request with this idempotency key already failed. Please try a new key.",
          },
          { status: idData?.status === "pending" ? 409 : 400 },
        );
      }
    }

    const { prompt, aspectRatio, style, projectId, cardId } =
      validateImagePayload(await req.json());
    promptLength = prompt.length;

    const promptHash = createHash("sha256")
      .update(`${prompt}|${aspectRatio}|${style}`)
      .digest("hex");

    const cacheRef = db.doc(`users/${uid}/generatedImagesCache/${promptHash}`);
    const cacheSnap = await cacheRef.get();

    let secureUrl = "";
    let quotaRemaining = 0;

    if (cacheSnap.exists && cacheSnap.data()?.secureUrl) {
      secureUrl = cacheSnap.data()!.secureUrl;
      selectedModel = cacheSnap.data()!.providerModel || "cache";

      try {
        const quotaStatus = await assertDailyQuotaAvailable(
          uid,
          "generate-image",
        );
        quotaRemaining = quotaStatus.remaining;
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          // Cache hit should still be allowed even after the user has exhausted new-generation quota.
          quotaRemaining = 0;
        } else {
          throw error;
        }
      }
    } else {
      await assertDailyQuotaAvailable(uid, "generate-image");

      const hfKey = getHuggingFaceToken();
      if (!hfKey) {
        return NextResponse.json(
          {
            error:
              "Hugging Face token is missing. Add HUGGINGFACE_API_KEY to your .env file to enable image generation.",
          },
          { status: 500 },
        );
      }

      const hfResult = await generateWithHuggingFace(prompt, hfKey);
      if (!hfResult) {
        return NextResponse.json(
          {
            error:
              "All configured Hugging Face image models failed for this request.",
          },
          { status: 503 },
        );
      }

      selectedModel = hfResult.model;
      secureUrl = await uploadToCloudinary(hfResult.buffer, uid);

      const quota = await consumeDailyQuota(uid, "generate-image");
      quotaRemaining = quota.remaining;

      await recordAiUsageEvent({
        uid,
        endpoint: "generate-image",
        success: true,
        inputChars: prompt.length,
        model: selectedModel,
        metadata: {
          quotaRemaining,
        },
      });

      await cacheRef.set({
        prompt,
        aspectRatio,
        style,
        promptHash,
        secureUrl,
        providerModel: selectedModel,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (projectId && cardId) {
      const metadataRef = db.doc(
        `users/${uid}/projects/${projectId}/images/${cardId}`,
      );
      await metadataRef.set(
        {
          promptHash,
          providerModel: selectedModel,
          secureUrl,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (idempotencyKey) {
      await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
        {
          status: "completed",
          secureUrl,
          quotaRemaining,
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

      if (idempotencyKey) {
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

    console.error("Image Generate Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
