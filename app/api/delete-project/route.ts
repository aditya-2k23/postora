import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Extracts Cloudinary public ID from a URL.
 * URL format: https://res.cloudinary.com/[cloud]/image/upload/v[version]/[public_id].[ext]
 */
function extractPublicId(url: string): string | null {
  if (!url || !url.includes("cloudinary.com")) return null;

  try {
    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1 || !parts[uploadIndex + 1]) return null;

    // Refactor to tolerate optional transformation segments and a strict version segment.
    // Transformation segments usually have keys like w_ or contain commas.
    // Version segments match a strict ^v\d+$ pattern.
    const afterUpload = parts.slice(uploadIndex + 1).join("/");
    const regex =
      /^(?:(?:[a-z]{1,2}_[^\/]+\/|[^\/]+,[^\/]+\/)*?)(?:v\d+\/)?([^\?#]+)$/i;
    const match = afterUpload.match(regex);

    if (!match) return null;

    const publicIdWithExt = match[1];
    const dotIndex = publicIdWithExt.lastIndexOf(".");

    // Strip extension and return public id
    if (dotIndex !== -1) {
      return publicIdWithExt.substring(0, dotIndex);
    }
    return publicIdWithExt;
  } catch (e) {
    // Return null on non-matching or malformed URLs rather than throwing
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAuthenticatedUser(req);
    const uid = decodedToken.uid;
    const { projectId, imageUrls = [] } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const db = getFirebaseAdminDb();
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);

    // 1. Get project data to find any image URLs if not provided
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();
    const allImageUrls: string[] = [];

    // 1. ALWAYS build the canonical deletion list from the verified project document first.
    if (projectData?.cards) {
      projectData.cards.forEach((card: any) => {
        if (card.imageUrl) {
          allImageUrls.push(card.imageUrl);
        }
      });
    }

    // Also check canvas state for custom uploaded or generated images
    if (projectData?.canvas?.slidesByCardId) {
      Object.values(projectData.canvas.slidesByCardId).forEach((slide: any) => {
        slide.elements?.forEach((el: any) => {
          if (
            el.type === "image" &&
            el.src &&
            el.src.includes("cloudinary.com")
          ) {
            allImageUrls.push(el.src);
          }
        });
      });
    }

    // 2. Merge client-provided imageUrls if they are an array (normalize inputs)
    if (Array.isArray(imageUrls)) {
      allImageUrls.push(...imageUrls);
    }

    // 2. Extract and validate unique public IDs
    // We strictly enforce that the public ID starts with the user's scoped folder.
    const allowedPrefixes = [
      `postora_images/${uid}/`,
      `postora_uploads/${uid}/`,
    ];

    const publicIds = Array.from(
      new Set(
        allImageUrls.map(extractPublicId).filter((id): id is string => {
          if (!id) return false;
          // Security check: ensure the image belongs to the current user
          return allowedPrefixes.some((prefix) => id.startsWith(prefix));
        }),
      ),
    );

    console.log(
      `[delete-project] Deleting ${publicIds.length} images from Cloudinary for project ${projectId}`,
    );

    // 3. Delete from Cloudinary
    const BATCH = 100;
    for (let i = 0; i < publicIds.length; i += BATCH) {
      const chunk = publicIds.slice(i, i + BATCH);
      try {
        const res = await cloudinary.api.delete_resources(chunk);
        if (res && Object.keys(res.deleted || {}).length === 0) {
          console.warn(
            "[delete-project] Cloudinary deletion returned no deletions for batch:",
            res,
          );
        }
      } catch (cloudinaryError) {
        console.error(
          "[delete-project] Cloudinary deletion failed for batch:",
          cloudinaryError,
        );
        // Continue with remaining batches and Firestore cleanup
      }
    }

    // 4. Delete Firestore project document
    await projectRef.delete();

    // 5. Delete associated subcollections if any (we don't have any right now according to blueprint)

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    console.error("[delete-project] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete project. Please try again later." },
      { status: 500 },
    );
  }
}
