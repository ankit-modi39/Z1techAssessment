import { NextRequest, NextResponse } from "next/server";
import { TWITTER_CONFIG } from "../../../../config/twitter";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    if (error) {
      console.error("Twitter OAuth error:", { error, error_description });
      return NextResponse.redirect(
        new URL(
          `/?error=${error}&error_description=${error_description}`,
          request.url
        )
      );
    }

    const storedState = request.cookies.get("twitter_oauth_state")?.value;
    const codeVerifier = request.cookies.get(
      "twitter_oauth_code_verifier"
    )?.value;

    console.log("OAuth state check:", {
      receivedState: state,
      storedState,
      hasCodeVerifier: !!codeVerifier,
      code: !!code,
    });

    if (
      !state ||
      !storedState ||
      !code ||
      !codeVerifier ||
      state !== storedState
    ) {
      return NextResponse.redirect(
        new URL("/?error=invalid_state", request.url)
      );
    }

    const tokenUrl = "https://api.twitter.com/2/oauth2/token";
    const params = new URLSearchParams({
      client_id: TWITTER_CONFIG.clientId,
      client_secret: TWITTER_CONFIG.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: TWITTER_CONFIG.callbackUrl,
      code_verifier: codeVerifier,
    });

    console.log("Token request params:", {
      clientId: TWITTER_CONFIG.clientId,
      callbackUrl: TWITTER_CONFIG.callbackUrl,
      hasSecret: !!TWITTER_CONFIG.clientSecret,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token response error:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const { access_token, refresh_token } = await tokenResponse.json();

    // Create base URL for redirect
    const baseUrl = request.nextUrl.origin;
    const response = NextResponse.redirect(baseUrl);

    // Set cookies with proper configuration
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    };

    response.cookies.set("twitter_access_token", access_token, cookieOptions);

    if (refresh_token) {
      response.cookies.set(
        "twitter_refresh_token",
        refresh_token,
        cookieOptions
      );
    }

    return response;
  } catch (error) {
    console.error("Twitter callback error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.redirect(
      new URL(
        "/?error=auth_failed&message=" + encodeURIComponent(errorMessage),
        request.url
      )
    );
  }
}
