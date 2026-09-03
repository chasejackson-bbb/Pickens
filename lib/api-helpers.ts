import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function handleRoute<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(err.errors.map((e) => e.message).join("; "), 422);
    }
    if (err instanceof Error) {
      return jsonError(err.message, 400);
    }
    return jsonError("Unknown error", 500);
  }
}
