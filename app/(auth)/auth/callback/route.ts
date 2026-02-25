import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/connect";

  const redirectPath = next.startsWith("/") ? next : "/connect";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";

      let redirectUrl: string;
      if (isLocal) {
        redirectUrl = `${origin}${redirectPath}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${redirectPath}`;
      } else {
        redirectUrl = `${origin}${redirectPath}`;
      }

      const response = NextResponse.redirect(redirectUrl);

      // Persist the GitHub provider token in a secure cookie so it survives
      // page reloads. Supabase only includes provider_token transiently
      // in the session right after OAuth exchange.
      if (data.session?.provider_token) {
        response.cookies.set("gh_provider_token", data.session.provider_token, {
          httpOnly: true,
          secure: !isLocal,
          sameSite: "lax",
          path: "/",
          // Match Supabase session lifetime (default ~1 hour for provider tokens)
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`);
}
