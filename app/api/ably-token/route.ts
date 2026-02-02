import { NextResponse } from "next/server";
import Ably from "ably/promises";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Missing ABLY_API_KEY",
        troubleshooting: [
          "Ensure ABLY_API_KEY is set in Vercel Project Settings → Environment Variables.",
          "Verify it is added to the correct environment (Production/Preview/Development).",
          "Trigger a new deployment after adding the variable.",
        ],
        runtime: process.env.NODE_ENV ?? "unknown",
      },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  const rest = new Ably.Rest(apiKey);
  const tokenRequest = await rest.auth.createTokenRequest(clientId ? { clientId } : undefined);
  return NextResponse.json(tokenRequest);
}
