"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { UstazShell } from "@/components/ustaz-shell";
import { createClient } from "@/lib/supabase/client";

export default function UstazFeedbackPage() {
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedback.trim().length < 3) { setMessage("እባክዎ አስተያየትዎን ይጻፉ።"); return; }
    setSaving(true);
    const supabase = createClient();
    const [{ data: { user } }, { data: period }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { error } = !user || !period ? { error: new Error("የመለያ ወይም የፈተና መረጃ አልተገኘም።") } : await supabase.from("ustaz_exam_feedback").insert({ exam_period_id: period.id, ustaz_id: user.id, message: feedback.trim() });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setFeedback(""); setMessage("አስተያየትዎ ተልኳል።");
  }

  return <UstazShell><header className="ustaz-results-header"><Link className="back-link" href="/results">← ወደ ውጤቶች</Link><p className="eyebrow">አስተያየትና ሀሳብ</p><h1>አስተያየትና ሀሳብ</h1><p>የዚህን ፈተና ሂደት ለወደፊት ለማሻሻል አስተያየትዎን ይጻፉ።</p></header>{message && <p className="admin-message">{message}</p>}<form className="ustaz-action-form" onSubmit={submit}><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} minLength={3} required placeholder="አስተያየትዎን እዚህ ይጻፉ" /><button className="primary-button" disabled={saving}>{saving ? "በመላክ ላይ…" : "አስተያየት ላክ"}</button></form></UstazShell>;
}
