import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", checks: { database: "ok" } });
  } catch {
    return NextResponse.json(
      { status: "unhealthy", checks: { database: "unavailable" } },
      { status: 503 },
    );
  }
}
