"use client";

import { FormEvent, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";
import { buildProgress, buildUstazRankings, UstazRankings } from "@/lib/director-data";
import { getExamGroupScope } from "@/lib/exam-group-scope";
import { useSelectedExamGroup } from "@/lib/use-selected-exam-group";

type Ustaz = { id: string; full_name: string; ustaz_code: string | null };
type Comment = { ustaz_id: string; comment: string };
type Request = { id: string; student_registration_id: string; ustaz_id: string; request_message: string; status: "pending" | "reviewing" | "resolved"; admin_note: string | null; registration: { student: { full_name: string } | null } | null; ustaz: { full_name: string } | null };

export default function UstazFeedbackAdminPage() {
  const groupCode = useSelectedExamGroup();
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<Request[]>([]);
  const [feedback, setFeedback] = useState<Array<{ id: string; ustaz_id: string; message: string; created_at: string; ustaz: { full_name: string } | null }>>([]);
  const [rankings, setRankings] = useState<UstazRankings>({});
  const [message, setMessage] = useState("Loading…");
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setMessage(periodError?.message ?? "No exam period found."); return; }
    setPeriodId(period.id);
    const scope = await getExamGroupScope(supabase, groupCode);
    if (scope.error) { setMessage(scope.error.message); return; }
    const [ustazResult, commentResult, requestResult, feedbackResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,ustaz_code").eq("role", "ustaz").eq("active", true).order("full_name"),
      supabase.from("ustaz_result_comments").select("ustaz_id,comment").eq("exam_period_id", period.id),
      supabase.from("result_review_requests").select("id,student_registration_id,ustaz_id,request_message,status,admin_note,registration:student_registrations(student:students(full_name)),ustaz:profiles!result_review_requests_ustaz_id_fkey(full_name)").eq("exam_period_id", period.id).order("created_at", { ascending: false }),
      supabase.from("ustaz_exam_feedback").select("id,ustaz_id,message,created_at,ustaz:profiles!ustaz_exam_feedback_ustaz_id_fkey(full_name)").eq("exam_period_id", period.id).order("created_at", { ascending: false }),
    ]);
    const error = [ustazResult.error, commentResult.error, requestResult.error, feedbackResult.error].find(Boolean);
    if (error) { setMessage(error.message); return; }
    const rankingData = await import("@/lib/director-data").then(async ({ loadDirectorData }) => loadDirectorData(groupCode));
    const registrationIds = new Set(rankingData.registrations.map((registration) => registration.id));
    setUstazes(((ustazResult.data ?? []) as Ustaz[]).filter((ustaz) => scope.profileIds.has(ustaz.id)));
    setComments(Object.fromEntries(((commentResult.data ?? []) as Comment[]).filter((item) => scope.profileIds.has(item.ustaz_id)).map((item) => [item.ustaz_id, item.comment])));
    setRequests(((requestResult.data ?? []) as unknown as Request[]).filter((request) => registrationIds.has(request.student_registration_id) && scope.profileIds.has(request.ustaz_id)));
    setFeedback(((feedbackResult.data ?? []) as unknown as Array<{ id: string; ustaz_id: string; message: string; created_at: string; ustaz: { full_name: string } | null }>).filter((item) => scope.profileIds.has(item.ustaz_id)));
    setRankings(buildUstazRankings(buildProgress(rankingData.ustazes, rankingData.registrations, rankingData.results, rankingData.supplemental, groupCode === "boys")));
    setMessage("");
  }

  useEffect(() => { void load(); }, [groupCode]);

  async function saveComment(event: FormEvent<HTMLFormElement>, ustazId: string) {
    event.preventDefault();
    if (!periodId) return;
    setSaving(ustazId);
    const { data: { user } } = await createClient().auth.getUser();
    const { error } = await createClient().from("ustaz_result_comments").upsert({ exam_period_id: periodId, ustaz_id: ustazId, comment: comments[ustazId] ?? "", updated_by: user?.id }, { onConflict: "exam_period_id,ustaz_id" });
    setSaving(null); setMessage(error ? error.message : "General comment saved.");
  }

  async function saveRequest(event: FormEvent<HTMLFormElement>, request: Request) {
    event.preventDefault();
    setSaving(request.id);
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().from("result_review_requests").update({ status: form.get("status"), admin_note: String(form.get("admin_note") ?? "") || null, updated_at: new Date().toISOString() }).eq("id", request.id);
    setSaving(null); if (error) { setMessage(error.message); return; } setMessage("Review request updated."); await load();
  }

  function rankSummary(ustaz: Ustaz) {
    const ranks = rankings[ustaz.id];
    return groupCode === "girls"
      ? `${ustaz.ustaz_code ?? "—"} · Qur’an ${ranks?.quran ?? "—"}ኛ`
      : `${ustaz.ustaz_code ?? "—"} · Qur’an ${ranks?.quran ?? "—"}ኛ · Hisnul ${ranks?.hisnul ?? "—"}ኛ · Homework ${ranks?.homework ?? "—"}ኛ`;
  }

  return <AdminShell active="ustazFeedback"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN</p><h1>Ustaz feedback and review</h1><p>Write general comments, read improvement ideas, and respond to student-result review requests.</p></div></header>{message && <p className="admin-message">{message}</p>}<section className="admin-card"><h2>General comments and ranks for Ustazes</h2><div className="ustaz-comment-grid">{ustazes.map((ustaz) => <form key={ustaz.id} onSubmit={(event) => void saveComment(event, ustaz.id)}><strong>{ustaz.full_name}</strong><small>{rankSummary(ustaz)}</small><textarea value={comments[ustaz.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [ustaz.id]: event.target.value }))} placeholder="General result comment" maxLength={2000} /><button className="secondary-button" disabled={saving === ustaz.id}>{saving === ustaz.id ? "Saving…" : "Save comment"}</button></form>)}</div></section><section className="admin-card"><h2>Student result review requests</h2>{requests.map((request) => <form className="review-request" key={request.id} onSubmit={(event) => void saveRequest(event, request)}><div><strong>{request.registration?.student?.full_name ?? "—"}</strong><small>{request.ustaz?.full_name ?? "—"}</small><p>{request.request_message}</p></div><select name="status" defaultValue={request.status}><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select><textarea name="admin_note" defaultValue={request.admin_note ?? ""} placeholder="Reply or decision for the Ustaz" maxLength={2000} /><button className="primary-button" disabled={saving === request.id}>{saving === request.id ? "Saving…" : "Save response"}</button></form>)}{!requests.length && !message && <p>No review requests yet.</p>}</section><section className="admin-card"><h2>Suggestions for future exams</h2>{feedback.map((item) => <article className="feedback-item" key={item.id}><strong>{item.ustaz?.full_name ?? "—"}</strong><p>{item.message}</p></article>)}{!feedback.length && !message && <p>No suggestions yet.</p>}</section></AdminShell>;
}
