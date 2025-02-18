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
    const codeVerifier = request.cookies.get("twitter_oauth_code_verifier")?.value;

    if (!state || !storedState || !code || !codeVerifier || state !== storedState) {
      return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
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

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${TWITTER_CONFIG.clientId}:${TWITTER_CONFIG.clientSecret}`
        ).toString("base64")}`,
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(
        new URL("/?error=token_exchange_failed", request.url)
      );
    }

    const { access_token, refresh_token } = await tokenResponse.json();

    // Create the response with redirect
    const response = NextResponse.redirect(new URL("/", request.url));

    // Set the access token cookie with proper configuration
    response.cookies.set("twitter_access_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7200, // 2 hours
    });

    // Set the refresh token if provided
    if (refresh_token) {
      response.cookies.set("twitter_refresh_token", refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    // Clear the state and code verifier cookies
    response.cookies.delete("twitter_oauth_state");
    response.cookies.delete("twitter_oauth_code_verifier");

    return response;
  } catch (error) {
    console.error("Twitter callback error:", error);
    return NextResponse.redirect(
      new URL("/?error=callback_error", request.url)
    );
  }
}
