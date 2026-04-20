import { InferenceClient } from "@huggingface/inference";
import { NextResponse } from "next/server";

const HUGGING_FACE_IMAGE_MODELS = [
  "black-forest-labs/FLUX.1-schnell",
  "black-forest-labs/FLUX.1-dev",
  "stabilityai/sdxl-turbo",
];

function getHuggingFaceToken(): string {
  return (process.env.HUGGINGFACE_API_KEY || "").replace(/['"]/g, "").trim();
}

async function generateWithHuggingFace(
  prompt: string,
  hfKey: string,
): Promise<string | null> {
  const client = new InferenceClient(hfKey);

  for (const model of HUGGING_FACE_IMAGE_MODELS) {
    try {
      const imageBlob = await client.textToImage(
        {
          model,
          inputs: prompt,
          provider: "auto",
        },
        {
          outputType: "blob",
        },
      );

      const contentType = imageBlob.type || "image/png";
      const blob = await imageBlob.arrayBuffer();
      const base64 = Buffer.from(blob).toString("base64");

      if (!base64) {
        console.warn(
          `[generate-image] Hugging Face ${model} returned empty image data`,
        );
        continue;
      }

      return `data:${contentType};base64,${base64}`;
    } catch (error: any) {
      console.warn(
        `[generate-image] Hugging Face ${model} failed:`,
        error?.message?.substring(0, 240) ?? error,
      );
    }
  }

  return null;
}

// POST handler
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const hfKey = getHuggingFaceToken();

    if (!prompt) {
      return NextResponse.json(
        { error: "Image prompt is required" },
        { status: 400 },
      );
    }

    if (!hfKey) {
      return NextResponse.json(
        {
          error:
            "Hugging Face token is missing. Add HUGGINGFACE_API_KEY (or HUGGING_FACE_API_KEY / HF_TOKEN) to your .env file to enable image generation.",
        },
        { status: 500 },
      );
    }

    const hfUrl = await generateWithHuggingFace(prompt, hfKey);
    if (hfUrl) {
      return NextResponse.json({ imageUrl: hfUrl });
    }

    return NextResponse.json(
      {
        error:
          "All configured Hugging Face image models failed for this request. Verify token permission 'Make calls to Inference Providers' and available Hugging Face credits.",
      },
      { status: 503 },
    );
  } catch (error: any) {
    console.error("Image Generate Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
