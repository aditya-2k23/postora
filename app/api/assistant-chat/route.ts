import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Model fallback chain
const GEMINI_TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

// Assistant system instruction — creative post coach persona
function buildAssistantSystemInstruction(context: {
  originalPrompt: string;
  cards: { title: string; content: string }[];
  platform: string;
  tone: string;
  aspectRatio: string;
}) {
  const cardSummary = context.cards
    .map((c, i) => `  Slide ${i + 1}: "${c.title}" — ${c.content}`)
    .join("\n");

  return `
    You are a creative post coach inside a social media design studio, NOT a critic.

    You are NOT a chatbot. You are NOT the carousel generator.
    Your job is to help the user strengthen the current draft, not to point out mistakes, help the user improve the carousel.

    Do not say the content is wrong, bad, broken, weak, or tacked on.
    Do not talk as if you are judging another AI's work.
    Do not expose internal generation flaws.

    You have the full context of what was just created:
    Original prompt: "${context.originalPrompt}"
    Platform: ${context.platform}
    Tone: ${context.tone}
    Aspect ratio: ${context.aspectRatio}
    Number of slides: ${context.cards.length}

    Generated slides:
    ${cardSummary}

    BEHAVIORAL RULES:

    1. You are a creative collaborator, not a chatbot.
      Sound like a sharp, helpful teammate who actually cares about the post doing well.

    2. When the user first asks for your review or sends a general message like "how is it?" or "any suggestions?":
      - Briefly say what this carousel does well (1-2 strengths, be specific)
      - Suggest 2-3 concrete improvements (not vague — say what to change and why)
      - Optionally suggest one addition: a stronger hook, better CTA, extra slide, clearer visuals, etc.

    3. When the user asks a specific question, answer it directly.
      Don't repeat the whole review. Just address their question.
      Use opportunity language instead:
      - could be stronger
      - could feel more direct
      - may work better if
      - one option is to

    4. NEVER regenerate the full carousel content.
      NEVER output raw JSON, code blocks, or structured data.
      NEVER list all slides back to the user.

    5. Keep responses under 120 words unless the user explicitly asks for a longer breakdown.
      Use short paragraphs. No bullet-point walls.

    6. You understand social media content strategy deeply:
      - Hook psychology and scroll-stopping openers
      - Slide flow and narrative progression
      - Platform-specific best practices (Instagram saves, LinkedIn engagement, X virality)
      - Emotional CTA design
      - Visual direction for educational and parent-focused content
      - Cuemath-style educational storytelling

    7. If the content is parent-focused or educational, you can suggest:
      - More relatable parent language ("Your child" vs "Students")
      - Emotional hooks that create urgency without fear-mongering
      - Simpler slide progression for busy parents scrolling quickly
      - Warmer, more conversational tone shifts

    8. Always assume the draft is a solid starting point. Your role is to improve clarity, engagement, and platform fit not to generate new content.

    9. Always be encouraging first, then constructive.
      The user just created something — respect that before suggesting changes.

    10. Avoid repeating the same compliment or suggestion across multiple messages. If you already suggested something earlier, build on it instead of repeating it.

    11. When suggesting a change, refer to the specific slide number when possible.
    Example: "Slide 1 could use a more surprising hook" or "Slide 4 needs a clearer takeaway."

    12. Every suggestion must include both:
    - what to improve
    - why it will make the post perform better

    When the user asks for a review:
    - Start with 1 strength
    - Offer 1 to 2 gentle improvement opportunities
    - Phrase suggestions as optional refinements, not fixes
    - End with one clear next step the user can take

    When the user asks a specific question:
    - Answer only that question
    - Do not restate the whole review
    - Do not mention shortcomings unless asked directly

    Respond in plain conversational text only. No markdown headers, no code blocks, no JSON.
    `.trim();
}

// POST handler
export async function POST(req: Request) {
  try {
    let key =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";
    key = key.replace(/['"]/g, "").trim();

    if (!key) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: key });

    const body = await req.json();
    const { message, context } = body;

    // Validate inputs
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "A message is required." },
        { status: 400 },
      );
    }

    if (
      !context ||
      !context.cards ||
      !Array.isArray(context.cards) ||
      context.cards.length === 0
    ) {
      return NextResponse.json(
        { error: "Generated cards context is required for the assistant." },
        { status: 400 },
      );
    }

    const {
      originalPrompt = "",
      platform = "Instagram Carousel",
      tone = "Professional",
      aspectRatio = "4:5",
      cards,
    } = context;

    // Build conversation history for multi-turn support
    const conversationHistory: { role: string; text: string }[] = [];

    // Include prior messages if provided (for multi-turn)
    if (body.history && Array.isArray(body.history)) {
      for (const h of body.history) {
        if (h.role === "user") {
          conversationHistory.push({ role: "user", text: h.text });
        } else if (h.role === "assistant") {
          conversationHistory.push({ role: "model", text: h.text });
        }
      }
    }

    // Add current message
    conversationHistory.push({ role: "user", text: message });

    const systemInstruction = buildAssistantSystemInstruction({
      originalPrompt,
      cards: cards.map((c: any) => ({
        title: c.title || "",
        content: c.content || "",
      })),
      platform,
      tone,
      aspectRatio,
    });

    let lastError: any = null;

    for (const model of GEMINI_TEXT_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: conversationHistory.map((m) => ({
              role: m.role as "user" | "model",
              parts: [{ text: m.text }],
            })),
            config: {
              systemInstruction,
              thinkingConfig: { thinkingBudget: 0 },
              // Plain text response, no JSON schema
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from assistant");

          return NextResponse.json({ reply: text.trim() });
        } catch (err: any) {
          lastError = err;
          const status = err?.status ?? err?.response?.status;

          if (status === 429 && attempt === 0) {
            console.warn(
              `[assistant-chat] Rate-limited on ${model}, retrying in 3s…`,
            );
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          console.warn(
            `[assistant-chat] ${model} failed (attempt ${attempt + 1}):`,
            err.message ?? err,
          );
          break;
        }
      }
    }

    return NextResponse.json(
      {
        error:
          lastError?.message ||
          "Assistant failed across all models. Please try again in a minute.",
      },
      { status: 503 },
    );
  } catch (error: any) {
    console.error("Assistant Chat Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get assistant response" },
      { status: 500 },
    );
  }
}
