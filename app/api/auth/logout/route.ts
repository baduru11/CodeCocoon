import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear the persisted GitHub provider token cookie
  response.cookies.set("gh_provider_token", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
