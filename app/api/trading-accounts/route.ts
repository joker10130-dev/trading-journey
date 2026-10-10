import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { apiError, hasSameOrigin, parseJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { tradingAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, baseCurrency: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return apiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  const auth = await requireApiUser();
  if (!auth.user) return auth.response;
  const parsed = await parseJson(request, tradingAccountSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const account = await prisma.tradingAccount.create({
      data: { userId: auth.user.id, name: parsed.data.name, baseCurrency: parsed.data.baseCurrency },
      select: { id: true, name: true, baseCurrency: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return apiError(409, "DUPLICATE_ACCOUNT", "An account with this name already exists.");
    }
    throw error;
  }
}
