import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAuthenticatedUser, toApiAuthErrorResponse } from "@/lib/server/api-auth";
import { 
  enforceIpRateLimit, 
  toAiSecurityErrorResponse, 
  ValidationError,
  assertDailyQuotaAvailable,
  consumeDailyQuota,
  recordAiUsageEvent,
  getRequestIpHash
} from "@/lib/server/ai-security";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_UPLOAD_SIZE = 6_000_000;

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAuthenticatedUser(req);
    const uid = decodedToken.uid;

    enforceIpRateLimit(req, "upload-image");
    await assertDailyQuotaAvailable(uid, "upload-image");

    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new ValidationError("Image data is required.");
    }

    if (imageBase64.length > MAX_UPLOAD_SIZE) {
       throw new ValidationError("Image is too large.", 413);
    }

    await consumeDailyQuota(uid, "upload-image");

    const uploadResult: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        imageBase64,
        { folder: `postora_uploads/${uid}` },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });

    await recordAiUsageEvent({
      uid,
      endpoint: "upload-image",
      success: true,
      model: "cloudinary",
      ipHash: getRequestIpHash(req),
    });

    return NextResponse.json({ imageUrl: uploadResult.secure_url });
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    const securityError = toAiSecurityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
