import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let payload: { email?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Please enter your username and password." }, { status: 400 });
  }

  const login = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!login || !password) {
    return NextResponse.json({ error: "Please enter your username and password." }, { status: 400 });
  }

  const email = login.includes("@") ? login : `${login}@users.merekez.local`;
  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const detail = process.env.NODE_ENV === "development" && error?.message
      ? `Sign-in failed: ${error.message}`
      : "Your email address or password is incorrect. Please try again.";
    return NextResponse.json({ error: detail }, { status: 401 });
  }

  return response;
}
