import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionProvider } from "@/lib/db";
import { previewCascade, type CascadeNodeRequest } from "@/lib/cascade";
import { sanitizeError } from "@/lib/security";
import { queryLimiter } from "@/lib/rate-limit";
import { validateIdentifier } from "@/lib/mutation";

interface RequestBody {
  deletes: CascadeNodeRequest[];
  options?: {
    timeBudgetMs?: number;
    maxDepth?: number;
    maxPerTable?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("db-session")?.value;

    const rl = queryLimiter.check(sessionId || "anonymous");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      );
    }

    const { provider } = await getSessionProvider();
    const body: RequestBody = await request.json();

    if (!Array.isArray(body.deletes) || body.deletes.length === 0) {
      return NextResponse.json(
        { error: "`deletes` must be a non-empty array" },
        { status: 400 }
      );
    }

    for (let i = 0; i < body.deletes.length; i++) {
      const d = body.deletes[i];
      if (!d || typeof d !== "object") {
        return NextResponse.json(
          { error: `deletes[${i}] is not an object` },
          { status: 400 }
        );
      }
      if (!d.schema || !d.table) {
        return NextResponse.json(
          { error: `deletes[${i}] missing schema or table` },
          { status: 400 }
        );
      }
      try {
        validateIdentifier(d.schema);
        validateIdentifier(d.table);
      } catch (err: any) {
        return NextResponse.json(
          { error: `deletes[${i}]: ${err.message}` },
          { status: 400 }
        );
      }
      if (!Array.isArray(d.pks)) {
        return NextResponse.json(
          { error: `deletes[${i}].pks must be an array` },
          { status: 400 }
        );
      }
    }

    const result = await previewCascade({
      provider,
      deletes: body.deletes,
      options: body.options,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const message = sanitizeError(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
