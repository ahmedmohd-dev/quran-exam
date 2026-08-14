"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type Examiner = { id: string; full_name: string };
type Student = { id: string; name: string; level: "alif" | "quran"; place: string; ustazCode: string };
type Assignment = { id: string; student_registration_id: string; examiner_id: string; student: Student };

function targetName(level: Student["level"], place: string) {
  const number = Number(place);
  if (!Number.isInteger(number)) return place;
  return level === "quran" ? surahs[number - 1] ?? place : alifFesels[number - 1] ?? place;
}

export default function ReviewAssignmentsPage() {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassigned, setUnassigned] = useState<Student[]>([]);
  const [openExaminer, setOpenExaminer] = useState<string | null>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading assignment review…");
  const [saving, setSaving] = useState<string | null>(null);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") { setMessage("Only the Exam Admin can review assignments."); return; }
    const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!period) { setMessage("Create the current examination session first."); return; }
    setPeriodId(period.id);
    const [examinerResult, registrationResult, assignmentResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "examiner").eq("active", true).order("full_name"),
      supabase.from("student_registrations").select("id, current_learning_level, current_learning_place, student:students(full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(ustaz_code)").eq("exam_period_id", period.id).order("created_at"),
      supabase.from("examiner_assignments").select("id, student_registration_id, examiner_id").eq("exam_period_id", period.id),
    ]);
    const error = [examinerResult, registrationResult, assignmentResult].map((result) => result.error).find(Boolean);
    if (error) { setMessage(error.message); return; }
    const registrations = (registrationResult.data ?? []).map((item) => {
      const student = item.student as unknown as { full_name: string };
      const ustaz = item.ustaz as unknown as { ustaz_code: string | null } | null;
      return { id: item.id, name: student.full_name, level: item.current_learning_level as "alif" | "quran", place: item.current_learning_place ?? "", ustazCode: ustaz?.ustaz_code ?? "—" };
    });
    const byId = new Map(registrations.map((student) => [student.id, student]));
    const loadedAssignments = (assignmentResult.data ?? []).flatMap((item) => {
      const student = byId.get(item.student_registration_id);
      return student ? [{ id: item.id, student_registration_id: item.student_registration_id, examiner_id: item.examiner_id, student }] : [];
    });
    setExaminers(examinerResult.data ?? []);
    setAssignments(loadedAssignments);
    setUnassigned(registrations.filter((student) => !loadedAssignments.some((assignment) => assignment.student_registration_id === student.id)));
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadData(); }, 0); return () => window.clearTimeout(timer); }, []);

  const grouped = useMemo(() => examiners.map((examiner) => ({ examiner, students: assignments.filter((assignment) => assignment.examiner_id === examiner.id) })), [assignments, examiners]);

  async function removeAssignment(assignment: Assignment) {
    if (!window.confirm(`Remove ${assignment.student.name} from this Examiner?`)) return;
    setSaving(assignment.id);
    const { error } = await createClient().from("examiner_assignments").delete().eq("id", assignment.id);
    setSaving(null);
    if (error) { setMessage(error.message); return; }
    setMessage("Student removed from the Examiner.");
    await loadData();
  }

  async function moveAssignment(assignment: Assignment) {
    const examinerId = moveTargets[assignment.id];
    if (!examinerId) { setMessage("Select another Examiner first."); return; }
    setSaving(assignment.id);
    const { error } = await createClient().from("examiner_assignments").update({ examiner_id: examinerId, assignment_group_id: null }).eq("id", assignment.id);
    setSaving(null);
    if (error) { setMessage(error.message); return; }
    setMessage("Student moved successfully.");
    await loadData();
  }

  async function assignUnassigned(student: Student) {
    const examinerId = moveTargets[student.id];
    if (!periodId || !examinerId) { setMessage("Select an Examiner first."); return; }
    setSaving(student.id);
    const { error } = await createClient().rpc("assign_examiner_students", { p_exam_period_id: periodId, p_student_registration_ids: [student.id], p_examiner_id: examinerId });
    setSaving(null);
    if (error) { setMessage(error.message); return; }
    setMessage("Unassigned student added to the Examiner.");
    await loadData();
  }


  return <AdminShell active="review"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · PHASE 2</p><h1>Review assignments</h1><p>Open an Examiner to review, remove, or move assigned students.</p></div><div className="workspace-step"><span>{assignments.length}</span><div><strong>Assigned</strong><small>{unassigned.length} unassigned</small></div></div></header>{message && <p className="admin-message">{message}</p>}<section className="review-list">{grouped.map(({ examiner, students }) => <article className="admin-card review-examiner" key={examiner.id}><button className="review-heading" type="button" onClick={() => setOpenExaminer(openExaminer === examiner.id ? null : examiner.id)}><span><strong>{examiner.full_name}</strong><small>{students.length} student(s) assigned</small></span><b>{openExaminer === examiner.id ? "−" : "+"}</b></button>{openExaminer === examiner.id && <div className="review-students">{students.map((assignment) => <div className="review-student" key={assignment.id}><div><strong>{assignment.student.name}</strong><small>{assignment.student.level === "quran" ? "Qur’an" : "Alif"} · {targetName(assignment.student.level, assignment.student.place)} · {assignment.student.ustazCode}</small></div><div className="review-actions"><select value={moveTargets[assignment.id] ?? ""} onChange={(event) => setMoveTargets((current) => ({ ...current, [assignment.id]: event.target.value }))}><option value="">Move to…</option>{examiners.filter((target) => target.id !== examiner.id).map((target) => <option key={target.id} value={target.id}>{target.full_name}</option>)}</select><button className="secondary-button" type="button" disabled={saving === assignment.id} onClick={() => void moveAssignment(assignment)}>Move</button><button className="text-button delete-button" type="button" disabled={saving === assignment.id} onClick={() => void removeAssignment(assignment)}>Remove</button></div></div>)}{!students.length && <p className="empty-state">No students assigned.</p>}</div>}</article>)}</section><section className="admin-card review-unassigned"><div className="card-title"><div><h2>Unassigned students</h2><p>These students still need an Examiner.</p></div><span>{unassigned.length}</span></div>{unassigned.map((student) => <div className="review-student" key={student.id}><div><strong>{student.name}</strong><small>{student.level === "quran" ? "Qur’an" : "Alif"} · {targetName(student.level, student.place)} · {student.ustazCode}</small></div><div className="review-actions"><select value={moveTargets[student.id] ?? ""} onChange={(event) => setMoveTargets((current) => ({ ...current, [student.id]: event.target.value }))}><option value="">Select Examiner…</option>{examiners.map((examiner) => <option key={examiner.id} value={examiner.id}>{examiner.full_name}</option>)}</select><button className="primary-button" type="button" disabled={saving === student.id} onClick={() => void assignUnassigned(student)}>Assign</button></div></div>)}{!unassigned.length && !message && <div className="empty-state"><strong>All students are assigned</strong><p>Phase 2 assignment is complete.</p></div>}</section></AdminShell>;
}
