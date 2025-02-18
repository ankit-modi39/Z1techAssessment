import { NextRequest, NextResponse } from "next/server";
import { TwitterApi, ApiResponseError } from "twitter-api-v2";

interface ImageData {
  [key: string]: string;
}

type MediaIdsTuple = [string] | [string, string] | [string, string, string] | [string, string, string, string];

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
        Object.entries(images).map(async ([, dataUrl]) => {
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

      // Ensure we only use up to 4 media IDs and convert to the correct tuple type
      const slicedMediaIds = mediaIds.slice(0, 4);
      const mediaIdsTuple = slicedMediaIds.length === 1 
        ? [slicedMediaIds[0]]
        : slicedMediaIds.length === 2
        ? [slicedMediaIds[0], slicedMediaIds[1]]
        : slicedMediaIds.length === 3
        ? [slicedMediaIds[0], slicedMediaIds[1], slicedMediaIds[2]]
        : slicedMediaIds.length === 4
        ? [slicedMediaIds[0], slicedMediaIds[1], slicedMediaIds[2], slicedMediaIds[3]]
        : [slicedMediaIds[0]];
      
      // Post tweet with images
      const tweet = await client.v2.tweet("Check out these resized images! 🖼️ #ImageResizer", {
        media: { media_ids: mediaIdsTuple as MediaIdsTuple }
      });

      return NextResponse.json({ success: true, tweet });
    } catch (error) {
      if (error instanceof ApiResponseError) {
        console.error("Twitter API error:", error);
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
