import { metrics, type Attributes } from "@opentelemetry/api";

const meter = metrics.getMeter("trading-journey");
const aiRequests = meter.createCounter("trading_journey_ai_requests", {
  description: "AI feature requests by feature and outcome; contains no user or prompt data.",
});
const aiDuration = meter.createHistogram("trading_journey_ai_duration_ms", {
  description: "Duration of AI feature requests in milliseconds.",
  unit: "ms",
});
const aiPromptTokens = meter.createHistogram("trading_journey_ai_prompt_tokens", {
  description: "Prompt tokens reported by the AI provider.",
  unit: "{token}",
});
const aiCompletionTokens = meter.createHistogram("trading_journey_ai_completion_tokens", {
  description: "Completion tokens reported by the AI provider.",
  unit: "{token}",
});

export async function observeAiRequest<T>(feature: string, action: () => Promise<T>) {
  const startedAt = performance.now();
  let outcome = "success";
  let status = "200";
  try {
    return await action();
  } catch (error) {
    outcome = "error";
    status = error instanceof Error && "status" in error && typeof error.status === "number"
      ? String(error.status)
      : "500";
    throw error;
  } finally {
    const attributes: Attributes = { feature, outcome, status };
    aiRequests.add(1, attributes);
    aiDuration.record(performance.now() - startedAt, attributes);
  }
}

export function recordAiTokenUsage(feature: string, promptTokens: number, completionTokens: number) {
  const attributes = { feature };
  aiPromptTokens.record(promptTokens, attributes);
  aiCompletionTokens.record(completionTokens, attributes);
}
