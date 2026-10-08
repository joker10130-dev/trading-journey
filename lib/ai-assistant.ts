import { z } from "zod";

const providerResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable() }),
  })).min(1),
});

export class AiProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

export async function requestAiJson<T extends z.ZodType>(
  schema: T,
  systemPrompt: string,
  userContent: string,
): Promise<z.output<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiProviderError("AI features are not configured. Add OPENAI_API_KEY on the server.", 503);

  let response: Response;
  let responseBody: unknown;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        store: false,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (response.ok) responseBody = await response.json();
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new AiProviderError("The AI provider timed out. Please try again.", 504);
    }
    if (error instanceof SyntaxError) {
      throw new AiProviderError("The AI provider returned an invalid response.", 502);
    }
    if (error instanceof TypeError) {
      throw new AiProviderError("The AI provider could not be reached. Please try again later.", 502);
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AiProviderError("The AI provider rejected the server API key.", 502);
    }
    if (response.status === 429) {
      throw new AiProviderError("The AI provider is rate-limiting requests. Please try again shortly.", 429);
    }
    throw new AiProviderError("The AI provider could not complete this request.", 502);
  }

  const providerData = providerResponseSchema.safeParse(responseBody);
  const content = providerData.success ? providerData.data.choices[0].message.content : null;
  if (!content) throw new AiProviderError("The AI provider returned an empty or invalid response.", 502);

  let result: unknown;
  try {
    result = JSON.parse(content);
  } catch {
    throw new AiProviderError("The AI provider returned an invalid JSON response.", 502);
  }
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new AiProviderError("The AI provider response did not match the expected format.", 502);
  return parsed.data;
}

export const emotionAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  composureScore: z.number().int().min(0).max(100),
  summary: z.string().trim().min(1).max(400),
  cues: z.array(z.string().trim().min(1).max(100)).max(4),
  reflectionQuestion: z.string().trim().min(1).max(200),
});

export const quickLogDraftSchema = z.object({
  pair: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).nullable(),
  side: z.enum(["BUY", "SELL"]).nullable(),
  entryPrice: z.number().finite().positive().nullable(),
  exitPrice: z.number().finite().positive().nullable(),
  stopLoss: z.number().finite().positive().nullable(),
  takeProfit: z.number().finite().positive().nullable(),
  lotSize: z.number().finite().positive().nullable(),
  pnl: z.number().finite().nullable(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  strategyTag: z.string().trim().max(80).nullable(),
  openedAt: z.iso.datetime({ offset: true }).nullable(),
  closedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const coachingResponseSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  patterns: z.array(z.object({
    observation: z.string().trim().min(1).max(280),
    evidenceIds: z.array(z.string().min(1).max(100)).max(6),
    confidence: z.enum(["low", "medium", "high"]),
  })).max(4),
  reflectionQuestion: z.string().trim().min(1).max(200),
});
