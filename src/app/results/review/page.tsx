"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { UstazShell } from "@/components/ustaz-shell";
import { createClient } from "@/lib/supabase/client";

type Student = { id: string; student: { full_name: string } | null };

export default function UstazReviewRequestPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [ustazId, setUstazId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  const [saving, setSaving] = useState(false);

  useEffect(() => { async function load() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setMessage("እባክዎ እንደገና ይግቡ።"); return; } const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(); if (!period) { setMessage("የፈተና ወቅት አልተገኘም።"); return; } const { data, error } = await supabase.from("student_registrations").select("id,student:students(full_name),result:exam_results!inner(status)").eq("exam_period_id", period.id).eq("ustaz_id", user.id).eq("result.status", "submitted"); if (error) { setMessage(error.message); return; } setPeriodId(period.id); setUstazId(user.id); setStudents((data ?? []) as unknown as Student[]); setMessage(""); } void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!periodId || !ustazId || !studentId || requestMessage.trim().length < 3) { setMessage("ተማሪውን ይምረጡ እና አጭር ማብራሪያ ይጻፉ።"); return; } setSaving(true); const { error } = await createClient().from("result_review_requests").upsert({ exam_period_id: periodId, ustaz_id: ustazId, student_registration_id: studentId, request_message: requestMessage.trim(), status: "pending", admin_note: null }, { onConflict: "exam_period_id,ustaz_id,student_registration_id" }); setSaving(false); if (error) { setMessage(error.message); return; } setRequestMessage(""); setMessage("የግምገማ ጥያቄው ተልኳል።"); }

  return <UstazShell><header className="ustaz-results-header"><Link className="back-link" href="/results">← ወደ ውጤቶች</Link><p className="eyebrow">ቅሬታ ማስገቢያ</p><h1>ቅሬታ ማስገቢያ</h1><p>እንደገና እንዲገመገም የሚፈልጉትን ተማሪ እና ምክንያቱን ያስገቡ።</p></header>{message && <p className="admin-message">{message}</p>}<form className="ustaz-action-form" onSubmit={submit}><select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">ተማሪ ይምረጡ…</option>{students.map((student) => <option key={student.id} value={student.id}>{student.student?.full_name ?? "—"}</option>)}</select><textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} minLength={3} required placeholder="ምን እንዲገመገም ይፈልጋሉ?" /><button className="primary-button" disabled={saving || !students.length}>{saving ? "በመላክ ላይ…" : "ቅሬታ አስገባ"}</button></form></UstazShell>;
}
