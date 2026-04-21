import { NextResponse } from "next/server";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";

if (process.env.NODE_ENV === "production" && !process.env.ADMIN_SECRET) {
  throw new Error(
    "Missing required ADMIN_SECRET in production for /api/admin/usage.",
  );
}

const isAdminAuthEnforced = process.env.ENFORCE_ADMIN_AUTH !== "false";

const requireAdminAuth = (req: Request) => {
  if (!isAdminAuthEnforced) {
    return null;
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Server admin authentication is not configured." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("[admin API] fetch usage error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
