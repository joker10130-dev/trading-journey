import { NextResponse } from "next/server";
import { z } from "zod";

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { response: apiError(400, "INVALID_JSON", "Request body must be valid JSON.") };
    }
    throw error;
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: apiError(400, "VALIDATION_ERROR", "Request validation failed.", result.error.issues),
    };
  }
  return { data: result.data };
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
