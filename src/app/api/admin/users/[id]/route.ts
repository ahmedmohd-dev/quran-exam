import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getAdminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: NextResponse.json({ error: "The server Admin key has not been configured." }, { status: 503 }) };
  return { admin: createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const connection = await getAdminClient();
  if (connection.error) return connection.error;
  const { id } = await params;
  const body = await request.json() as { fullName?: string; active?: boolean; password?: string; managerId?: string | null };
  if (body.password !== undefined) {
    if (body.password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    const { data: account, error: accountError } = await connection.admin.from("profiles").select("username").eq("id", id).maybeSingle();
    if (accountError || !account?.username) return NextResponse.json({ error: accountError?.message ?? "This account has no username." }, { status: 400 });
    const { error } = await connection.admin.auth.admin.updateUserById(id, {
      email: `${account.username}@users.merekez.local`,
      email_confirm: true,
      password: body.password,
    });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  const fullName = body.fullName?.trim();
  if (!fullName) return NextResponse.json({ error: "A full name is required." }, { status: 400 });
  const { error } = await connection.admin.from("profiles").update({ full_name: fullName, active: body.active ?? true, ...(body.managerId !== undefined ? { manager_id: body.managerId || null } : {}) }).eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const connection = await getAdminClient();
  if (connection.error) return connection.error;
  const { id } = await params;
  const { error } = await connection.admin.auth.admin.deleteUser(id);
  if (!error) return NextResponse.json({ ok: true });

  // Keep exam history and student ownership intact. Accounts with saved records
  // cannot be physically deleted because the database deliberately protects them.
  const errorCode = "code" in error && error.code ? String(error.code) : "";
  const errorText = `${error.message} ${errorCode}`;
  const isProtectedRecordError = /foreign key|violates.*constraint|constraint.*foreign|23503|database error deleting user|unexpected_failure/i.test(errorText);
  if (isProtectedRecordError) {
    const { error: disableError } = await connection.admin
      .from("profiles")
      .update({ active: false })
      .eq("id", id);
    if (!disableError) {
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "This account has saved student or exam records, so it was disabled instead of deleted. The records were preserved.",
      });
    }
    return NextResponse.json({ error: `The account could not be disabled: ${disableError.message}` }, { status: 400 });
  }

  return NextResponse.json({ error: error.message }, { status: 400 });
}
