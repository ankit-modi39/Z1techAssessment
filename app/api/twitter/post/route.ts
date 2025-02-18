import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

interface ImageData {
  [key: string]: string;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("twitter_access_token")?.value;

    if (!accessToken) {
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

    // Initialize Twitter client with bearer token
    const client = new TwitterApi(accessToken);

    try {
      // Upload all images and collect their media IDs
      const mediaIds = await Promise.all(
        Object.entries(images).map(async ([dimension, dataUrl]) => {
          // Convert data URL to buffer
          const base64Data = (dataUrl as string).split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");

          // Upload to Twitter
          const mediaId = await client.v1.uploadMedia(buffer, {
            type: "image/png",
          });
          return mediaId;
        })
      );

      // Ensure we only use up to 4 media IDs and convert to tuple
      const mediaIdsArray = mediaIds.slice(0, 4) as [string, ...string[]];

      // Post tweet with images
      const tweet = await client.v2.tweet("Check out these resized images! 🖼️ #ImageResizer", {
        media: { media_ids: mediaIdsArray }
      });

      return NextResponse.json({ success: true, tweet });
    } catch (twitterError: any) {
      console.error("Twitter API error:", twitterError);
      return NextResponse.json(
        { 
          error: "Failed to post to Twitter",
          details: twitterError.message
        },
        { status: twitterError.code || 500 }
      );
    }
  } catch (error: any) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
