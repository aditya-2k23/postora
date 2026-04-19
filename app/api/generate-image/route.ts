import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Hugging Face fallback – uses the free Serverless Inference API
async function generateWithHuggingFace(prompt: string): Promise<string | null> {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) return null;

  const model = "stabilityai/stable-diffusion-xl-base-1.0";
  try {
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      },
    );

    if (!res.ok) return null;

    const blob = await res.arrayBuffer();
    const base64 = Buffer.from(blob).toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini image generation — single model, no retry on 429, 8s timeout
// ---------------------------------------------------------------------------
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

async function generateWithGemini(
  ai: GoogleGenAI,
  prompt: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
      // @ts-expect-error -- AbortSignal accepted at runtime
      signal: controller.signal,
    });

    clearTimeout(timeout);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        const mime = part.inlineData.mimeType || "image/png";
        return `data:${mime};base64,${base64}`;
      }
    }

    console.warn("[generate-image] Gemini returned no image data");
    return null;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[generate-image] Gemini timed out after 8s");
      return null;
    }
    const status = err?.status ?? err?.response?.status;
    console.warn(
      `[generate-image] ${GEMINI_IMAGE_MODEL} failed (${status ?? "unknown"}):`,
      err.message?.substring(0, 200) ?? err,
    );
    return null; // skip to HF fallback
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    let key =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";
    key = key.replace(/['"]/g, "").trim();

    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Image prompt is required" },
        { status: 400 },
      );
    }

    // 1. Try Gemini (primary)
    if (key) {
      const ai = new GoogleGenAI({ apiKey: key });
      const imageUrl = await generateWithGemini(ai, prompt);
      if (imageUrl) {
        return NextResponse.json({ imageUrl });
      }
      console.warn(
        "[generate-image] Gemini failed, trying HF fallback…",
      );
    } else {
      console.warn("[generate-image] No Gemini API key, trying HF fallback…");
    }

    // 2. Hugging Face fallback
    const hfUrl = await generateWithHuggingFace(prompt);
    if (hfUrl) {
      return NextResponse.json({ imageUrl: hfUrl });
    }

    return NextResponse.json(
      {
        error:
          "Image generation quota exhausted for today. Images will be available once the daily free-tier quota resets. Add a HUGGINGFACE_API_KEY to .env to enable fallback image generation.",
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
