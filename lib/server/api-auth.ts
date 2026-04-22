import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/server/firebase-admin";

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

const getBearerToken = (req: Request): string => {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    throw new ApiAuthError("Missing Authorization bearer token.", 401);
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiAuthError("Authorization token is empty.", 401);
  }

  return token;
};

export const requireAuthenticatedUser = async (
  req: Request,
): Promise<DecodedIdToken> => {
  if (process.env.ENFORCE_AUTH === "false") {
    // Staged rollout toggle: bypass auth verification
    return {
      uid: "bypass-auth-uid",
      email: "bypass@example.com",
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iss: "https://securetoken.google.com/bypass-project",
      aud: "bypass-project",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      sub: "bypass-auth-uid",
      firebase: { identities: {}, sign_in_provider: "custom" },
    } as DecodedIdToken;
  }

  const token = getBearerToken(req);

  try {
    const auth = getFirebaseAdminAuth();
    return await auth.verifyIdToken(token);
  } catch (error: any) {
    const code = error?.code || "";

    if (
      code === "auth/id-token-expired" ||
      code === "auth/argument-error" ||
      code === "auth/invalid-id-token"
    ) {
      throw new ApiAuthError("Invalid or expired authentication token.", 401);
    }

    if (error?.message?.includes("Missing required environment variable")) {
      throw new ApiAuthError(
        "Server authentication configuration is incomplete.",
        500,
      );
    }

    throw new ApiAuthError("Authentication failed.", 401);
  }
};

export const toApiAuthErrorResponse = (error: unknown) => {
  if (error instanceof ApiAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return null;
};
