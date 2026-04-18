import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    let key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    // Clean up accidental quotes or whitespace from the environment variable mapping
    key = key.replace(/['"]/g, '').trim();

    if (!key) {
      console.error("API Key is missing from the environment.");
    }
    
    const ai = new GoogleGenAI({ apiKey: key });
    const { prompt, aspectRatio } = await req.json();

    // Map user aspect ratio to supported ones
    let geminiRatio = "1:1";
    if (aspectRatio === "16:9") geminiRatio = "16:9";
    if (aspectRatio === "9:16") geminiRatio = "9:16";
    if (aspectRatio === "4:5") geminiRatio = "3:4"; // closest match
    if (aspectRatio === "3:4") geminiRatio = "3:4";
    if (aspectRatio === "4:3") geminiRatio = "4:3";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: geminiRatio,
          imageSize: "1K"
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
        return NextResponse.json({ imageUrl });
      }
    }

    throw new Error("No image data returned from model");
  } catch (error) {
    console.error("Gemini Image Generate Error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
