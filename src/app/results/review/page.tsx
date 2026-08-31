"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { UstazShell } from "@/components/ustaz-shell";
import { createClient } from "@/lib/supabase/client";

type Student = { id: string; student: { full_name: string } | null };
type ReviewRequest = { id: string; request_message: string; status: "pending" | "reviewing" | "resolved"; admin_note: string | null; created_at: string; updated_at: string | null; registration: { student: { full_name: string } | null } | null };
const statusLabels: Record<ReviewRequest["status"], string> = { pending: "በመጠባበቅ ላይ", reviewing: "በግምገማ ላይ", resolved: "ምላሽ ተሰጥቷል" };

export default function UstazReviewRequestPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [ustazId, setUstazId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  const [saving, setSaving] = useState(false);

  const loadRequests = useCallback(async (currentPeriodId: string, currentUstazId: string) => {
    const { data, error } = await createClient().from("result_review_requests").select("id,request_message,status,admin_note,created_at,updated_at,registration:student_registrations(student:students(full_name))").eq("exam_period_id", currentPeriodId).eq("ustaz_id", currentUstazId).order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setRequests((data ?? []) as unknown as ReviewRequest[]);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("እባክዎ እንደገና ይግቡ።"); return; }
    const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!period) { setMessage("የፈተና ወቅት አልተገኘም።"); return; }
    const { data, error } = await supabase.from("student_registrations").select("id,student:students(full_name),result:exam_results!inner(status)").eq("exam_period_id", period.id).eq("ustaz_id", user.id).eq("result.status", "submitted");
    if (error) { setMessage(error.message); return; }
    setPeriodId(period.id); setUstazId(user.id); setStudents((data ?? []) as unknown as Student[]);
    await loadRequests(period.id, user.id);
    setMessage("");
  }, [loadRequests]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!periodId || !ustazId || !studentId || requestMessage.trim().length < 3) { setMessage("ተማሪውን ይምረጡ እና አጭር ማብራሪያ ይጻፉ።"); return; }
    setSaving(true);
    const { error } = await createClient().from("result_review_requests").upsert({ exam_period_id: periodId, ustaz_id: ustazId, student_registration_id: studentId, request_message: requestMessage.trim(), status: "pending", admin_note: null }, { onConflict: "exam_period_id,ustaz_id,student_registration_id" });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setStudentId(""); setRequestMessage(""); await loadRequests(periodId, ustazId); setMessage("የግምገማ ጥያቄው ተልኳል።");
  }

  return <UstazShell><header className="ustaz-results-header"><Link className="back-link" href="/results">← ወደ ውጤቶች</Link><p className="eyebrow">ቅሬታ ማስገቢያ</p><h1>ቅሬታ ማስገቢያ</h1><p>እንደገና እንዲገመገም የሚፈልጉትን ተማሪ እና ምክንያቱን ያስገቡ።</p></header>{message && <p className="admin-message">{message}</p>}<form className="ustaz-action-form" onSubmit={submit}><select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">ተማሪ ይምረጡ…</option>{students.map((student) => <option key={student.id} value={student.id}>{student.student?.full_name ?? "—"}</option>)}</select><textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} minLength={3} required placeholder="ምን እንዲገመገም ይፈልጋሉ?" /><button className="primary-button" disabled={saving || !students.length}>{saving ? "በመላክ ላይ…" : "ቅሬታ አስገባ"}</button></form><section className="ustaz-review-history"><div className="panel-heading"><div><h2>የቀድሞ ጥያቄዎች እና ምላሾች</h2><p>አስተዳደሩ የሰጠውን ምላሽ እዚህ ይመልከቱ።</p></div></div>{requests.length ? <div className="ustaz-review-list">{requests.map((request) => <article className="ustaz-review-item" key={request.id}><div className="ustaz-review-item-heading"><strong>{request.registration?.student?.full_name ?? "—"}</strong><span className={`review-status ${request.status}`}>{statusLabels[request.status]}</span></div><p><b>የተላከው ጥያቄ፦</b> {request.request_message}</p>{request.admin_note ? <div className="ustaz-review-answer"><b>የአስተዳደሩ ምላሽ፦</b><p>{request.admin_note}</p></div> : <small>እስካሁን ምላሽ አልተሰጠም።</small>}<small>{new Date(request.updated_at ?? request.created_at).toLocaleString()}</small></article>)}</div> : <p>እስካሁን የተላከ የግምገማ ጥያቄ የለም።</p>}</section></UstazShell>;
}
