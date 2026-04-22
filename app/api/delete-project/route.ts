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
    if (uploadIndex === -1) return null;
    
    // Everything after /upload/v[version]/ or /upload/
    let publicIdWithExt = "";
    if (parts[uploadIndex + 1].startsWith("v")) {
      // It's a versioned URL: .../upload/v12345/public_id.jpg
      publicIdWithExt = parts.slice(uploadIndex + 2).join("/");
    } else {
      // It's a non-versioned URL: .../upload/public_id.jpg
      publicIdWithExt = parts.slice(uploadIndex + 1).join("/");
    }
    
    // Remove extension
    const dotIndex = publicIdWithExt.lastIndexOf(".");
    if (dotIndex !== -1) {
      return publicIdWithExt.substring(0, dotIndex);
    }
    return publicIdWithExt;
  } catch (e) {
    console.error("Failed to extract public ID from URL:", url, e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireAuthenticatedUser(req);
    const uid = decodedToken.uid;
    const { projectId, imageUrls = [] } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);
    
    // 1. Get project data to find any image URLs if not provided
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();
    const allImageUrls: string[] = [...imageUrls];

    // Collect all image URLs from cards if not provided
    if (allImageUrls.length === 0 && projectData?.cards) {
      projectData.cards.forEach((card: any) => {
        if (card.imageUrl) allImageUrls.push(card.imageUrl);
      });
    }

    // Also check canvas state for custom uploaded images
    if (projectData?.canvas?.slidesByCardId) {
      Object.values(projectData.canvas.slidesByCardId).forEach((slide: any) => {
        slide.elements?.forEach((el: any) => {
          if (el.type === "image" && el.src) {
            allImageUrls.push(el.src);
          }
        });
      });
    }

    // 2. Extract unique public IDs
    const publicIds = Array.from(new Set(
      allImageUrls
        .map(extractPublicId)
        .filter((id): id is string => id !== null)
    ));

    console.log(`[delete-project] Deleting ${publicIds.length} images from Cloudinary for project ${projectId}`);

    // 3. Delete from Cloudinary
    if (publicIds.length > 0) {
      try {
        // cloudinary.api.delete_resources is capped at 100, but projects shouldn't have that many.
        // If they do, we'd need to chunk.
        await new Promise((resolve, reject) => {
          cloudinary.api.delete_resources(publicIds, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
      } catch (cloudinaryError) {
        console.error("[delete-project] Cloudinary deletion failed:", cloudinaryError);
        // We continue anyway to delete the project doc
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
      { status: 500 }
    );
  }
}
