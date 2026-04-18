import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
    const { prompt, tone, platform, aspectRatio, numCards } = await req.json();

    const systemInstruction = `You are an expert social media manager and content creator.
You must generate a set of ${numCards} cards for a ${platform} post.
Keep the tone: ${tone}.
Make sure the content is highly engaging, viral-worthy, and perfectly suited for ${platform}.
Generate a short imagePrompt for each card that could be used by an AI image generator to create a visually matching background or illustration.
The visual aspect ratio will be ${aspectRatio}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A short, catchy hook or title for the card.",
              },
              content: {
                type: Type.STRING,
                description: "The main text or copy for this specific card.",
              },
              imagePrompt: {
                type: Type.STRING,
                description: "A detailed AI image generation prompt for the background or accompanying image.",
              },
            },
            required: ["title", "content", "imagePrompt"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini API");
    }

    const cards = JSON.parse(text);
    return NextResponse.json({ cards });

  } catch (error) {
    console.error("Gemini Content Generate Error:", error);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
