import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiProviderError,
  coachingResponseSchema,
  emotionAnalysisSchema,
  quickLogDraftSchema,
  requestAiJson,
} from "@/lib/ai-assistant";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI output validation", () => {
  it("accepts bounded emotion analysis with a calibrated score", () => {
    expect(emotionAnalysisSchema.safeParse({
      sentiment: "mixed",
      composureScore: 72,
      summary: "The note describes a deliberate plan with some frustration.",
      cues: ["frustration"],
      reflectionQuestion: "What would help you follow the plan next time?",
    }).success).toBe(true);
    expect(emotionAnalysisSchema.safeParse({
      sentiment: "mixed",
      composureScore: 140,
      summary: "Out of range",
      cues: [],
      reflectionQuestion: "Review the plan?",
    }).success).toBe(false);
  });

  it("allows missing quick-log values instead of filling unknown trade facts", () => {
    const draft = quickLogDraftSchema.safeParse({
      pair: "xauusd",
      side: "BUY",
      entryPrice: 2650,
      exitPrice: null,
      stopLoss: 2640,
      takeProfit: 2670,
      lotSize: 0.5,
      pnl: null,
      currency: "usd",
      strategyTag: null,
      openedAt: null,
      closedAt: null,
    });
    expect(draft.success).toBe(true);
    if (draft.success) expect(draft.data.pair).toBe("XAUUSD");
    expect(quickLogDraftSchema.safeParse({
      pair: null, side: null, entryPrice: null, exitPrice: null, stopLoss: null, takeProfit: null,
      lotSize: null, pnl: null, currency: "USD", strategyTag: null, openedAt: null, closedAt: null,
    }).success).toBe(true);
  });

  it("accepts coach evidence citations and rejects unsupported confidence labels", () => {
    const result = coachingResponseSchema.safeParse({
      summary: "Results varied across the reviewed records.",
      patterns: [{ observation: "A cautious observation.", evidenceIds: ["trade:abc"], confidence: "low" }],
      reflectionQuestion: "What did you notice?",
    });
    expect(result.success).toBe(true);
    expect(coachingResponseSchema.safeParse({
      summary: "Summary",
      patterns: [{ observation: "Claim", evidenceIds: [], confidence: "certain" }],
      reflectionQuestion: "Question?",
    }).success).toBe(false);
  });

  it("calls the provider only when configured and validates its JSON response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        sentiment: "neutral",
        composureScore: 55,
        summary: "The note is neutral.",
        cues: [],
        reflectionQuestion: "What was your plan?",
      }) } }],
    }), { status: 200 })));

    const result = await requestAiJson("emotion", emotionAnalysisSchema, "system", "private journal text");
    expect(result.composureScore).toBe(55);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("surfaces missing credentials and provider rate limits explicitly", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(requestAiJson("emotion", emotionAnalysisSchema, "system", "text"))
      .rejects.toBeInstanceOf(AiProviderError);

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429 })));
    await expect(requestAiJson("emotion", emotionAnalysisSchema, "system", "text"))
      .rejects.toMatchObject({ status: 429 });
  });
});
