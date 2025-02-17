import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const { image, dimensions } = await request.json();

    if (!image || !dimensions) {
      return NextResponse.json(
        { error: "Missing image or dimensions" },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(image.split(",")[1], "base64");

    // Process all dimensions in parallel
    const resizedImages = await Promise.all(
      dimensions.map(
        async ({ width, height }: { width: number; height: number }) => {
          const resized = await sharp(imageBuffer)
            .resize(width, height, {
              fit: "contain",
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .toBuffer();

          return {
            dimension: `${width}x${height}`,
            data: `data:image/png;base64,${resized.toString("base64")}`,
          };
        }
      )
    );

    // Convert array to object with dimensions as keys
    const result = resizedImages.reduce((acc, { dimension, data }) => {
      acc[dimension] = data;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Image processing error:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
}
