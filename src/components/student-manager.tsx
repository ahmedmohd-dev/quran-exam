"use client";
/* eslint-disable react/no-unescaped-entities */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { surahs } from "@/lib/surahs";
import { alifFesels } from "@/lib/alif-fesels";

type Student = { id: string; registrationId: string; name: string; age: number; ustazId: string; ustazName: string; level: "Alif" | "Qur'an"; learningPlace: string; studyYears: number; studyMonths: number };
type Ustaz = { id: string; full_name: string };

export function StudentManager({ admin = false }: { admin?: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("Loading students…");
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [level, setLevel] = useState<"Alif" | "Qur'an">("Qur'an");
  const [place, setPlace] = useState("");
  const [ustazId, setUstazId] = useState("");

  async function loadStudents() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setNotice("No current registration session was found."); return; }
    setPeriodId(period.id);
    let registrations = supabase.from("student_registrations").select("id, ustaz_id, registered_age, current_learning_level, current_learning_place, study_years, study_months, student:students(student_number, full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)").eq("exam_period_id", period.id).order("created_at", { ascending: false });
    if (!admin) registrations = registrations.eq("ustaz_id", user.id);
    const { data, error } = await registrations;
    if (error) { setNotice(error.message); return; }
    setStudents((data ?? []).map((item) => {
      const student = item.student as unknown as { student_number: string; full_name: string };
      const ustaz = item.ustaz as unknown as { full_name: string } | null;
      return { id: student.student_number, registrationId: item.id, name: student.full_name, age: item.registered_age ?? 0, ustazId: item.ustaz_id, ustazName: ustaz?.full_name ?? "", level: item.current_learning_level === "alif" ? "Alif" : "Qur'an", learningPlace: item.current_learning_place ?? "", studyYears: item.study_years ?? 0, studyMonths: item.study_months ?? 0 };
    }));
    if (admin) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").eq("role", "ustaz").eq("active", true).order("full_name");
      setUstazes(profiles ?? []);
    }
    setNotice("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadStudents(); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>(".modal input[type=number]");
    const learningPlaceInput = inputs[inputs.length - 1];
    if (learningPlaceInput) learningPlaceInput.max = level === "Qur'an" ? "114" : "27";
  }, [level, showForm]);
  useEffect(() => { if (!notice || notice === "Loading students…") return; const id = window.setTimeout(() => setNotice(""), 4500); return () => window.clearTimeout(id); }, [notice]);

  const shownStudents = useMemo(() => students.filter((student) => `${student.name} ${student.id} ${student.ustazName}`.toLowerCase().includes(query.toLowerCase())), [students, query]);
  const groupedStudents = useMemo(() => ustazes.map((ustaz) => ({ ustaz, students: shownStudents.filter((student) => student.ustazId === ustaz.id) })).filter((group) => group.students.length || !query), [ustazes, shownStudents, query]);

  function exportValue(value: string | number) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function learningPlaceName(student: Student) {
    const number = Number(student.learningPlace);
    return student.level === "Qur'an" ? surahs[number - 1] ?? "" : alifFesels[number - 1] ?? "";
  }

  function exportRows(items: Student[], includeUstaz = true) {
    return items.map((student) => `<tr>${includeUstaz ? `<td>${exportValue(student.ustazName)}</td>` : ""}<td>${exportValue(student.id)}</td><td>${exportValue(student.name)}</td><td>${student.age}</td><td>${student.studyYears}</td><td>${student.studyMonths}</td><td>${exportValue(student.level)}</td><td>${exportValue(student.learningPlace)}</td><td>${exportValue(learningPlaceName(student))}</td></tr>`).join("");
  }

  function exportExcel(items = shownStudents, ustazName = "All Ustazes") {
    const includeUstaz = ustazName === "All Ustazes";
    const heading = includeUstaz ? "Ustaz" : "Ustaz name";
    const html = `<html><head><meta charset="utf-8"></head><body><h1>${exportValue(ustazName)}</h1><table border="1"><thead><tr>${includeUstaz ? `<th>${heading}</th>` : ""}<th>Student number</th><th>Student name</th><th>Age</th><th>Study years</th><th>Study months</th><th>Level</th><th>Surah/Fesel number</th><th>Surah/Fesel name</th></tr></thead><tbody>${exportRows(items, includeUstaz)}</tbody></table></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ustazName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-students.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf(items = shownStudents, ustazName = "All Ustazes") {
    const printWindow = window.open("", "quran-exam-students-pdf", "width=1000,height=800");
    if (!printWindow) { setNotice("Allow pop-ups to export the PDF."); return; }
    const includeUstaz = ustazName === "All Ustazes";
    printWindow.document.write(`<html><head><title>${exportValue(ustazName)} — Qur'an Exam Students</title><style>body{font-family:Arial;padding:24px}h1{color:#176b4e}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #b8c8bf;padding:7px;text-align:left}th{background:#e8f3ed}@media print{button{display:none}}</style></head><body><h1>Qur'an Revision Examination</h1><h2>${exportValue(ustazName)}</h2><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr>${includeUstaz ? "<th>Ustaz</th>" : ""}<th>Student number</th><th>Student name</th><th>Age</th><th>Study years</th><th>Study months</th><th>Level</th><th>Surah/Fesel number</th><th>Surah/Fesel name</th></tr></thead><tbody>${exportRows(items, includeUstaz)}</tbody></table><script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  }

  function closeForm() { setShowForm(false); setEditingStudent(null); setLevel("Qur'an"); setPlace(""); setUstazId(""); }
  function openCreate() { closeForm(); setShowForm(true); }
  function openEdit(student: Student) { setEditingStudent(student); setLevel(student.level); setPlace(student.learningPlace); setUstazId(student.ustazId); setShowForm(true); }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const age = Number(form.get("age"));
    const years = Number(form.get("studyYears") ?? 0);
    const months = Number(form.get("studyMonths") ?? 0);
    if (!name || !age || !place) return;
    const supabase = createClient();
    if (editingStudent) {
      const { error } = await supabase.rpc("update_student_registration", { p_registration_id: editingStudent.registrationId, p_full_name: name, p_registered_age: age, p_current_learning_level: level === "Alif" ? "alif" : "quran", p_current_learning_place: place, p_study_years: years, p_study_months: months });
      setNotice(error ? error.message : "Student updated.");
    } else if (periodId) {
      if (admin && !ustazId) { setNotice("Select an Ustaz first."); return; }
      const { error } = await supabase.rpc("register_student", { p_exam_period_id: periodId, p_full_name: name, p_registered_age: age, p_current_learning_level: level === "Alif" ? "alif" : "quran", p_current_learning_place: place, p_class_group: null, p_study_years: years, p_study_months: months, p_ustaz_id: admin ? ustazId : null });
      setNotice(error ? error.message : "Student registered.");
    }
    closeForm();
    await loadStudents();
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`Delete ${student.name} from this examination registration?`)) return;
    const { error } = await createClient().rpc("delete_student_registration", { p_registration_id: student.registrationId });
    setNotice(error ? error.message : "Student removed.");
    if (!error) await loadStudents();
  }

  const list = (items: Student[]) => <div className="student-list">{items.map((student) => <article className="student-row" key={student.registrationId}><div className="avatar">{student.name.slice(0, 1)}</div><div className="student-name"><strong>{student.name}</strong><span>{student.id} · Age {student.age}</span><em>{student.level === "Qur'an" ? `${student.learningPlace} — ${surahs[Number(student.learningPlace) - 1] ?? ""}` : `${student.learningPlace} — ${alifFesels[Number(student.learningPlace) - 1] ?? ""}`}</em></div><span className={`tag ${student.level === "Alif" ? "alif" : "quran"}`}>{student.level}</span><div className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(student)}>Edit</button><button className="text-button delete-button" type="button" onClick={() => removeStudent(student)}>Delete</button></div></article>)}</div>;

  return <><section className="panel"><div className="panel-heading"><div><h2>{admin ? "Students by Ustaz" : "የእኔ ተማሪዎች"}</h2><p>{admin ? "View and manage each Ustaz’s registered students." : "የተመዘገቡ ተማሪዎችን ይመልከቱ፣ ያስተካክሉ ወይም ይሰርዙ።"}</p></div><div className="manager-actions">{admin && <><button className="secondary-button" type="button" onClick={() => exportExcel()}>Export all Excel</button><button className="secondary-button" type="button" onClick={() => exportPdf()}>Export all PDF</button></>}<button className="secondary-button" type="button" onClick={openCreate}>Register student</button></div></div><div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" /><span>{shownStudents.length} students</span></div>{admin ? <div className="ustaz-groups">{groupedStudents.map(({ ustaz, students: groupStudents }) => <section className="ustaz-group" key={ustaz.id}><h3><span>{ustaz.full_name} · {groupStudents.length} students</span><span className="group-export-actions"><button className="text-button" type="button" onClick={() => exportExcel(groupStudents, ustaz.full_name)}>Excel</button><button className="text-button" type="button" onClick={() => exportPdf(groupStudents, ustaz.full_name)}>PDF</button></span></h3>{groupStudents.length ? list(groupStudents) : <p>No students registered yet.</p>}</section>)}</div> : list(shownStudents)}</section>{notice && <div className="toast" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}{showForm && <div className="modal-backdrop"><form className="modal" onSubmit={saveStudent}><div className="modal-heading"><h2>{editingStudent ? "Edit student" : "Register student"}</h2><button className="close" type="button" onClick={closeForm}>×</button></div>{admin && <label>Ustaz<select required value={ustazId} onChange={(event) => setUstazId(event.target.value)} disabled={Boolean(editingStudent)}><option value="">Select Ustaz</option>{ustazes.map((ustaz) => <option key={ustaz.id} value={ustaz.id}>{ustaz.full_name}</option>)}</select></label>}<label>Student full name<input name="name" required defaultValue={editingStudent?.name ?? ""} /></label><div className="form-grid"><label>Age<input name="age" required type="number" min="3" max="30" defaultValue={editingStudent?.age ?? ""} /></label><label>Study duration<div className="duration-inputs"><input name="studyYears" required type="number" min="0" max="30" defaultValue={editingStudent?.studyYears ?? 0} /><span>years</span><input name="studyMonths" required type="number" min="0" max="11" defaultValue={editingStudent?.studyMonths ?? 0} /><span>months</span></div></label></div><label>Learning level<select value={level} onChange={(event) => { setLevel(event.target.value as "Alif" | "Qur'an"); setPlace(""); }}><option value="Alif">Alif</option><option value="Qur'an">Qur'an</option></select></label><label>{level === "Qur'an" ? "Surah number (1–114)" : "Fesel number (1–20)"}<input required type="number" min="1" max={level === "Qur'an" ? 114 : 20} value={place} onChange={(event) => setPlace(event.target.value)} /></label><div className="place-preview"><span>Selected</span><strong>{level === "Qur'an" ? (place && surahs[Number(place) - 1] ? `${place} — ${surahs[Number(place) - 1]}` : "Enter a Surah number") : (place ? `ፈስል ${place}` : "Enter a Fesel number")}</strong></div><div className="modal-actions"><button className="secondary-button" type="button" onClick={closeForm}>Cancel</button><button type="submit">Save student</button></div></form></div>}</>;
}
