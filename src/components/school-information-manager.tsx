"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { surahs } from "@/lib/surahs";
import { alifFesels } from "@/lib/alif-fesels";

type SchoolStudent = {
  id: string;
  studentId: string | null;
  fullName: string;
  age: number | null;
  academicGrade: string;
  schoolName: string;
  schoolType: "public" | "private" | "not_studying" | "";
  attendanceSchedule: "morning" | "afternoon" | "full_day" | "";
  learningPlaceType: "qaida_nuraniya" | "qaida_baghdadiya" | "quran" | "";
  learningPlaceNumber: string;
  quranLevel: "beginner" | "intermediate" | "advanced" | "";
  schoolDismissalTime: string;
  mederesaArrivalTime: string;
  notes: string;
  examStudent: boolean;
};

const emptyForm = {
  fullName: "",
  age: "",
  academicGrade: "",
  schoolName: "",
  schoolType: "",
  attendanceSchedule: "",
  learningPlaceType: "",
  learningPlaceNumber: "",
  quranLevel: "",
  schoolDismissalTime: "",
  mederesaArrivalTime: "",
  notes: "",
};

function mapSchoolStudent(row: Record<string, unknown>): SchoolStudent {
  return {
    id: String(row.id),
    studentId: row.student_id ? String(row.student_id) : null,
    fullName: String(row.full_name ?? ""),
    age: row.age == null ? null : Number(row.age),
    academicGrade: String(row.academic_grade ?? ""),
    schoolName: String(row.school_name ?? ""),
    schoolType: (row.school_type as SchoolStudent["schoolType"]) ?? "",
    attendanceSchedule:
      (row.attendance_schedule as SchoolStudent["attendanceSchedule"]) ?? "",
    learningPlaceType:
      (row.learning_place_type as SchoolStudent["learningPlaceType"]) ?? "",
    learningPlaceNumber: row.learning_place_number == null ? "" : String(row.learning_place_number),
    quranLevel: (row.quran_level as SchoolStudent["quranLevel"]) ?? "",
    schoolDismissalTime: String(row.school_dismissal_time ?? "").slice(0, 5),
    mederesaArrivalTime: String(row.mederesa_arrival_time ?? "").slice(0, 5),
    notes: String(row.notes ?? ""),
    examStudent: Boolean(row.student_id),
  };
}

export function SchoolInformationManager() {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("የትምህርት ቤት መረጃ በመጫን ላይ…");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SchoolStudent | null>(null);
  const [formState, setForm] = useState(emptyForm);
  const form = { ...emptyForm, ...formState };

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: saved, error: savedError }, { data: period }] = await Promise.all([
      supabase.from("ustaz_school_students").select("*").eq("ustaz_id", user.id).order("full_name"),
      supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (savedError) { setNotice(savedError.message); return; }

    const savedRows = (saved ?? []).map((row) => mapSchoolStudent(row as Record<string, unknown>));
    let examRows: SchoolStudent[] = [];
    if (period) {
      const { data: registrations } = await supabase
        .from("student_registrations")
        .select("student_id,registered_age,student:students(full_name)")
        .eq("exam_period_id", period.id)
        .eq("ustaz_id", user.id);
      examRows = (registrations ?? []).map((row) => {
        const student = row.student as unknown as { full_name: string };
        return {
          ...mapSchoolStudent({ id: `exam-${row.student_id}`, student_id: row.student_id, full_name: student.full_name, age: row.registered_age }),
        };
      });
    }
    const savedByStudent = new Map(savedRows.filter((row) => row.studentId).map((row) => [row.studentId, row]));
    const merged = examRows.map((row) => savedByStudent.get(row.studentId) ?? row);
    const newRows = savedRows.filter((row) => !row.studentId);
    setStudents([...merged, ...newRows]);
    setNotice("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!notice || notice === "የትምህርት ቤት መረጃ በመጫን ላይ…") return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visible = useMemo(() => students.filter((student) => `${student.fullName} ${student.schoolName} ${student.academicGrade}`.toLowerCase().includes(query.toLowerCase())), [students, query]);

  function openNew() { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }
  function openEdit(student: SchoolStudent) {
    setEditing(student);
    setForm({ fullName: student.fullName ?? "", age: student.age?.toString() ?? "", academicGrade: student.academicGrade ?? "", schoolName: student.schoolName ?? "", schoolType: student.schoolType ?? "", attendanceSchedule: student.attendanceSchedule ?? "", learningPlaceType: student.learningPlaceType ?? "", learningPlaceNumber: student.learningPlaceNumber ?? "", quranLevel: student.quranLevel ?? "", schoolDismissalTime: student.schoolDismissalTime ?? "", mederesaArrivalTime: student.mederesaArrivalTime ?? "", notes: student.notes ?? "" });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditing(null); setForm({ ...emptyForm }); }
  function update(field: keyof typeof emptyForm, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.fullName.trim() || (form.schoolType !== "not_studying" && !form.schoolName.trim())) { setNotice("ስም ያስገቡ፤ ካሁን አይማርም ካልተመረጠ የትምህርት ቤት ስምም ያስገቡ።"); return; }
    const supabase = createClient();
    const values = { full_name: form.fullName.trim(), age: form.age ? Number(form.age) : null, academic_grade: form.academicGrade.trim() || null, school_name: form.schoolType === "not_studying" ? null : form.schoolName.trim() || null, school_type: form.schoolType || null, attendance_schedule: form.schoolType === "not_studying" ? null : form.attendanceSchedule || null, learning_place_type: form.learningPlaceType || null, learning_place_number: form.learningPlaceNumber ? Number(form.learningPlaceNumber) : null, quran_level: form.quranLevel || null, school_dismissal_time: form.schoolType === "not_studying" ? null : form.schoolDismissalTime || null, mederesa_arrival_time: form.mederesaArrivalTime || null, notes: form.notes.trim() || null };
    let error;
    if (editing?.id.startsWith("exam-")) {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("ustaz_school_students").insert({ ...values, ustaz_id: user?.id, student_id: editing.studentId });
      error = insertError;
    } else if (editing) {
      const response = await supabase.from("ustaz_school_students").update(values).eq("id", editing.id);
      error = response.error;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("ustaz_school_students").insert({ ...values, ustaz_id: user?.id });
      error = insertError;
    }
    setNotice(error ? error.message : "የትምህርት ቤት መረጃ ተቀምጧል።");
    if (!error) { closeForm(); await load(); }
  }

  async function remove(student: SchoolStudent) {
    if (student.examStudent) { setNotice("ይህ የፈተና ተማሪ ነው፤ እዚህ ላይ መሰረዝ አይቻልም።"); return; }
    if (!window.confirm("ይህን የትምህርት መረጃ ሰርዘው?")) return;
    const { error } = await createClient().from("ustaz_school_students").delete().eq("id", student.id);
    setNotice(error ? error.message : "ተሰርዟል።");
    if (!error) await load();
  }

  const nuraniyaLessons = [
    "الدرس الأول", "الدرس الثاني", "الدرس الثالث", "الدرس الرابع",
    "الدرس الخامس", "الدرس السادس", "الدرس السابع", "الدرس الثامن",
    "الدرس التاسع", "الدرس العاشر", "الدرس الحادي عشر", "الدرس الثاني عشر",
    "الدرس الثالث عشر", "الدرس الرابع عشر", "الدرس الخامس عشر", "الدرس السادس عشر",
    "الدرس السابع عشر",
  ];
  function learningPlaceLabel(student: SchoolStudent) {
    const number = Number(student.learningPlaceNumber);
    if (!student.learningPlaceType || !number) return "የመማሪያ ቦታ አልተመዘገበም";
    if (student.learningPlaceType === "quran") return `${number} · ${surahs[number - 1] ?? ""}`;
    if (student.learningPlaceType === "qaida_nuraniya") return `${number} · ${nuraniyaLessons[number - 1] ?? ""}`;
    return `${number} · ${alifFesels[number - 1] ?? ""}`;
  }
  const schoolTypeLabel = (value: SchoolStudent["schoolType"]) => value === "public" ? "መንግስት" : value === "private" ? "የግል" : value === "not_studying" ? "አሁን አይማርም" : "";

  return <>
    <section className="panel school-information-panel">
      <div className="panel-heading"><div><h2>የትምህርት ቤት መረጃ</h2><p>የተማሪዎችዎን የትምህርት ቤትና የመድረሳ ጊዜ ይመዝግቡ።</p></div><button type="button" className="secondary-button" onClick={openNew}>አዲስ ተማሪ ጨምር</button></div>
      <div className="toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ተማሪ ወይም ትምህርት ቤት ፈልግ" /><span>{visible.length} ተማሪዎች</span></div>
      <div className="student-list">{visible.map((student) => <article className="student-row school-information-row" key={student.id}><div className="avatar">{student.fullName.slice(0, 1)}</div><div className="student-name"><strong>{student.fullName}</strong><span>{student.examStudent ? "በፈተና የተመዘገበ" : "አዲስ የተመዘገበ"} · {student.age ? `ዕድሜ ${student.age}` : "ዕድሜ አልተሞላም"}</span><em>{student.schoolName || schoolTypeLabel(student.schoolType) || "የትምህርት ቤት ስም አልተመዘገበም"} {student.schoolType && student.schoolType !== "not_studying" ? `· ${schoolTypeLabel(student.schoolType)}` : ""}</em><small>{learningPlaceLabel(student)}</small></div><div className="school-information-meta"><span>{student.attendanceSchedule === "full_day" ? "ሙሉ ቀን" : student.attendanceSchedule === "morning" ? "ጠዋት" : student.attendanceSchedule === "afternoon" ? "ከሰዓት" : "ፈረቃ አልተመዘገበም"}</span>{student.mederesaArrivalTime && <small>መድረሻ: {student.mederesaArrivalTime}</small>}</div><div className="row-actions"><button className="text-button" type="button" onClick={() => openEdit(student)}>አስተካክል</button>{!student.examStudent && <button className="text-button delete-button" type="button" onClick={() => remove(student)}>ሰርዝ</button>}</div></article>)}{!visible.length && <p className="empty-state">ተማሪ አልተገኘም።</p>}</div>
    </section>
    {notice && <div className="toast" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    {showForm && <div className="modal-backdrop"><form className="modal school-information-form" onSubmit={save}><div className="modal-heading"><h2>{editing ? "የትምህርት መረጃ አስተካክል" : "አዲስ ተማሪ መዝግብ"}</h2><button className="close" type="button" onClick={closeForm}>×</button></div><p className="form-help">ይህ መረጃ ለትምህርት ቤት መከታተያ ብቻ ነው፤ የፈተና ምዝገባን አይቀይርም።</p><label>የተማሪ ሙሉ ስም<input required value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><div className="form-grid"><label>ዕድሜ<input type="number" min="3" max="30" value={form.age} onChange={(event) => update("age", event.target.value)} /></label><label>የክፍል ደረጃ<input value={form.academicGrade} onChange={(event) => update("academicGrade", event.target.value)} placeholder="ለምሳሌ 4ኛ" /></label></div><div className="form-grid"><label>የትምህርት ቤት አይነት<select value={form.schoolType} onChange={(event) => update("schoolType", event.target.value)}><option value="">ይምረጡ</option><option value="public">መንግስት</option><option value="private">የግል</option><option value="not_studying">አሁን አይማርም</option></select></label><label>የትምህርት ፈረቃ<select disabled={form.schoolType === "not_studying"} value={form.attendanceSchedule} onChange={(event) => update("attendanceSchedule", event.target.value)}><option value="">ይምረጡ</option><option value="morning">ጠዋት</option><option value="afternoon">ከሰዓት</option><option value="full_day">ሙሉ ቀን</option></select></label></div><label>የትምህርት ቤት ስም<input required={form.schoolType !== "not_studying"} disabled={form.schoolType === "not_studying"} value={form.schoolName} onChange={(event) => update("schoolName", event.target.value)} /></label><div className="form-grid"><label>አሁን ያለበት የቁርአን ደረጃ<select value={form.learningPlaceType} onChange={(event) => { update("learningPlaceType", event.target.value); update("learningPlaceNumber", ""); }}><option value="">ይምረጡ</option><option value="qaida_nuraniya">ቃኢዳ ኑራኒያ</option><option value="qaida_baghdadiya">ቃኢዳ ባግዳዲያ</option><option value="quran">ቁርአን</option></select></label><label>የቦታ ቁጥር<select disabled={!form.learningPlaceType} value={form.learningPlaceNumber} onChange={(event) => update("learningPlaceNumber", event.target.value)}><option value="">ይምረጡ</option>{form.learningPlaceType === "quran" && Array.from({ length: 114 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} · {surahs[index]}</option>)}{form.learningPlaceType === "qaida_nuraniya" && nuraniyaLessons.map((lesson, index) => <option key={index + 1} value={index + 1}>{index + 1} · {lesson}</option>)}{form.learningPlaceType === "qaida_baghdadiya" && alifFesels.map((fesel, index) => <option key={index + 1} value={index + 1}>{index + 1} · {fesel}</option>)}</select></label></div><div className="place-preview"><span>የተመረጠ ቦታ</span><strong>{form.learningPlaceType && form.learningPlaceNumber ? learningPlaceLabel({ learningPlaceType: form.learningPlaceType, learningPlaceNumber: form.learningPlaceNumber } as SchoolStudent) : "ቦታ ይምረጡ"}</strong></div><label>የቁርአን ደረጃ<select value={form.quranLevel} onChange={(event) => update("quranLevel", event.target.value)}><option value="">ይምረጡ</option><option value="beginner">ደካማ</option><option value="intermediate">መካከለኛ</option><option value="advanced">ጎበዝ</option></select></label><div className="form-grid"><label>ትምህርት የሚያበቃበት ሰዓት (24)<input lang="en-GB" type="time" disabled={form.schoolType === "not_studying"} value={form.schoolDismissalTime} onChange={(event) => update("schoolDismissalTime", event.target.value)} /></label><label>መድረሳ የሚገባበት ሰዓት (24)<input lang="en-GB" type="time" value={form.mederesaArrivalTime} onChange={(event) => update("mederesaArrivalTime", event.target.value)} /></label></div><label>ማስታወሻ<textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><div className="modal-actions"><button className="secondary-button" type="button" onClick={closeForm}>ተወው</button><button type="submit">አስቀምጥ</button></div></form></div>}
  </>;
}
