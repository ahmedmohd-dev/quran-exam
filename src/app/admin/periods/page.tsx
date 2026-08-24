"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Override = "automatic" | "force_open" | "force_closed";
type Control = {
  id: string; name: string; academic_year: string; status: string;
  registration_opens_at: string | null; registration_closes_at: string | null;
  registration_override: Override; exam_marking_opens_at: string | null;
  exam_marking_closes_at: string | null; exam_marking_override: Override;
  ustaz_access_blocked: boolean; results_published: boolean;
};

function localDateTime(value: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
function registrationOpen(control: Control | null) {
  if (!control) return false;
  if (control.registration_override === "force_open") return true;
  if (control.registration_override === "force_closed") return false;
  const now = new Date();
  return (!control.registration_opens_at || new Date(control.registration_opens_at) <= now) && (!control.registration_closes_at || new Date(control.registration_closes_at) > now);
}
function markingOpen(control: Control | null) {
  if (!control) return false;
  if (control.exam_marking_override === "force_open") return true;
  if (control.exam_marking_override === "force_closed") return false;
  const now = new Date();
  return (!control.exam_marking_opens_at || new Date(control.exam_marking_opens_at) <= now) && (!control.exam_marking_closes_at || new Date(control.exam_marking_closes_at) > now);
}

export default function PeriodsPage() {
  const [control, setControl] = useState<Control | null>(null);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);

  async function loadControl() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("exam_periods").select("id,name,academic_year,status,registration_opens_at,registration_closes_at,registration_override,exam_marking_opens_at,exam_marking_closes_at,exam_marking_override,ustaz_access_blocked,results_published").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { setMessage(error.message); return; }
    setControl(data as Control | null);
    setMessage("");
  }
  useEffect(() => { const timer = window.setTimeout(() => void loadControl(), 0); return () => window.clearTimeout(timer); }, []);

  async function saveRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    const form = new FormData(event.currentTarget);
    const starts = String(form.get("startsAt") ?? ""); const ends = String(form.get("endsAt") ?? "");
    const payload = { name: String(form.get("name") ?? "").trim() || "Current Qur'an Revision Examination", academic_year: String(form.get("academicYear") ?? "").trim() || "Current session", registration_opens_at: starts ? new Date(starts).toISOString() : null, registration_closes_at: ends ? new Date(ends).toISOString() : null };
    const result = control ? await createClient().from("exam_periods").update(payload).eq("id", control.id) : await createClient().from("exam_periods").insert({ ...payload, status: "registration_closed" });
    setSaving(false); setMessage(result.error ? result.error.message : "Registration settings saved."); if (!result.error) await loadControl();
  }

  async function saveMarking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!control) return; setSaving(true);
    const form = new FormData(event.currentTarget); const starts = String(form.get("markingStartsAt") ?? ""); const ends = String(form.get("markingEndsAt") ?? "");
    const result = await createClient().from("exam_periods").update({ exam_marking_opens_at: starts ? new Date(starts).toISOString() : null, exam_marking_closes_at: ends ? new Date(ends).toISOString() : null }).eq("id", control.id);
    setSaving(false); setMessage(result.error ? result.error.message : "Examiner marking dates saved."); if (!result.error) await loadControl();
  }

  async function updateOverride(column: "registration_override" | "exam_marking_override", value: Override) {
    if (!control) return; setSaving(true);
    const payload = column === "registration_override" ? { registration_override: value, registration_force_open: value === "force_open", status: value === "force_open" ? "registration_open" : value === "force_closed" ? "registration_closed" : control.status } : { exam_marking_override: value };
    const { error } = await createClient().from("exam_periods").update(payload).eq("id", control.id);
    setSaving(false); setMessage(error ? error.message : "Control updated."); await loadControl();
  }

  async function blockUstazes(blocked: boolean) {
    if (!control) return; setSaving(true);
    const { error } = await createClient().from("exam_periods").update({ ustaz_access_blocked: blocked }).eq("id", control.id);
    setSaving(false); setMessage(error ? error.message : blocked ? "Ustaz sign-in is blocked." : "Ustaz sign-in is enabled."); await loadControl();
  }

  async function publishResults(published: boolean) {
    if (!control) return; setSaving(true);
    const { error } = await createClient().from("exam_periods").update({ results_published: published }).eq("id", control.id);
    setSaving(false); setMessage(error ? error.message : published ? "Results are now visible to Ustazes." : "Results are hidden from Ustazes."); await loadControl();
  }

  const registration = registrationOpen(control); const marking = markingOpen(control); const blocked = control?.ustaz_access_blocked ?? false;
  return <AdminShell active="periods">
    <header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · CONTROLS</p><h1>Registration control</h1><p>Registration settings are kept separate from Examiner marking settings.</p></div></header>
    <section className="admin-grid">
      <form className="admin-card" key={control?.id ?? "new"} onSubmit={saveRegistration}><p className="eyebrow">REGISTRATION</p><h2>Ustaz registration</h2><label>Examination name<input name="name" defaultValue={control?.name ?? "Current Qur'an Revision Examination"} /></label><label>Academic year<input name="academicYear" defaultValue={control?.academic_year ?? "Current session"} /></label><label>Registration starts<input name="startsAt" type="datetime-local" defaultValue={localDateTime(control?.registration_opens_at ?? null)} /></label><label>Registration ends<input name="endsAt" type="datetime-local" defaultValue={localDateTime(control?.registration_closes_at ?? null)} /></label><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save registration settings"}</button></form>
      <section className="admin-card registration-status-card"><p className="eyebrow">REGISTRATION STATUS</p><div className={`registration-status ${registration ? "open" : "closed"}`}><span>{registration ? "●" : "○"}</span><div><strong>{registration ? "Registration is open" : "Registration is closed"}</strong><p>{registration ? "Ustazes can register and edit students." : "Ustazes cannot add or change registrations."}</p></div></div>{control && <><div className="registration-actions"><button className="open-button" type="button" onClick={() => void updateOverride("registration_override", "force_open")} disabled={saving}>Force open registration</button><button className="danger-button" type="button" onClick={() => void updateOverride("registration_override", "force_closed")} disabled={saving}>Force close registration</button><button className="secondary-button" type="button" onClick={() => void updateOverride("registration_override", "automatic")} disabled={saving}>Use registration dates</button></div><div className="admin-access-control"><div><strong>Ustaz sign-in access</strong><p>{blocked ? "Blocked while results are managed." : "Enabled."}</p></div><button className={blocked ? "open-button" : "danger-button"} type="button" onClick={() => void blockUstazes(!blocked)} disabled={saving}>{blocked ? "Enable Ustaz access" : "Block Ustazes"}</button></div></>}</section>
    </section>
    <section className="admin-card examiner-control-card"><div className="card-title"><div><p className="eyebrow">EXAMINER CONTROL</p><h2>Exam marking access</h2><p>These controls affect only Examiner mark entry. They do not change Ustaz registration.</p></div><div className={`registration-status ${marking ? "open" : "closed"}`}><span>{marking ? "●" : "○"}</span><strong>{marking ? "Marking open" : "Marking closed"}</strong></div></div>{control && <><form className="admin-grid" onSubmit={saveMarking}><label>Marking starts<input name="markingStartsAt" type="datetime-local" defaultValue={localDateTime(control.exam_marking_opens_at)} /></label><label>Marking ends<input name="markingEndsAt" type="datetime-local" defaultValue={localDateTime(control.exam_marking_closes_at)} /></label><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Examiner dates"}</button></form><div className="registration-actions"><button className="open-button" type="button" onClick={() => void updateOverride("exam_marking_override", "force_open")} disabled={saving}>Force open marking</button><button className="danger-button" type="button" onClick={() => void updateOverride("exam_marking_override", "force_closed")} disabled={saving}>Force close marking</button><button className="secondary-button" type="button" onClick={() => void updateOverride("exam_marking_override", "automatic")} disabled={saving}>Use marking dates</button></div></>}</section>
    <section className="admin-card"><p className="eyebrow">RESULT VISIBILITY</p><h2>Ustaz result access</h2><p>{control?.results_published ? "Submitted results are visible to Ustazes." : "Submitted results are currently hidden from Ustazes."}</p>{control && <button className={control.results_published ? "danger-button" : "open-button"} type="button" onClick={() => void publishResults(!control.results_published)} disabled={saving}>{control.results_published ? "Hide results from Ustazes" : "Publish results to Ustazes"}</button>}</section>
    {message && <p className="admin-message">{message}</p>}
  </AdminShell>;
}
