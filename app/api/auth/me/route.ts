import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  return NextResponse.json({ user: auth.user });
}
