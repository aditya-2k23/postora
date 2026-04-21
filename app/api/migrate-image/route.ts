import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";
import {
  enforceIpRateLimit,
  toAiSecurityErrorResponse,
  ValidationError,
} from "@/lib/server/ai-security";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_MIGRATION_DATA_URL_CHARS = 6_000_000;

async function uploadToCloudinary(
  base64String: string,
  uid: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64String,
      { folder: `postora_images/${uid}` },
      (error, result) => {
        if (error) reject(error);
        else if (result) resolve(result.secure_url);
        else reject(new Error("Unknown cloudinary upload error"));
      },
    );
  });
}

function validatePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid request payload.");
  }
  const raw = payload as Record<string, unknown>;
  const imageBase64 = raw.imageBase64;
  if (typeof imageBase64 !== "string") {
    throw new ValidationError("imageBase64 must be a string.");
  }

  // Strict validation for raster base64 images only
  const allowedPrefixes = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/webp;base64,",
    "data:image/gif;base64,",
  ];

  const hasValidPrefix = allowedPrefixes.some((p) =>
    imageBase64.startsWith(p),
  );

  if (!hasValidPrefix) {
    throw new ValidationError(
      "Direct base64 raster image data (PNG, JPEG, WEBP, or GIF) is required.",
    );
  }

  if (imageBase64.length > MAX_MIGRATION_DATA_URL_CHARS) {
    throw new ValidationError(
      "Image payload is too large to migrate in one request.",
      413,
    );
  }

  return {
    imageBase64,
    projectId: typeof raw.projectId === "string" ? raw.projectId : "",
    cardId: typeof raw.cardId === "string" ? raw.cardId : "",
  };
}

export async function POST(req: Request) {
  // Respect the rollout toggle
  if (process.env.ENABLE_IMAGE_MIGRATION !== "true") {
    return NextResponse.json(
      { error: "Image migration is currently disabled." },
      { status: 403 },
    );
  }

  let uid = "";
  try {
    const decodedToken = await requireAuthenticatedUser(req);
    uid = decodedToken.uid;

    enforceIpRateLimit(req, "generate-image");

    const { imageBase64, projectId, cardId } = validatePayload(
      await req.json(),
    );

    if (!projectId || !cardId) {
      throw new ValidationError(
        "projectId and cardId are required for migration.",
      );
    }

    const secureUrl = await uploadToCloudinary(imageBase64, uid);

    const db = getFirebaseAdminDb();
    const metadataRef = db.doc(
      `users/${uid}/projects/${projectId}/images/${cardId}`,
    );

    await metadataRef.set(
      {
        promptHash: "migrated-legacy-image",
        providerModel: "legacy-base64",
        secureUrl,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ imageUrl: secureUrl });
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    const securityError = toAiSecurityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Image Migration Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to migrate image" },
      { status: 500 },
    );
  }
}
