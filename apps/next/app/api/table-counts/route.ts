import { NextRequest, NextResponse } from "next/server";
import { getSessionProvider } from "@/lib/db";
import { sanitizeError } from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const schema = request.nextUrl.searchParams.get("schema") || "public";
    const { provider } = await getSessionProvider();
    const counts = await provider.getTableRowCounts(schema);
    return NextResponse.json({ counts });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
