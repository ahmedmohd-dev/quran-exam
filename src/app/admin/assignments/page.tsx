"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; full_name: string };
type Group = { id: string; group_title: string; place_start: number; place_end: number; learning_level: "alif" | "quran"; examiner_id: string | null };
type Student = { registrationId: string; name: string; number: string; ustazId: string; ustazName: string; level: "alif" | "quran"; place: number };
type Assignment = { student_registration_id: string; examiner_id: string };

export default function AssignmentsPage() {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [examiners, setExaminers] = useState<Person[]>([]);
  const [ustazes, setUstazes] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [bigUstazIds, setBigUstazIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedExaminers, setSelectedExaminers] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string[]>>({});
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [manualExaminerId, setManualExaminerId] = useState("");
  const [message, setMessage] = useState("Loading examiner assignment data...");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") { setMessage("Only the Exam Admin can assign Examiners."); return; }
    const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!period) { setMessage("Create the current examination session first."); return; }
    setPeriodId(period.id);
    const [examinerResult, ustazResult, linkResult, groupResult, registrationResult, bigResult, assignmentResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "examiner").eq("active", true).order("full_name"),
      supabase.from("profiles").select("id, full_name").eq("role", "ustaz").eq("active", true).order("full_name"),
      supabase.from("examiner_ustaz_links").select("examiner_id, ustaz_id"),
      supabase.from("exam_assignment_groups").select("id, group_title, place_start, place_end, learning_level, examiner_id").eq("exam_period_id", period.id).order("group_order").order("place_start"),
      supabase.from("student_registrations").select("id, ustaz_id, current_learning_level, current_learning_place, student:students(student_number, full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)").eq("exam_period_id", period.id),
      supabase.from("exam_period_big_ustazes").select("ustaz_id").eq("exam_period_id", period.id),
      supabase.from("examiner_assignments").select("student_registration_id, examiner_id").eq("exam_period_id", period.id),
    ]);
    const error = [examinerResult, ustazResult, linkResult, groupResult, registrationResult, bigResult, assignmentResult].map((result) => result.error).find(Boolean);
    if (error) { setMessage(error.message); return; }
    const loadedGroups = groupResult.data ?? [];
    setExaminers(examinerResult.data ?? []);
    setUstazes(ustazResult.data ?? []);
    setLinks((linkResult.data ?? []).reduce<Record<string, string[]>>((result, link) => ({ ...result, [link.examiner_id]: [...(result[link.examiner_id] ?? []), link.ustaz_id] }), {}));
    setGroups(loadedGroups);
    setSelectedExaminers(loadedGroups.reduce<Record<string, string>>((result, group) => ({ ...result, [group.id]: group.examiner_id ?? "" }), {}));
    setBigUstazIds((bigResult.data ?? []).map((item) => item.ustaz_id));
    setAssignments(assignmentResult.data ?? []);
    setStudents((registrationResult.data ?? []).map((item) => {
      const student = item.student as unknown as { student_number: string; full_name: string };
      const ustaz = item.ustaz as unknown as { full_name: string } | null;
      return { registrationId: item.id, name: student.full_name, number: student.student_number, ustazId: item.ustaz_id, ustazName: ustaz?.full_name ?? "", level: item.current_learning_level as "alif" | "quran", place: Number(item.current_learning_place) };
    }));
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadData(); }, 0); return () => window.clearTimeout(timer); }, []);

  const assignedIds = useMemo(() => new Set(assignments.map((assignment) => assignment.student_registration_id)), [assignments]);
  const regularStudents = useMemo(() => students.filter((student) => !bigUstazIds.includes(student.ustazId)), [students, bigUstazIds]);
  const unassignedStudents = useMemo(() => students.filter((student) => !assignedIds.has(student.registrationId)), [assignedIds, students]);
  const selectedStudents = useMemo(() => unassignedStudents.filter((student) => selectedStudentIds.includes(student.registrationId)), [selectedStudentIds, unassignedStudents]);
  const linkedIds = (examinerId: string) => links[examinerId] ?? [];
  const rangeStudents = (group: Group) => regularStudents.filter((student) => student.level === group.learning_level && student.place >= group.place_start && student.place <= group.place_end);

  function toggleUstaz(examinerId: string, ustazId: string) {
    setLinks((current) => {
      const selected = current[examinerId] ?? [];
      return { ...current, [examinerId]: selected.includes(ustazId) ? selected.filter((id) => id !== ustazId) : [...selected, ustazId] };
    });
  }

  async function saveConnections(examinerId: string) {
    const ustazIds = linkedIds(examinerId);
    if (!ustazIds.length) { setMessage("Select at least one connected Ustaz."); return false; }
    const supabase = createClient();
    const { error } = await supabase.rpc("save_examiner_ustaz_links", { p_examiner_id: examinerId, p_ustaz_ids: ustazIds });
    if (error) { setMessage(error.message); return false; }
    return true;
  }

  async function saveConnectionOnly(examinerId: string) {
    setSavingKey("connection:" + examinerId);
    const saved = await saveConnections(examinerId);
    setSavingKey(null);
    if (saved) {
      setMessage("Examiner connection saved. Any selected Ustaz previously connected elsewhere was moved here.");
      await loadData();
    }
  }

  async function assignRange(group: Group) {
    const examinerId = selectedExaminers[group.id];
    if (!examinerId) { setMessage("Select an Examiner account first."); return; }
    setSavingKey(group.id);
    if (!await saveConnections(examinerId)) { setSavingKey(null); return; }
    const { data, error } = await createClient().rpc("assign_examiner_group", { p_assignment_group_id: group.id, p_examiner_id: examinerId });
    setSavingKey(null);
    if (error) { setMessage(error.message); return; }
    const result = Array.isArray(data) ? data[0] : data;
    setMessage(String(result?.assigned_count ?? 0) + " students assigned." + (result?.conflict_count ? " " + String(result.conflict_count) + " belong to selected Ustazes and remain unassigned." : ""));
    await loadData();
  }

  async function assignBig(ownerId: string, bigStudents: Student[]) {
    const examinerId = selectedExaminers["big:" + ownerId];
    if (!periodId || !examinerId) { setMessage("Select an Examiner account first."); return; }
    const eligibleIds = bigStudents.filter((student) => !linkedIds(examinerId).includes(student.ustazId)).map((student) => student.registrationId);
    if (!eligibleIds.length) { setMessage("All students in this group belong to selected Ustazes. Choose another Examiner."); return; }
    setSavingKey("big:" + ownerId);
    if (!await saveConnections(examinerId)) { setSavingKey(null); return; }
    const { data, error } = await createClient().rpc("assign_examiner_students", { p_exam_period_id: periodId, p_student_registration_ids: eligibleIds, p_examiner_id: examinerId });
    setSavingKey(null);
    if (error) { setMessage(error.message); return; }
    setMessage(String(data ?? eligibleIds.length) + " Big-group students assigned.");
    await loadData();
  }

  async function assignManual() {
    if (!periodId || !manualExaminerId || !selectedStudentIds.length) { setMessage("Select students and an Examiner account."); return; }
    if (selectedStudents.some((student) => linkedIds(manualExaminerId).includes(student.ustazId))) { setMessage("This Examiner cannot receive a student from any selected Ustaz."); return; }
    setSavingKey("manual");
    if (!await saveConnections(manualExaminerId)) { setSavingKey(null); return; }
    const { data, error } = await createClient().rpc("assign_examiner_students", { p_exam_period_id: periodId, p_student_registration_ids: selectedStudentIds, p_examiner_id: manualExaminerId });
    setSavingKey(null);
    if (error) { setMessage(error.message); return; }
    setMessage(String(data ?? selectedStudentIds.length) + " students assigned.");
    setSelectedStudentIds([]);
    await loadData();
  }

  function connectedPicker(examinerId: string) {
    if (!examinerId) return null;
    const selected = linkedIds(examinerId);
    const available = ustazes.filter((ustaz) => !selected.includes(ustaz.id));
    return <fieldset className="connected-ustaz-picker"><legend>Connected Ustazes - their students are blocked</legend><div className="connected-ustaz-add"><select value="" onChange={(event) => { if (event.target.value) toggleUstaz(examinerId, event.target.value); }}><option value="">Add a Ustaz...</option>{available.map((ustaz) => <option key={ustaz.id} value={ustaz.id}>{ustaz.full_name}</option>)}</select></div><div className="connected-ustaz-chips">{selected.map((ustazId) => <span className="connected-ustaz-chip" key={ustazId}>{ustazes.find((ustaz) => ustaz.id === ustazId)?.full_name ?? "Ustaz"}<button type="button" aria-label="Remove connected Ustaz" onClick={() => toggleUstaz(examinerId, ustazId)}>Ã—</button></span>)}{!selected.length && <small>No connected Ustazes selected.</small>}</div></fieldset>;
  }

  return <AdminShell active="assignments"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN - PHASE 2</p><h1>Examiner assignments</h1><p>Select every Ustaz connected to an Examiner. The Examiner will never receive students from those Ustazes.</p></div><div className="workspace-step"><span>2</span><div><strong>Assignment</strong><small>{assignments.length} students assigned</small></div></div></header>{message && <p className="admin-message">{message}</p>}<section className="admin-card examiner-connections"><div className="card-title"><div><h2>Examiner connections</h2><p>Set blocked Ustazes once. These connections apply to all seven ranges and all Big-student groups.</p></div></div><div className="examiner-connection-list">{examiners.map((examiner) => <article className="examiner-connection-row" key={examiner.id}><strong>{examiner.full_name}</strong>{connectedPicker(examiner.id)}<button className="secondary-button" type="button" onClick={() => void saveConnectionOnly(examiner.id)} disabled={savingKey === "connection:" + examiner.id}>{savingKey === "connection:" + examiner.id ? "Saving..." : "Save connection"}</button></article>)}</div></section><section className="assignment-groups">{groups.map((group) => { const examinerId = selectedExaminers[group.id] ?? ""; const range = rangeStudents(group); const conflicts = range.filter((student) => linkedIds(examinerId).includes(student.ustazId)); return <article className="admin-card assignment-group" key={group.id}><div className="card-title"><div><h2>{group.group_title}</h2><p>Places {group.place_start}-{group.place_end} - {range.length} students</p></div></div><label>Examiner account<select value={examinerId} onChange={(event) => setSelectedExaminers((current) => ({ ...current, [group.id]: event.target.value }))}><option value="">Select Examiner</option>{examiners.map((examiner) => <option key={examiner.id} value={examiner.id}>{examiner.full_name}</option>)}</select></label><button className="primary-button" type="button" onClick={() => void assignRange(group)} disabled={savingKey === group.id}>{savingKey === group.id ? "Assigning..." : "Save connections and assign range"}</button>{conflicts.length > 0 && <div className="assignment-conflict"><strong>Manual action needed</strong><span>{conflicts.length} student(s) belong to selected Ustazes and will remain unassigned.</span></div>}</article>; })}</section><h2 className="assignment-section-title">Big-student groups</h2><section className="assignment-groups">{bigUstazIds.map((ownerId) => { const bigStudents = students.filter((student) => student.ustazId === ownerId); const examinerId = selectedExaminers["big:" + ownerId] ?? ""; return <article className="admin-card assignment-group big-group" key={ownerId}><div className="card-title"><div><h2>Big - {ustazes.find((ustaz) => ustaz.id === ownerId)?.full_name ?? "Ustaz"}</h2><p>{bigStudents.length} students kept separate</p></div></div><label>Examiner account<select value={examinerId} onChange={(event) => setSelectedExaminers((current) => ({ ...current, ["big:" + ownerId]: event.target.value }))}><option value="">Select Examiner</option>{examiners.map((examiner) => <option key={examiner.id} value={examiner.id}>{examiner.full_name}</option>)}</select></label><button className="primary-button" type="button" onClick={() => void assignBig(ownerId, bigStudents)} disabled={savingKey === "big:" + ownerId}>{savingKey === "big:" + ownerId ? "Assigning..." : "Save connections and assign Big group"}</button></article>; })}</section><section className="admin-card manual-assignment"><div className="card-title"><div><h2>Manual reassignment</h2><p>Students left unassigned because of the ownership rule.</p></div><strong>{unassignedStudents.length} unassigned</strong></div><label>Examiner account<select value={manualExaminerId} onChange={(event) => setManualExaminerId(event.target.value)}><option value="">Select Examiner</option>{examiners.map((examiner) => <option key={examiner.id} value={examiner.id}>{examiner.full_name}</option>)}</select></label><button className="primary-button" type="button" onClick={() => void assignManual()} disabled={savingKey === "manual"}>Assign selected</button><div className="assignment-list">{unassignedStudents.map((student) => <label className="assignment-student" key={student.registrationId}><input type="checkbox" checked={selectedStudentIds.includes(student.registrationId)} onChange={() => setSelectedStudentIds((current) => current.includes(student.registrationId) ? current.filter((id) => id !== student.registrationId) : [...current, student.registrationId])} /><span><strong>{student.name}</strong><small>{student.number} - Ustaz: {student.ustazName} - place {student.place}</small></span></label>)}</div></section></AdminShell>;
}

