import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";
import {
  assertDailyQuotaAvailable,
  consumeDailyQuota,
  enforceIpRateLimit,
  recordAiUsageEvent,
  toAiSecurityErrorResponse,
  ValidationError,
  QuotaExceededError,
} from "@/lib/server/ai-security";

// Model fallback chain
const GEMINI_TEXT_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

type AssistantHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

type AssistantContextCard = {
  title: string;
  content: string;
};

type AssistantPayload = {
  message: string;
  history: AssistantHistoryItem[];
  context: {
    originalPrompt: string;
    platform: string;
    tone: string;
    aspectRatio: string;
    cards: AssistantContextCard[];
  };
};

function validateAssistantPayload(payload: unknown): AssistantPayload {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid request payload.");
  }

  const raw = payload as Record<string, unknown>;
  const message = raw.message;

  if (typeof message !== "string" || !message.trim()) {
    throw new ValidationError("A message is required.");
  }

  const normalizedMessage = message.trim();
  if (normalizedMessage.length > 2_000) {
    throw new ValidationError(
      "Message is too long. Max length is 2000 characters.",
    );
  }

  const context = raw.context;
  if (!context || typeof context !== "object") {
    throw new ValidationError(
      "Generated cards context is required for the assistant.",
    );
  }

  const contextObj = context as Record<string, unknown>;
  const cardsRaw = contextObj.cards;
  if (!Array.isArray(cardsRaw) || cardsRaw.length === 0) {
    throw new ValidationError(
      "Generated cards context is required for the assistant.",
    );
  }

  if (cardsRaw.length > 20) {
    throw new ValidationError("Too many cards provided. Max is 20.");
  }

  const cards = cardsRaw.map((card, index) => {
    if (!card || typeof card !== "object") {
      throw new ValidationError(`Card ${index + 1} is invalid.`);
    }

    const cardObj = card as Record<string, unknown>;
    const title = typeof cardObj.title === "string" ? cardObj.title.trim() : "";
    const content =
      typeof cardObj.content === "string" ? cardObj.content.trim() : "";

    if (!title || !content) {
      throw new ValidationError(
        `Card ${index + 1} must include title and content.`,
      );
    }

    if (title.length > 200 || content.length > 2_000) {
      throw new ValidationError(`Card ${index + 1} text is too long.`);
    }

    return { title, content };
  });

  const historyRaw = raw.history;
  const history: AssistantHistoryItem[] = [];

  if (historyRaw != null) {
    if (!Array.isArray(historyRaw)) {
      throw new ValidationError("Conversation history must be an array.");
    }

    if (historyRaw.length > 20) {
      throw new ValidationError(
        "Conversation history is too long. Max 20 messages.",
      );
    }

    for (const entry of historyRaw) {
      if (!entry || typeof entry !== "object") {
        throw new ValidationError("History contains an invalid entry.");
      }

      const entryObj = entry as Record<string, unknown>;
      const role = entryObj.role;
      const text = entryObj.text;

      if (
        (role !== "user" && role !== "assistant") ||
        typeof text !== "string"
      ) {
        throw new ValidationError(
          "History contains an invalid role or message.",
        );
      }

      const normalizedText = text.trim();
      if (!normalizedText || normalizedText.length > 2_000) {
        throw new ValidationError(
          "History message length must be between 1 and 2000.",
        );
      }

      history.push({ role, text: normalizedText });
    }
  }

  const normalizedOriginalPrompt =
    typeof contextObj.originalPrompt === "string"
      ? contextObj.originalPrompt.trim().slice(0, 2_000)
      : "";
  const normalizedPlatform =
    typeof contextObj.platform === "string" && contextObj.platform.trim()
      ? contextObj.platform.trim().slice(0, 80)
      : "Instagram Carousel";
  const normalizedTone =
    typeof contextObj.tone === "string" && contextObj.tone.trim()
      ? contextObj.tone.trim().slice(0, 80)
      : "Professional";
  const normalizedAspectRatio =
    typeof contextObj.aspectRatio === "string" && contextObj.aspectRatio.trim()
      ? contextObj.aspectRatio.trim().slice(0, 20)
      : "4:5";

  return {
    message: normalizedMessage,
    history,
    context: {
      originalPrompt: normalizedOriginalPrompt,
      platform: normalizedPlatform,
      tone: normalizedTone,
      aspectRatio: normalizedAspectRatio,
      cards,
    },
  };
}

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

function getGeminiToken(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_PUBLIC_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ""
  )
    .replace(/['"]/g, "")
    .trim();
}

// POST handler
export async function POST(req: Request) {
  let uid = "";
  let messageLength = 0;
  let historyCount = 0;
  let cardsCount = 0;
  let selectedModel = "";

  try {
    const decodedToken = await requireAuthenticatedUser(req);
    uid = decodedToken.uid;

    enforceIpRateLimit(req, "assistant-chat");

    const key = getGeminiToken();

    if (!key) {
      return NextResponse.json(
        { error: "Gemini API key is not configured." },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: key });

    const body = validateAssistantPayload(await req.json());
    const { message, context, history } = body;

    messageLength = message.length;
    historyCount = history.length;
    cardsCount = context.cards.length;

    await assertDailyQuotaAvailable(uid, "assistant-chat");

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
    if (history.length > 0) {
      for (const h of history) {
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
    let finalReply: string | null = null;

    outer: for (const model of GEMINI_TEXT_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          selectedModel = model;

          const response = await ai.models.generateContent({
            model,
            contents: conversationHistory.map((m) => ({
              role: m.role as "user" | "model",
              parts: [{ text: m.text }],
            })),
            config: {
              systemInstruction,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from assistant");

          finalReply = text.trim();
          break outer;
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

    if (finalReply) {
      try {
        const quota = await consumeDailyQuota(uid, "assistant-chat");

        await recordAiUsageEvent({
          uid,
          endpoint: "assistant-chat",
          success: true,
          inputChars: message.length,
          outputChars: finalReply.length,
          model: selectedModel,
          metadata: {
            historyCount: history.length,
            cardsCount: context.cards.length,
            platform,
            quotaRemaining: quota.remaining,
          },
        });

        return NextResponse.json({
          reply: finalReply,
          quotaRemaining: quota.remaining,
        });
      } catch (postError: any) {
        if (postError instanceof QuotaExceededError) {
          throw postError;
        }
        console.error("[assistant-chat] Post-processing error:", postError);
        // Still return the reply even if telemetry fails
        return NextResponse.json({
          reply: finalReply,
          quotaRemaining: null,
        });
      }
    }

    const rawError = lastError?.message || "All models failed";
    console.error("[assistant-chat] Assistant failed across all models:", rawError);

    let errorMsg = "The AI Assistant is temporarily unavailable. Please try again in a few moments.";
    if (rawError.toLowerCase().includes("quota") || rawError.includes("429")) {
      errorMsg = "Assistant is currently experiencing high demand. Please try again soon.";
    } else if (rawError.toLowerCase().includes("not configured") || rawError.toLowerCase().includes("not found")) {
      errorMsg = "AI configuration is being updated. Please try again shortly.";
    }

    return NextResponse.json(
      { error: errorMsg },
      { status: 503 },
    );
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    console.error("[assistant-chat] Unhandled Error:", error);
    const securityError = toAiSecurityErrorResponse(error);
    if (securityError) {
      if (uid) {
        await recordAiUsageEvent({
          uid,
          endpoint: "assistant-chat",
          success: false,
          inputChars: messageLength || undefined,
          model: selectedModel || undefined,
          error: error?.message,
          metadata: {
            historyCount: historyCount || undefined,
            cardsCount: cardsCount || undefined,
            errorType: error?.name || "SecurityError",
          },
        });
      }

      return securityError;
    }

    if (uid) {
      await recordAiUsageEvent({
        uid,
        endpoint: "assistant-chat",
        success: false,
        inputChars: messageLength || undefined,
        model: selectedModel || undefined,
        error: error?.message,
        metadata: {
          historyCount: historyCount || undefined,
          cardsCount: cardsCount || undefined,
          errorType: error?.name || "UnhandledError",
        },
      });
    }

    console.error("Assistant Chat Error:", error);
    return NextResponse.json(
      { error: "Assistant could not process that request. Please try again." },
      { status: 500 },
    );
  }
}
