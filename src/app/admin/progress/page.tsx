"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Examiner = { id: string; full_name: string };
type Registration = { id: string; student: { full_name: string } | null };
type Assignment = { id: string; student_registration_id: string; examiner_id: string };
type Result = { examiner_assignment_id: string; status: "draft" | "submitted"; total_mark: number; result_class: "first" | "second" | "third" | "fourth"; revision_place: number | null; examiner_comment: string | null; round_scores: unknown; makhraj_scores: unknown };
type ProgressStudent = { assignment: Assignment; name: string; result: Result | null; issues: string[] };
type ProgressExaminer = { examiner: Examiner; students: ProgressStudent[] };

function resultLabel(result: Result | null) {
  if (!result) return "Not started";
  if (result.status === "draft") return "Draft";
  return "Submitted";
}

function buildIssues(result: Result | null) {
  if (!result) return ["No result started"];
  const issues: string[] = [];
  if (result.status === "draft") issues.push("Saved as draft, not submitted");
  if (result.status === "submitted" && !result.examiner_comment?.trim()) issues.push("Missing examiner comment");
  if (result.result_class === "second" && !result.revision_place) issues.push("Missing revision Fesel");
  if (!Array.isArray(result.round_scores) || !result.round_scores.length) issues.push("Question marks are empty");
  if (!Array.isArray(result.makhraj_scores) || !result.makhraj_scores.length) issues.push("Makhraj and Sifa marks are empty");
  return issues;
}

export default function AdminProgressPage() {
  const [periodName, setPeriodName] = useState("Current examination");
  const [groups, setGroups] = useState<ProgressExaminer[]>([]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [openExaminers, setOpenExaminers] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("Loading exam progress...");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id, name").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setMessage(periodError?.message ?? "No examination period found."); return; }
    setPeriodName(period.name ?? "Current examination");
    const [examinerQuery, registrationQuery, assignmentQuery, resultQuery] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "examiner").eq("active", true).order("full_name"),
      supabase.from("student_registrations").select("id, student:students(full_name)").eq("exam_period_id", period.id),
      supabase.from("examiner_assignments").select("id, student_registration_id, examiner_id").eq("exam_period_id", period.id),
      supabase.from("exam_results").select("examiner_assignment_id, status, total_mark, result_class, revision_place, examiner_comment, round_scores, makhraj_scores").eq("exam_period_id", period.id),
    ]);
    const error = [examinerQuery, registrationQuery, assignmentQuery, resultQuery].map((query) => query.error).find(Boolean);
    if (error) { setMessage(error.message); return; }
    const examiners = (examinerQuery.data ?? []) as Examiner[];
    const registrations = (registrationQuery.data ?? []) as unknown as Registration[];
    const assignments = (assignmentQuery.data ?? []) as Assignment[];
    const results = new Map(((resultQuery.data ?? []) as Result[]).map((result) => [result.examiner_assignment_id, result]));
    const names = new Map(registrations.map((registration) => [registration.id, registration.student?.full_name ?? "Unknown student"]));
    const assignedIds = new Set(assignments.map((assignment) => assignment.student_registration_id));
    setUnassigned(registrations.filter((registration) => !assignedIds.has(registration.id)).map((registration) => names.get(registration.id) ?? "Unknown student"));
    setGroups(examiners.map((examiner) => ({ examiner, students: assignments.filter((assignment) => assignment.examiner_id === examiner.id).map((assignment) => { const result = results.get(assignment.id) ?? null; return { assignment, name: names.get(assignment.student_registration_id) ?? "Unknown student", result, issues: buildIssues(result) }; }) })));
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  const summary = useMemo(() => {
    const students = groups.flatMap((group) => group.students);
    const issues = students.filter((student) => student.issues.length).length;
    return { students: students.length, submitted: students.filter((student) => student.result?.status === "submitted").length, drafts: students.filter((student) => student.result?.status === "draft").length, issues };
  }, [groups]);

  return <AdminShell active="progress"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · PHASE 3</p><h1>Exam progress</h1><p>Follow every Examiner while they work and see what still needs attention.</p><small className="progress-period">{periodName}</small></div><button className="secondary-button" type="button" onClick={() => void load()}>Refresh progress</button></header>{message && <p className="admin-message">{message}</p>}<section className="metrics progress-metrics"><article><span>Assigned students</span><strong>{summary.students}</strong></article><article><span>Submitted</span><strong>{summary.submitted}</strong></article><article><span>Drafts</span><strong>{summary.drafts}</strong></article><article><span>Needs attention</span><strong>{summary.issues + unassigned.length}</strong></article></section>{unassigned.length > 0 && <section className="admin-card progress-alert"><h2>Unassigned students · {unassigned.length}</h2><p>{unassigned.join(", ")}</p><a className="primary-button" href="/admin/review">Open assignment review</a></section>}<section className="progress-examiners">{groups.map((group) => { const issueCount = group.students.filter((student) => student.issues.length).length; const key = group.examiner.id; return <article className="admin-card progress-examiner" key={key}><button className="review-heading" type="button" onClick={() => setOpenExaminers((current) => ({ ...current, [key]: !current[key] }))}><span><strong>{group.examiner.full_name}</strong><small>{group.students.length} assigned · {group.students.filter((student) => student.result?.status === "submitted").length} submitted · {issueCount} needs attention</small></span><b>{openExaminers[key] ? "−" : "+"}</b></button>{openExaminers[key] && <div className="progress-student-list">{group.students.map((student) => <div className={`progress-student ${student.issues.length ? "has-issues" : ""}`} key={student.assignment.id}><div><strong>{student.name}</strong><small>{resultLabel(student.result)}{student.result ? ` · ${Number(student.result.total_mark).toFixed(2)} / 100` : ""}</small></div>{student.issues.length ? <ul>{student.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <span className="progress-ok">Complete</span>}</div>)}{!group.students.length && <p className="empty-state">No students assigned.</p>}</div>}</article>; })}</section></AdminShell>;
}
