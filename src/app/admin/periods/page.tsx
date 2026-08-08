"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AdminShell } from "@/components/admin-shell";

type RegistrationControl = {
  id: string;
  name: string;
  academic_year: string;
  status: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_force_open: boolean;
  registration_override: "automatic" | "force_open" | "force_closed";
};

function toLocalDateTime(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function registrationIsOpen(control: RegistrationControl | null) {
  if (!control) return false;
  if (control.registration_override === "force_open") return true;
  if (control.registration_override === "force_closed") return false;
  const now = new Date();
  if (!control.registration_opens_at && !control.registration_closes_at) return control.status === "registration_open";
  return (!control.registration_opens_at || new Date(control.registration_opens_at) <= now) && (!control.registration_closes_at || new Date(control.registration_closes_at) > now);
}

export default function PeriodsPage() {
  const [control, setControl] = useState<RegistrationControl | null>(null);
  const [message, setMessage] = useState("Loading registration settings…");
  const [saving, setSaving] = useState(false);

  async function loadControl() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      setMessage("Only the Exam Admin can change registration settings.");
      return;
    }
    const { data, error } = await supabase.from("exam_periods").select("id, name, academic_year, status, registration_opens_at, registration_closes_at, registration_force_open, registration_override").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      setMessage("Could not load registration settings. Please check your connection.");
      return;
    }
    setControl(data);
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadControl(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const start = String(form.get("startsAt") ?? "");
    const end = String(form.get("endsAt") ?? "");
    const payload = {
      name: String(form.get("name")).trim() || "Current Qur'an Revision Examination",
      academic_year: String(form.get("academicYear")).trim() || "Current session",
      registration_opens_at: start ? new Date(start).toISOString() : null,
      registration_closes_at: end ? new Date(end).toISOString() : null,
    };
    const supabase = createClient();
    const result = control
      ? await supabase.from("exam_periods").update(payload).eq("id", control.id)
      : await supabase.from("exam_periods").insert({ ...payload, status: "registration_closed" });
    setSaving(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Registration settings saved.");
    await loadControl();
  }

  async function setRegistrationOverride(registrationOverride: RegistrationControl["registration_override"]) {
    if (!control) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("exam_periods").update({
      status: registrationOverride === "force_open" ? "registration_open" : registrationOverride === "force_closed" ? "registration_closed" : control.status,
      registration_force_open: registrationOverride === "force_open",
      registration_override: registrationOverride,
    }).eq("id", control.id);
    setSaving(false);
    setMessage(error ? error.message : registrationOverride === "force_open" ? "Registration is forced open." : registrationOverride === "force_closed" ? "Registration is forced closed." : "The date rules are active again.");
    await loadControl();
  }

  const isOpen = registrationIsOpen(control);
  return (
    <AdminShell active="periods">
      <header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · REGISTRATION</p><h1>Registration control</h1><p>Use this one page for the current term. Set the registration dates, then open or close Ustaz registration whenever needed.</p></div><div className="workspace-step"><span>1</span><div><strong>Current session</strong><small>{isOpen ? "Registration open" : "Registration closed"}</small></div></div></header>
      <section className="admin-grid">
        <form className="admin-card" onSubmit={saveSettings}>
          <h2>Current examination</h2>
          <label>Examination name<input name="name" defaultValue={control?.name ?? "Current Qur'an Revision Examination"} /></label>
          <label>Academic year<input name="academicYear" defaultValue={control?.academic_year ?? "2018 ዓ.ም"} /></label>
          <label>Registration starts<input name="startsAt" type="datetime-local" defaultValue={toLocalDateTime(control?.registration_opens_at ?? null)} /></label>
          <label>Registration ends<input name="endsAt" type="datetime-local" defaultValue={toLocalDateTime(control?.registration_closes_at ?? null)} /></label>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save dates"}</button>
        </form>
        <section className="admin-card registration-status-card"><p className="eyebrow">CURRENT STATUS</p><div className={`registration-status ${isOpen ? "open" : "closed"}`}><span>{isOpen ? "●" : "○"}</span><div><strong>{isOpen ? "Registration is open" : "Registration is closed"}</strong><p>{isOpen ? "Ustazes can register and edit their students." : "Ustazes cannot add or change student registrations."}</p></div></div>{control ? <><div className="registration-dates"><div><span>Starts</span><strong>{control.registration_opens_at ? new Date(control.registration_opens_at).toLocaleString() : "Not set"}</strong></div><div><span>Ends</span><strong>{control.registration_closes_at ? new Date(control.registration_closes_at).toLocaleString() : "No end date"}</strong></div></div><div className="registration-actions"><button className="open-button" onClick={() => setRegistrationOverride("force_open")} disabled={saving}>Force open</button><button className="danger-button" onClick={() => setRegistrationOverride("force_closed")} disabled={saving}>Force close</button><button className="secondary-button" onClick={() => setRegistrationOverride("automatic")} disabled={saving}>Use dates</button></div></> : <div className="empty-state"><span>◷</span><strong>Set up the current session</strong><p>Save the dates first, then the registration controls will appear here.</p></div>}{message && <p className="admin-message">{message}</p>}</section>
      </section>
    </AdminShell>
  );
}
