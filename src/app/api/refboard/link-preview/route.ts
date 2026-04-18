import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }

  const favicon = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlanAProject/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ title: parsed.hostname, favicon });

    const html = await res.text();
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const title = (ogTitle ?? pageTitle ?? parsed.hostname).trim();

    return NextResponse.json({ title, favicon });
  } catch {
    return NextResponse.json({ title: parsed.hostname, favicon });
  }
}
