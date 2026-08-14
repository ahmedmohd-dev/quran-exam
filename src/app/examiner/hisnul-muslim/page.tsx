"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExaminerShell } from "@/components/examiner-shell";
import { createClient } from "@/lib/supabase/client";

type Student = { assignmentId: string; registrationId: string; examinerId: string; name: string; mark: string };
type AssignmentRow = { id: string; student_registration_id: string; examiner_id: string; student_registration: { student: { full_name: string } | null } | null };
type SupplementalRow = { examiner_assignment_id: string; hisnul_muslim_mark: number };
const clamp = (value: string, max: number) => value === "" ? "" : String(Math.min(max, Math.max(0, Number(value))));

export default function HisnulMuslimPage() {
  const [students, setStudents] = useState<Student[]>([]); const [message, setMessage] = useState("Loading students..."); const [saving, setSaving] = useState(false);
  useEffect(() => { async function load() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const { data, error } = await supabase.from("examiner_assignments").select("id,student_registration_id,examiner_id,student_registration:student_registrations(student:students(full_name))").eq("examiner_id", user.id); if (error) { setMessage(error.message); return; } const rows = (data ?? []) as unknown as AssignmentRow[]; const ids = rows.map((row) => row.id); const { data: supplemental } = ids.length ? await supabase.from("exam_supplemental_results").select("examiner_assignment_id,hisnul_muslim_mark").in("examiner_assignment_id", ids) : { data: [] }; const marks = new Map(((supplemental ?? []) as unknown as SupplementalRow[]).map((row) => [row.examiner_assignment_id, row.hisnul_muslim_mark])); setStudents(rows.flatMap((row) => row.student_registration?.student?.full_name ? [{ assignmentId: row.id, registrationId: row.student_registration_id, examinerId: row.examiner_id, name: row.student_registration.student.full_name, mark: marks.has(row.id) ? String(marks.get(row.id)) : "" }] : [])); setMessage(""); } void load(); }, []);
  async function saveOne(student: Student, value: string) { const { error } = await createClient().from("exam_supplemental_results").upsert({ examiner_assignment_id: student.assignmentId, student_registration_id: student.registrationId, examiner_id: student.examinerId, hisnul_muslim_mark: Number(value || 0) }, { onConflict: "examiner_assignment_id" }); if (error) setMessage(error.message); }
  async function saveAll() { setSaving(true); await Promise.all(students.map((student) => saveOne(student, student.mark))); setSaving(false); setMessage("Hisnul Muslim results saved successfully."); }
  return <ExaminerShell><header className="examiner-header"><Link className="back-link" href="/examiner">← ወደ ዋና ገጽ</Link><h1>Hisnul Muslim</h1><p>የረዳት ፈታኙን የወረቀት ውጤት ያስገቡ · /20</p></header>{message && <p className="admin-message">{message}</p>}<section className="admin-card score-entry-list">{students.map((student) => <label key={student.assignmentId}>{student.name}<input type="number" min="0" max="20" step="0.5" value={student.mark} onChange={(event) => { const value = clamp(event.target.value, 20); setStudents((current) => current.map((item) => item.assignmentId === student.assignmentId ? { ...item, mark: value } : item)); window.setTimeout(() => void saveOne(student, value), 500); }} /></label>)}<button className="primary-button" type="button" disabled={saving} onClick={() => void saveAll()}>{saving ? "Saving..." : "Save Hisnul Muslim results"}</button></section></ExaminerShell>;
}
