import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

interface ImageData {
  [key: string]: string;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("twitter_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const data = await request.json();
    const images = data.images as ImageData;

    if (!images || Object.keys(images).length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const client = new TwitterApi(accessToken);

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
        console.log(
          `Uploaded image for dimension ${dimension}, got media ID: ${mediaId}`
        );
        return mediaId;
      })
    );

    // Post tweet with images (maximum 4)
    const tweet = await client.v1.tweet(
      "Check out these resized images! ��️ #ImageResizer",
      {
        media_ids: mediaIds.slice(0, 4),
      }
    );

    return NextResponse.json({ success: true, tweet });
  } catch (error) {
    console.error("Twitter post error:", error);
    return NextResponse.json(
      { error: "Failed to post to Twitter" },
      { status: 500 }
    );
  }
}
