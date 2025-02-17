import { NextResponse } from "next/server";
import { TWITTER_CONFIG } from "../../../config/twitter";
import crypto from "crypto";

function generateRandomString(length: number) {
  return crypto.randomBytes(length).toString("hex");
}

export async function GET() {
  try {
    if (!TWITTER_CONFIG.clientId || !TWITTER_CONFIG.clientSecret) {
      console.error("Missing Twitter credentials:", {
        clientId: !!TWITTER_CONFIG.clientId,
        clientSecret: !!TWITTER_CONFIG.clientSecret,
        callbackUrl: TWITTER_CONFIG.callbackUrl,
      });
      throw new Error("Twitter credentials are not configured");
    }

    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(32);
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", TWITTER_CONFIG.clientId);
    authUrl.searchParams.append("redirect_uri", TWITTER_CONFIG.callbackUrl);
    authUrl.searchParams.append(
      "scope",
      "tweet.read tweet.write users.read offline.access"
    );
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("code_challenge", codeChallenge);
    authUrl.searchParams.append("code_challenge_method", "S256");

    console.log("Generated auth URL:", {
      url: authUrl.toString(),
      clientId: TWITTER_CONFIG.clientId,
      callbackUrl: TWITTER_CONFIG.callbackUrl,
    });

    const response = NextResponse.json({ url: authUrl.toString() });

    // Set cookies with explicit configuration
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60, // 1 hour
    };

    response.cookies.set("twitter_oauth_state", state, cookieOptions);
    response.cookies.set(
      "twitter_oauth_code_verifier",
      codeVerifier,
      cookieOptions
    );

    return response;
  } catch (error) {
    console.error("Twitter auth error:", error);
    return NextResponse.json(
      { error: "Failed to initialize Twitter authentication" },
      { status: 500 }
    );
  }
}
