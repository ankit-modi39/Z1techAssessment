import { NextRequest, NextResponse } from "next/server";
import { TwitterApi, ApiResponseError } from "twitter-api-v2";

interface ImageData {
  [key: string]: string;
}

type MediaIdsTuple = [string] | [string, string] | [string, string, string] | [string, string, string, string];

export async function POST(request: NextRequest) {
  try {
    const oauth2Token = request.cookies.get("twitter_access_token")?.value;

    if (!oauth2Token) {
      return NextResponse.json(
        { error: "Not authenticated. Please login with Twitter first." },
        { status: 401 }
      );
    }

    const data = await request.json();
    const images = data.images as ImageData;

    if (!images || Object.keys(images).length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    // Initialize OAuth 1.0a client for media uploads with proper credentials
    const oauth1Client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    // Initialize OAuth 2.0 client for tweets with proper scopes
    const oauth2Client = new TwitterApi(oauth2Token);
    const v2Client = oauth2Client.v2;

    try {
      // First verify the OAuth 2.0 token and check user context
      const me = await v2Client.me({
        'user.fields': ['id', 'name', 'username']
      });
      console.log("Authenticated user:", me.data);

      // Upload all images using OAuth 1.0a client with proper media type
      const mediaIds = await Promise.all(
        Object.entries(images).map(async ([, dataUrl]) => {
          // Convert data URL to buffer
          const base64Data = (dataUrl as string).split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");

          try {
            // Initialize media upload
            const mediaId = await oauth1Client.v1.uploadMedia(buffer, {
              type: "image/png",
              mimeType: "image/png"
            });
            
            console.log("Successfully uploaded media, ID:", mediaId);
            return mediaId;
          } catch (uploadError) {
            console.error("Media upload failed:", uploadError);
            throw uploadError;
          }
        })
      );

      // Ensure we only use up to 4 media IDs (X API limit)
      const slicedMediaIds = mediaIds.slice(0, 4);
      const mediaIdsTuple = (slicedMediaIds.length === 1 
        ? [slicedMediaIds[0]]
        : slicedMediaIds.length === 2
        ? [slicedMediaIds[0], slicedMediaIds[1]]
        : slicedMediaIds.length === 3
        ? [slicedMediaIds[0], slicedMediaIds[1], slicedMediaIds[2]]
        : slicedMediaIds.length === 4
        ? [slicedMediaIds[0], slicedMediaIds[1], slicedMediaIds[2], slicedMediaIds[3]]
        : [slicedMediaIds[0]]) as unknown as MediaIdsTuple;
      
      // Post tweet with images using OAuth 2.0 client with proper fields
      const tweet = await v2Client.tweet("Check out these resized images! 🖼️ #ImageResizer", {
        media: { 
          media_ids: mediaIdsTuple,
          tagged_user_ids: []
        }
      });

      return NextResponse.json({ 
        success: true, 
        tweet: tweet.data
      });
    } catch (error) {
      if (error instanceof ApiResponseError) {
        console.error("Twitter API error details:", {
          code: error.code,
          message: error.message,
          data: error.data,
          rateLimitError: error.rateLimit,
          headers: error.headers
        });
        
        // Handle specific error cases based on X API error codes
        if (error.code === 403) {
          return NextResponse.json(
            { 
              error: "Twitter authorization failed",
              details: "Please ensure you have granted write permissions to the app and try logging in again. Required scopes: tweet.read, tweet.write, users.read",
              code: error.code
            },
            { status: 403 }
          );
        }

        if (error.code === 429) {
          return NextResponse.json(
            {
              error: "Rate limit exceeded",
              details: "Please try again later.",
              code: error.code
            },
            { status: 429 }
          );
        }
        
        return NextResponse.json(
          { 
            error: "Failed to post to Twitter",
            details: error.message,
            code: error.code
          },
          { status: error.code || 500 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Server error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
