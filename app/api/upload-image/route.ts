import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";
import {
  enforceIpRateLimit,
  toAiSecurityErrorResponse,
  ValidationError,
  assertDailyQuotaAvailable,
  consumeDailyQuota,
  recordAiUsageEvent,
} from "@/lib/server/ai-security";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_UPLOAD_SIZE = 6_000_000;

export async function POST(req: Request) {
  let uid = "";
  try {
    const decodedToken = await requireAuthenticatedUser(req);
    uid = decodedToken.uid;

    enforceIpRateLimit(req, "upload-image");
    await assertDailyQuotaAvailable(uid, "upload-image");

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new ValidationError("Image data is required.");
    }

    if (imageBase64.length > MAX_UPLOAD_SIZE) {
      throw new ValidationError("Image is too large.", 413);
    }

    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        imageBase64,
        { folder: `postora_uploads/${uid}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
    });

    let quotaRemaining: number | null = null;
    try {
      const quota = await consumeDailyQuota(uid, "upload-image");
      quotaRemaining = quota.remaining;

      await recordAiUsageEvent({
        uid,
        endpoint: "upload-image",
        success: true,
        model: "cloudinary",
      });
    } catch (postError) {
      console.error("[upload-image] Post-processing error:", postError);
    }

    return NextResponse.json({
      imageUrl: uploadResult.secure_url,
      quotaRemaining,
    });
  } catch (error: any) {
    if (uid) {
      try {
        await recordAiUsageEvent({
          uid,
          endpoint: "upload-image",
          success: false,
          model: "cloudinary",
          error: error?.message || "Unknown upload error",
        });
      } catch (telemetryError) {
        console.error("[upload-image] Telemetry failed:", telemetryError);
      }
    }

    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    const securityError = toAiSecurityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image" },
      { status: 500 },
    );
  }
}
