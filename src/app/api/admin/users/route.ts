import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { fullName?: string; username?: string; password?: string; role?: string; managerId?: string | null; groupCode?: string };
  const fullName = body.fullName?.trim();
  const username = body.username?.trim().toLowerCase();
  const password = body.password;
  const role = body.role;
  const groupCode = body.groupCode === "girls" ? "girls" : "boys";
  if (!fullName || !username || !password || !["ustaz", "examiner", "director"].includes(role ?? "")) {
    return NextResponse.json({ error: "Complete all fields with a valid role." }, { status: 400 });
  }
  if (!usernamePattern.test(username)) return NextResponse.json({ error: "Username must use 3–32 lowercase letters, numbers, dots, dashes, or underscores." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "The server Admin key has not been configured." }, { status: 503 });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@users.merekez.local`,
    password,
    email_confirm: true,
  });
  if (createError || !createdUser.user) return NextResponse.json({ error: createError?.message ?? "Could not create the account." }, { status: 400 });

  const { error: profileError } = await admin.from("profiles").insert({
    id: createdUser.user.id,
    full_name: fullName,
    username,
    role,
    manager_id: role === "ustaz" ? body.managerId || null : null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: group } = await admin.from("exam_groups").select("id").eq("code", groupCode).maybeSingle();
  if (!group) {
    await admin.from("profiles").delete().eq("id", createdUser.user.id);
    await admin.auth.admin.deleteUser(createdUser.user.id);
    return NextResponse.json({ error: "The selected examination group is not configured." }, { status: 400 });
  }
  const { error: membershipError } = await admin.from("exam_group_memberships").insert({ exam_group_id: group.id, profile_id: createdUser.user.id });
  if (membershipError) {
    await admin.from("profiles").delete().eq("id", createdUser.user.id);
    await admin.auth.admin.deleteUser(createdUser.user.id);
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
