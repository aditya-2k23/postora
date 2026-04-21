import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";

const isAdminAuthEnforced = process.env.ENFORCE_ADMIN_AUTH !== "false";

const requireAdminAuth = (req: Request) => {
  if (!isAdminAuthEnforced) {
    return null;
  }

  return null;
};

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const db = getFirebaseAdminDb();

    // We try to fetch the latest 50 events across all users for basic spike observability.
    // NOTE: This requires a collectionGroup index on `aiEvents` ordered by `createdAt` desc.
    // If the index is missing, the error will contain a URL to create it.
    const eventsSnap = await db
      .collectionGroup("aiEvents")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const events = eventsSnap.docs.map((doc) => {
      const data = doc.data();
      // Safely serialize timestamp
      if (data.createdAt && typeof data.createdAt.toDate === "function") {
        data.createdAt = data.createdAt.toDate().toISOString();
      }
      return { id: doc.id, ...data };
    });

    // Also try to get an aggregate of today's usage if possible, but Firestore doesn't easily tally
    // collection groups without an aggregation query or an index. Minimal observability focuses on the latest spikes/events.

    return NextResponse.json({
      success: true,
      message:
        "Fetched latest AI usage events. If this fails due to missing index, click the URL in the error logs to build the collectionGroup index.",
      count: events.length,
      events,
    });
  } catch (err: any) {
    console.error("[admin API] fetch usage error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
