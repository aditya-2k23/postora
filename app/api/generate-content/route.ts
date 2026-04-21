import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";
import {
  requireAuthenticatedUser,
  toApiAuthErrorResponse,
} from "@/lib/server/api-auth";
import { getFirebaseAdminDb } from "@/lib/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  assertDailyQuotaAvailable,
  consumeDailyQuota,
  enforceIpRateLimit,
  recordAiUsageEvent,
  toAiSecurityErrorResponse,
  ValidationError,
} from "@/lib/server/ai-security";

const GEMINI_TEXT_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

const cardSchema = {
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
        description:
          "A detailed AI image generation prompt for the background or accompanying image.",
      },
    },
    required: ["title", "content", "imagePrompt"],
  },
};

type NormalizedCard = {
  title: string;
  content: string;
  imagePrompt: string;
};

type GenerateContentPayload = {
  prompt: string;
  tone: string;
  platform: string;
  aspectRatio: string;
  numCards: number;
};

function validateGenerateContentPayload(
  payload: unknown,
): GenerateContentPayload {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Invalid request payload.");
  }

  const { prompt, tone, platform, aspectRatio, numCards } = payload as Record<
    string,
    unknown
  >;

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new ValidationError("A prompt is required.");
  }

  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length > 2_000) {
    throw new ValidationError(
      "Prompt is too long. Max length is 2000 characters.",
    );
  }

  const normalizedTone =
    typeof tone === "string" && tone.trim() ? tone.trim() : "Professional";
  if (normalizedTone.length > 80) {
    throw new ValidationError("Tone is too long. Max length is 80 characters.");
  }

  const normalizedPlatform =
    typeof platform === "string" && platform.trim()
      ? platform.trim()
      : "Instagram Carousel";
  if (normalizedPlatform.length > 80) {
    throw new ValidationError(
      "Platform is too long. Max length is 80 characters.",
    );
  }

  const normalizedAspectRatio =
    typeof aspectRatio === "string" && aspectRatio.trim()
      ? aspectRatio.trim()
      : "4:5";
  if (normalizedAspectRatio.length > 20) {
    throw new ValidationError(
      "Aspect ratio is too long. Max length is 20 characters.",
    );
  }

  const parsedCards =
    typeof numCards === "number"
      ? numCards
      : Number.parseInt(String(numCards), 10);

  if (!Number.isInteger(parsedCards) || parsedCards < 1 || parsedCards > 12) {
    throw new ValidationError(
      "Number of cards must be an integer between 1 and 12.",
    );
  }

  return {
    prompt: normalizedPrompt,
    tone: normalizedTone,
    platform: normalizedPlatform,
    aspectRatio: normalizedAspectRatio,
    numCards: parsedCards,
  };
}

function normalizeGeneratedCards(payload: unknown): NormalizedCard[] | null {
  const rawCards = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { cards?: unknown }).cards)
      ? (payload as { cards: unknown[] }).cards
      : null;

  if (!rawCards) return null;

  const normalized = rawCards
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const content =
        typeof item.content === "string"
          ? item.content.trim()
          : typeof item.body === "string"
            ? item.body.trim()
            : "";
      const imagePrompt =
        typeof item.imagePrompt === "string" ? item.imagePrompt.trim() : "";

      return { title, content, imagePrompt };
    })
    .filter(
      (card) =>
        card.title.length > 0 &&
        card.content.length > 0 &&
        card.imagePrompt.length > 0,
    );

  return normalized.length > 0 ? normalized : null;
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

export async function POST(req: Request) {
  let uid = "";
  let requestPromptLength = 0;
  let requestNumCards = 0;
  let requestPlatform = "";
  let selectedModel = "";
  let rawIdempotencyKey = req.headers.get("x-idempotency-key");
  let idempotencyKey: string | null = null;

  if (rawIdempotencyKey) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawIdempotencyKey)) {
      return NextResponse.json(
        { error: "Invalid idempotency key format." },
        { status: 400 },
      );
    }
    idempotencyKey = rawIdempotencyKey;
  }

  try {
    const decodedToken = await requireAuthenticatedUser(req);
    uid = decodedToken.uid;

    const db = getFirebaseAdminDb();
    if (idempotencyKey) {
      const idKeyRef = db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`);
      const IDEMPOTENCY_STALE_MS = 120_000; // 2 minutes

      const idempotencyResult = await db.runTransaction(async (transaction) => {
        const idSnap = await transaction.get(idKeyRef);
        if (idSnap.exists) {
          const data = idSnap.data();
          const status = data?.status;
          const createdAt = data?.createdAt?.toMillis?.() || 0;
          const now = Date.now();
          const isStale =
            status === "pending" && now - createdAt > IDEMPOTENCY_STALE_MS;

          // If completed, return it.
          // If pending and NOT stale, return exists: true (blocked).
          // If failed OR stale, we allow overwriting (return exists: false).
          if (status === "completed") {
            return { exists: true, data };
          }
          if (status === "pending" && !isStale) {
            return { exists: true, data };
          }
        }

        transaction.set(idKeyRef, {
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
        });
        return { exists: false };
      });

      if (idempotencyResult.exists) {
        const idData = idempotencyResult.data;
        if (idData?.status === "completed" && idData?.cards) {
          return NextResponse.json({
            cards: idData.cards,
            quotaRemaining: idData.quotaRemaining || 0,
            idempotent: true,
          });
        }

        // It was pending and not stale
        return NextResponse.json(
          {
            status: "processing",
            message:
              "A request with this key is already in progress. Please wait.",
            retry_after: 5,
          },
          { status: 202 },
        );
      }
    }

    enforceIpRateLimit(req, "generate-content");

    const key = getGeminiToken();

    if (!key) {
      if (idempotencyKey) {
        await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
          {
            status: "failed",
            error: "Gemini API key is not configured.",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Please add GEMINI_API_KEY or GEMINI_PUBLIC_KEY to your .env file.",
        },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: key });
    const { prompt, tone, platform, aspectRatio, numCards } =
      validateGenerateContentPayload(await req.json());

    requestPromptLength = prompt.length;
    requestNumCards = numCards;
    requestPlatform = platform;

    await assertDailyQuotaAvailable(uid, "generate-content");

    const systemInstruction = `
    You are not a chatbot.

    You are an AI content engine inside a social media design studio.

    Your only responsibility is to transform a rough user idea into a polished, visually-ready, high-performing social media carousel.

    The carousel should feel like it was created by an expert social media strategist, copywriter, educator, and designer working together.

    The output will be used directly inside a design tool, so the content must be concise, visual, emotionally engaging, and immediately usable.

    Return ONLY valid JSON.
    Do not include explanations, markdown, notes, labels, or any text outside the JSON.

    You are generating exactly ${numCards} cards for a ${platform} carousel.
    The overall tone is: ${tone}
    The aspect ratio is: ${aspectRatio}

    The carousel must create momentum:
    - Card 1 creates curiosity and a strong desire to swipe.
    - Early cards introduce the problem or surprising fact.
    - Middle cards explain why it happens or what most people misunderstand.
    - Later cards give a useful solution, insight, or takeaway.
    - The final card summarizes the main idea and includes a platform-specific CTA.
    - Every card should naturally lead to the next card.
    - No card should feel like a complete ending except the final card.

    CARD STRUCTURE RULES:

    1. Card 1 is always the HOOK card.
    - The title must be under 8 words.
    - The body must be under 20 words.
    - Start with one of:
      - A surprising fact
      - A bold question
      - A counterintuitive statement
      - A strong emotional tension
    - Create a knowledge gap that makes the user want to swipe.
    - Do not explain the full answer yet.

    2. Cards 2 through ${numCards - 1} are BODY cards.
    - Each card must communicate exactly ONE idea.
    - Never combine multiple ideas into the same card.
    - Each body should be 1 to 3 short sentences maximum.
    - No paragraph may exceed 2 sentences.
    - Keep the language concise and direct.
    - Avoid filler phrases like:
      - "In other words"
      - "Simply put"
      - "It is important to note"
      - "As we know"

    3. Card ${numCards} is always the CTA card.
    - Summarize the biggest takeaway in one sentence.
    - End with a platform-specific call to action.

    CTA rules:
    ${
      platform.includes("Instagram")
        ? `
    - End with one of:
      - "Save this for later."
      - "Share this with a parent."
      - "Send this to someone who needs it."
    `
        : ""
    }

    ${
      platform.includes("LinkedIn")
        ? `
    - End with one of:
      - "Follow for more insights."
      - "What do you think?"
      - "Drop your thoughts below."
    `
        : ""
    }

    ${
      platform.includes("X") || platform.includes("Twitter")
        ? `
    - End with one of:
      - "RT if this helped."
      - "What’s your take?"
      - "Reply with your experience."
    `
        : ""
    }

    ${
      platform.includes("TikTok")
        ? `
    - End with one of:
      - "Follow for more."
      - "Send this to a friend."
      - "Try this today."
    `
        : ""
    }

    WRITING STYLE RULES FOR ${platform}:

    ${
      platform.includes("Instagram")
        ? `
    - Write like you are texting a smart friend.
    - Use short punchy lines.
    - Emotional resonance matters more than statistics.
    - Sound natural, warm, and conversational.
    - Avoid corporate language.
    - Use line breaks where helpful.
    `
        : ""
    }

    ${
      platform.includes("LinkedIn")
        ? `
    - Sound professional but human.
    - Use short paragraphs.
    - Mention real-world impact where relevant.
    - You may use slightly longer sentences than Instagram.
    - Avoid sounding stiff or overly formal.
    `
        : ""
    }

    ${
      platform.includes("X") || platform.includes("Twitter")
        ? `
    - Every card should feel like a tweet.
    - Use short declarative sentences.
    - Be direct and opinionated.
    - No hedging or weak phrasing.
    `
        : ""
    }

    ${
      platform.includes("TikTok")
        ? `
    - Write like spoken dialogue.
    - High energy and fast-moving.
    - Use casual language.
    - Make it feel immediate and urgent.
    `
        : ""
    }

    TITLE RULES:
    - Every title must be specific.
    - Avoid generic titles like:
      - "Helpful Tip"
      - "Why This Matters"
      - "A Better Way"
    - Better examples:
      - "Why Kids Forget In 24 Hours"
      - "The 3-Day Memory Mistake"
      - "This Study Habit Backfires"
    - Every card title should use a different style:
      - Question
      - Shocking statement
      - Number
      - Command
      - Contradiction
    - Do not repeat title structures across cards.

    ANTI-REPETITION RULES:
    - Do not repeat the same wording across multiple cards.
    - Do not start every card with the same sentence pattern.
    - Vary sentence rhythm and emotional tone slightly between cards.
    - Each card should feel distinct while still fitting the same story.

    IMAGE PROMPT RULES:
    For every card, generate an imagePrompt that clearly describes a visual scene.

    Each imagePrompt must include:
    - Main subject
    - Background or setting
    - Mood or emotion
    - Lighting
    - Visual style
    - Composition

    The imagePrompt should feel specific enough for an image model to generate a compelling social media illustration.

    Bad imagePrompt:
    "A student learning"

    Good imagePrompt:
    "A tired child sitting at a desk while math formulas fade into the air around them, dim evening light, soft blue tones, minimalist flat illustration, centered composition, educational Instagram carousel style"

    Additional imagePrompt rules:
    - Never mention text overlays, captions, labels, or typography.
    - Never say "colorful background" without describing what is happening.
    - Keep the style visually consistent across all cards.
    - Match the imagePrompt to the meaning of the card.
    - Make the scene visually interesting and emotionally relevant.

    IMPORTANT:
    - The output must contain exactly ${numCards} cards.
    - Card roles must follow this order:
      - First card: "hook"
      - Middle cards: "body"
      - Last card: "cta"

    Return JSON in exactly this format:

    {
      "cards": [
        {
          "cardNumber": 1,
          "role": "hook",
          "title": "Why Kids Forget So Fast",
          "content": "Most children forget nearly half of what they learn within a day.",
          "imagePrompt": "A confused child looking at a blackboard that slowly fades into fog, soft morning light, minimalist illustration, centered composition"
        },
        {
          "cardNumber": 2,
          "role": "body",
          "title": "The Brain Deletes Unused Facts",
          "content": "Your brain removes information it thinks you do not need. No review means faster forgetting.",
          "imagePrompt": "A glowing memory shelf inside a child's mind with books disappearing one by one, dark background, soft blue lighting, flat illustration style"
        }
      ]
    }

    JSON RULES:
    - Return only raw JSON.
    - Do not wrap the JSON in markdown.
    - Do not include comments.
    - Do not include trailing commas.
    - The cards array must contain exactly ${numCards} objects.
    - cardNumber must start at 1 and increase sequentially.
    - role must only be one of: "hook", "body", "cta".
    `.trim();

    let lastError: any = null;
    let finalCards: any[] | null = null;

    outer: for (const model of GEMINI_TEXT_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          selectedModel = model;

          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: cardSchema,
              thinkingConfig: { thinkingBudget: 0 },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini");

          const parsed = JSON.parse(text);
          const cards = normalizeGeneratedCards(parsed);
          if (!cards) {
            throw new Error("Generator returned invalid cards format");
          }

          finalCards = cards;
          break outer;
        } catch (err: any) {
          lastError = err;
          const status = err?.status ?? err?.response?.status;

          if (status === 429 && attempt === 0) {
            console.warn(
              `[generate-content] Rate-limited on ${model}, retrying in 3s…`,
            );
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          console.warn(
            `[generate-content] ${model} failed (attempt ${attempt + 1}):`,
            err.message ?? err,
          );
          break;
        }
      }
    }

    if (finalCards) {
      try {
        const quota = await consumeDailyQuota(uid, "generate-content");

        await recordAiUsageEvent({
          uid,
          endpoint: "generate-content",
          success: true,
          inputChars: prompt.length,
          outputChars: JSON.stringify(finalCards).length,
          model: selectedModel,
          metadata: {
            numCards,
            platform,
            quotaRemaining: quota.remaining,
          },
        });

        if (idempotencyKey) {
          const db = getFirebaseAdminDb();
          await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
            {
              status: "completed",
              cards: finalCards,
              quotaRemaining: quota.remaining,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        return NextResponse.json({
          cards: finalCards,
          quotaRemaining: quota.remaining,
        });
      } catch (postError: any) {
        console.error("[generate-content] Post-processing error:", postError);
        return NextResponse.json({
          cards: finalCards,
          quotaRemaining: null,
        });
      }
    }

    // All models exhausted
    const rawError = lastError?.message || "Unknown exhaustion";
    console.error(
      "[generate-content] Generation failed across all models:",
      rawError,
    );

    let errorMsg =
      "Content generation is temporarily unavailable. Please try again in a few moments.";

    if (rawError.toLowerCase().includes("quota") || rawError.includes("429")) {
      errorMsg =
        "AI generation is currently experiencing high demand. Please try again in a few moments.";
    } else if (
      rawError.toLowerCase().includes("not configured") ||
      rawError.toLowerCase().includes("not found")
    ) {
      errorMsg =
        "The AI service is currently being updated. Please try again shortly.";
    }

    if (idempotencyKey) {
      const db = getFirebaseAdminDb();
      await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
        {
          status: "failed",
          error: errorMsg,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return NextResponse.json({ error: errorMsg }, { status: 503 });
  } catch (error: any) {
    const authError = toApiAuthErrorResponse(error);
    if (authError) return authError;

    const db = getFirebaseAdminDb();
    const securityError = toAiSecurityErrorResponse(error);

    // Log the unhandled error
    console.error("[generate-content] Unhandled Error:", error);
    if (securityError) {
      if (uid) {
        await recordAiUsageEvent({
          uid,
          endpoint: "generate-content",
          success: false,
          inputChars: requestPromptLength || undefined,
          model: selectedModel || undefined,
          error: error?.message,
          metadata: {
            numCards: requestNumCards || undefined,
            platform: requestPlatform || undefined,
            errorType: error?.name || "SecurityError",
          },
        });
      }

      if (idempotencyKey) {
        await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
          {
            status: "failed",
            error: error?.message,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return securityError;
    }

    if (uid) {
      await recordAiUsageEvent({
        uid,
        endpoint: "generate-content",
        success: false,
        inputChars: requestPromptLength || undefined,
        model: selectedModel || undefined,
        error: error?.message,
        metadata: {
          numCards: requestNumCards || undefined,
          platform: requestPlatform || undefined,
          errorType: error?.name || "UnhandledError",
        },
      });

      if (idempotencyKey) {
        await db.doc(`users/${uid}/idempotencyKeys/${idempotencyKey}`).set(
          {
            status: "failed",
            error: error?.message,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    const finalErrorMsg =
      "Failed to generate content. Please check your connection and try again.";

    return NextResponse.json({ error: finalErrorMsg }, { status: 500 });
  }
}
