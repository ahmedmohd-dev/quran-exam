import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname !== "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const { data: accessPeriod } = profile?.role === "ustaz"
      ? await supabase.from("exam_periods").select("ustaz_access_blocked").order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    if (profile?.role === "ustaz" && accessPeriod?.ustaz_access_blocked && !request.nextUrl.pathname.startsWith("/access-blocked")) {
      const url = request.nextUrl.clone();
      url.pathname = "/access-blocked";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname.startsWith("/examiner") && profile?.role !== "examiner") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname.startsWith("/director") && profile?.role !== "director") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname === "/" && profile?.role === "examiner") {
      const url = request.nextUrl.clone();
      url.pathname = "/examiner";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname === "/" && profile?.role === "director") {
      const url = request.nextUrl.clone();
      url.pathname = "/director";
      return NextResponse.redirect(url);
    }
    if (request.nextUrl.pathname === "/" && profile?.role === "ustaz") {
      const url = request.nextUrl.clone();
      url.pathname = "/results";
      return NextResponse.redirect(url);
    }
  }
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
