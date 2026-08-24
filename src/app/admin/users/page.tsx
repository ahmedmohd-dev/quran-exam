"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminShell } from "@/components/admin-shell";

type Profile = { id: string; full_name: string; username: string | null; ustaz_code: string | null; role: string; active: boolean };

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("Loading accounts…");
  const [saving, setSaving] = useState(false);

  async function loadProfiles() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: currentProfile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (currentProfile?.role !== "admin") {
      setMessage("Only the Exam Admin can manage accounts.");
      return;
    }
    const { data, error } = await supabase.from("profiles").select("id, full_name, username, ustaz_code, role, active").order("created_at");
    if (error) {
      setMessage("Could not load accounts. Please check your connection.");
      return;
    }
    setProfiles(data ?? []);
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadProfiles(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        username: form.get("username"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? "Could not create the account.");
      return;
    }
    formElement.reset();
    setMessage("Account created successfully.");
    await loadProfiles();
  }

  async function editProfile(profile: Profile) {
    const fullName = window.prompt("Full name", profile.full_name);
    if (!fullName?.trim()) return;
    const response = await fetch(`/api/admin/users/${profile.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: fullName.trim(), active: profile.active }) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Account updated." : result.error ?? "Could not update the account.");
    await loadProfiles();
  }

  async function resetPassword(profile: Profile) {
    const password = window.prompt(`New password for ${profile.username ?? profile.full_name} (at least 8 characters)`);
    if (!password) return;
    const response = await fetch(`/api/admin/users/${profile.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Password reset successfully. The account and assignments were preserved." : result.error ?? "Could not reset the password.");
  }

  async function deleteProfile(profile: Profile) {
    if (!window.confirm(`Delete ${profile.full_name}'s account? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/users/${profile.id}`, { method: "DELETE" });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Account deleted." : result.error ?? "Could not delete the account.");
    await loadProfiles();
  }

  return (
    <AdminShell active="users">
      <header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · SETUP</p><h1>User accounts</h1><p>Create simple username-and-password accounts for Ustazes, Examiners, and the Director.</p></div><div className="workspace-step"><span>2</span><div><strong>Setup step</strong><small>People & permissions</small></div></div></header>
      <section className="admin-grid">
        <form className="admin-card account-create-form" onSubmit={createUser}>
          <h2>Create an account</h2>
          <label className="account-full-name">Full name<input name="fullName" required placeholder="Ustaz Abubakar" /></label>
          <label>Username<input name="username" required pattern="[a-z0-9._-]{3,32}" title="Use 3–32 lowercase letters, numbers, dots, dashes, or underscores." placeholder="ustaz.abubakar" /></label>
          <label>Temporary password<input name="password" required minLength={8} type="password" autoComplete="new-password" /></label>
          <label className="account-role">Role<select name="role" defaultValue="ustaz"><option value="ustaz">Ustaz</option><option value="examiner">Examiner</option><option value="director">Director Ustaz</option></select></label>
          <button className="account-create-button" type="submit" disabled={saving}>{saving ? "Creating…" : "Create account"}</button>
        </form>
        <section className="admin-card"><div className="card-title"><div><h2>Accounts</h2><p>Each person can sign in with their own username.</p></div><span>{profiles.length}</span></div>{message && <p className="admin-message">{message}</p>}{profiles.map((profile) => <article className="period-row" key={profile.id}><div><strong>{profile.full_name}</strong><span>{profile.ustaz_code ? `${profile.ustaz_code} · ` : ""}{profile.username ?? "Admin email account"} · {profile.role}</span></div><div className="account-actions"><span className={`tag ${profile.active ? "complete" : "attention"}`}>{profile.active ? "Active" : "Inactive"}</span><button type="button" className="text-button" onClick={() => editProfile(profile)}>Edit</button>{profile.username && <button type="button" className="text-button" onClick={() => resetPassword(profile)}>Reset password</button>}<button type="button" className="text-button delete-button" onClick={() => deleteProfile(profile)}>Delete</button></div></article>)}{!message && profiles.length === 0 && <div className="empty-state"><span>◉</span><strong>No accounts yet</strong><p>Create Ustaz accounts first. They will only see students assigned under their own account.</p></div>}</section>
      </section>
    </AdminShell>
  );
}
