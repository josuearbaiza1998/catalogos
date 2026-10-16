import { NextResponse } from "next/server";
import { dbEnabled, env, uploadsEnabled } from "@/lib/server/env";
import type { BackendCapabilities } from "@/lib/shared/domain";

export const dynamic = "force-dynamic";

export function GET() {
  const body: BackendCapabilities = { uploads: uploadsEnabled(), db: dbEnabled(), publicBaseUrl: env.assetsBaseUrl };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
