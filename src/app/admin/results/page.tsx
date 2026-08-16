"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type Result = { id: string; examiner_assignment_id: string; status: "draft" | "submitted"; total_mark: number; result_class: string; revision_place: number | null; revision_track: "alif" | "quran" | "qaida" | "admin" | null; examiner_comment: string | null; examiner: { full_name: string } | null; assignment: { student_registration: { student: { full_name: string } | null } | null } | null };

export default function AdminResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState("Loading test results...");
  const [openStatuses, setOpenStatuses] = useState<Record<string, boolean>>({ draft: true, submitted: true });
  const [openExaminers, setOpenExaminers] = useState<Record<string, boolean>>({});

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("exam_results").select("id, examiner_assignment_id, status, total_mark, result_class, revision_place, revision_track, examiner_comment, examiner:profiles!exam_results_examiner_id_fkey(full_name), assignment:examiner_assignments(student_registration:student_registrations(student:students(full_name)))").order("updated_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setResults((data ?? []) as unknown as Result[]);
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function clearResult(result: Result) {
    const name = result.assignment?.student_registration?.student?.full_name ?? "this student";
    if (!window.confirm(`Clear the test result for ${name}?`)) return;
    const { error } = await createClient().from("exam_results").delete().eq("id", result.id);
    if (error) { setMessage(error.message); return; }
    setMessage("Test result cleared. The examiner can enter it again.");
    await load();
  }

  const groups = useMemo(() => (["draft", "submitted"] as const).map((status) => {
    const statusResults = results.filter((result) => result.status === status);
    const examiners = Array.from(new Set(statusResults.map((result) => result.examiner?.full_name ?? "Unknown examiner"))).map((name) => ({ name, results: statusResults.filter((result) => (result.examiner?.full_name ?? "Unknown examiner") === name) }));
    return { status, results: statusResults, examiners };
  }), [results]);

  function revisionName(result: Result) {
    if (result.revision_track === "qaida") return "ከቃኢዳ ኑራኒያ መጀመሪያ";
    if (result.revision_track === "admin") return "በበላይ አካል ይወሰናል";
    if (result.revision_track === "quran") return result.revision_place ? `ቁርአን · ${result.revision_place} · ${surahs[result.revision_place - 1] ?? ""}` : "ቁርአን";
    return result.revision_place ? `አሊፍ · ፈሰል ${result.revision_place} · ${alifFesels[result.revision_place - 1] ?? ""}` : "—";
  }

 return <AdminShell active="results"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · PHASE 3</p><h1>Test results</h1><p>Open a status, then an examiner, to see the students.</p></div><div className="workspace-step"><span>{results.length}</span><div><strong>Results</strong><small>Drafts and submitted</small></div></div></header>{message && <p className="admin-message">{message}</p>}<section className="review-list">{groups.map((group) => <article className="admin-card review-examiner" key={group.status}><button className="review-heading" type="button" onClick={() => setOpenStatuses((current) => ({ ...current, [group.status]: !current[group.status] }))}><span><strong>{group.status === "draft" ? "Draft results" : "Submitted results"}</strong><small>{group.results.length} student(s)</small></span><b>{openStatuses[group.status] ? "−" : "+"}</b></button>{openStatuses[group.status] && <div className="review-students">{group.examiners.map((examiner) => { const key = `${group.status}:${examiner.name}`; return <div className="results-examiner-group" key={key}><button className="review-heading results-examiner-heading" type="button" onClick={() => setOpenExaminers((current) => ({ ...current, [key]: !current[key] }))}><span><strong>{examiner.name}</strong><small>{examiner.results.length} student(s)</small></span><b>{openExaminers[key] ? "−" : "+"}</b></button>{openExaminers[key] && examiner.results.map((result) => { const student = result.assignment?.student_registration?.student?.full_name ?? "Unknown student"; return <div className="review-student" key={result.id}><div><strong>{student}</strong><small>{result.result_class} · {Number(result.total_mark).toFixed(2)} / 100 · Revision: {revisionName(result)}</small>{result.examiner_comment && <small>Comment: {result.examiner_comment}</small>}</div><button className="text-button delete-button" type="button" onClick={() => void clearResult(result)}>Clear test result</button></div>; })}</div>; })}{!group.results.length && <p className="empty-state">No {group.status} results.</p>}</div>}</article>)}{!message && !results.length && <div className="empty-state"><strong>No test results yet.</strong></div>}</section></AdminShell>;
}
