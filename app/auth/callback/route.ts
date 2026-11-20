
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeRedirectPath(value: string | null): string {
  if (!value) return "/choose-role";

  // Only allow local absolute paths.
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/choose-role";
  }

  try {
    const parsed = new URL(value, "https://bhoomisetu.local");

    if (parsed.origin !== "https://bhoomisetu.local") {
      return "/choose-role";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/choose-role";
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(
    request.nextUrl.searchParams.get("next")
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || !code) {
    return NextResponse.redirect(
      new URL("/signin?error=Authentication%20configuration%20or%20code%20missing", request.url)
    );
  }

  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/signin?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    );
  }

  return response;
}
