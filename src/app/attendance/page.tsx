"use client";

import { useEffect, useMemo, useState } from "react";
import { UstazShell } from "@/components/ustaz-shell";
import { createClient } from "@/lib/supabase/client";

type Student = { id: string; name: string; age: number | null };
type Status = "present" | "absent" | "late" | "unmarked";
type Attendance = { status: Status; note: string };

function localDate() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [date, setDate] = useState(localDate);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [message, setMessage] = useState("የመገኘት መረጃ በመጫን ላይ…");
  const [saving, setSaving] = useState(false);

  async function load(selectedDate = date) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setMessage("የተማሪ ምዝገባ አልተገኘም።"); return; }
    const [{ data: registrations, error: registrationError }, { data: records, error: recordsError }] = await Promise.all([
      supabase.from("student_registrations").select("student_id,registered_age,student:students(full_name)").eq("exam_period_id", period.id).eq("ustaz_id", user.id).order("created_at"),
      supabase.from("attendance_records").select("student_id,status,note").eq("ustaz_id", user.id).eq("attendance_date", selectedDate),
    ]);
    if (registrationError || recordsError) { setMessage((registrationError ?? recordsError)?.message ?? "መረጃ አልተገኘም።"); return; }
    setStudents((registrations ?? []).map((row) => ({ id: row.student_id, name: (row.student as unknown as { full_name: string })?.full_name ?? "—", age: row.registered_age })));
    const next: Record<string, Attendance> = {};
    (records ?? []).forEach((row) => { next[row.student_id] = { status: row.status as Status, note: row.note ?? "" }; });
    setAttendance(next);
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [date]);

  function update(studentId: string, field: keyof Attendance, value: string) {
    setAttendance((current) => ({ ...current, [studentId]: { status: current[studentId]?.status ?? "unmarked", note: current[studentId]?.note ?? "", [field]: value } }));
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const marked = students.filter((student) => attendance[student.id]?.status !== "unmarked").map((student) => ({ student_id: student.id, ustaz_id: user.id, attendance_date: date, status: attendance[student.id].status, note: attendance[student.id].note.trim() || null, marked_by: user.id }));
    const unmarkedIds = students.filter((student) => !attendance[student.id] || attendance[student.id].status === "unmarked").map((student) => student.id);
    const { error: saveError } = marked.length ? await supabase.from("attendance_records").upsert(marked, { onConflict: "student_id,attendance_date" }) : { error: null };
    const { error: clearError } = unmarkedIds.length ? await supabase.from("attendance_records").delete().eq("ustaz_id", user.id).eq("attendance_date", date).in("student_id", unmarkedIds) : { error: null };
    setSaving(false);
    setMessage(saveError?.message ?? clearError?.message ?? "የመገኘት መረጃ ተቀምጧል።");
    if (!saveError && !clearError) await load(date);
  }

  const counts = useMemo(() => {
    const values = students.map((student) => attendance[student.id]?.status ?? "unmarked");
    return { present: values.filter((value) => value === "present").length, absent: values.filter((value) => value === "absent").length, late: values.filter((value) => value === "late").length, unmarked: values.filter((value) => value === "unmarked").length };
  }, [students, attendance]);

  return <UstazShell><header className="ustaz-results-header"><p className="eyebrow">የዕለት መገኘት</p><h1>የተማሪዎች መገኘት</h1><p>በየቀኑ የተማሪዎችን መገኘት ይመዝግቡ።</p></header>{message && <p className="admin-message">{message}</p>}{!message && <><section className="attendance-toolbar"><label>ቀን<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button type="button" onClick={() => void save()} disabled={saving || !students.length}>{saving ? "በማስቀመጥ ላይ…" : "አስቀምጥ"}</button></section><section className="result-metrics attendance-metrics"><article><span>የተገኙ</span><strong>{counts.present}</strong></article><article><span>የቀሩ</span><strong>{counts.absent}</strong></article><article><span>የዘገዩ</span><strong>{counts.late}</strong></article><article><span>ያልተመዘገቡ</span><strong>{counts.unmarked}</strong></article></section><section className="panel attendance-list">{students.map((student, index) => <article className="attendance-row" key={student.id}><div className="avatar">{index + 1}</div><div className="student-name"><strong>{student.name}</strong><span>{student.age ? `ዕድሜ ${student.age}` : ""}</span></div><select value={attendance[student.id]?.status ?? "unmarked"} onChange={(event) => update(student.id, "status", event.target.value)}><option value="unmarked">አልተመዘገበም</option><option value="present">ተገኝቷል</option><option value="absent">ቀርቷል</option><option value="late">ዘግይቷል</option></select><input value={attendance[student.id]?.note ?? ""} onChange={(event) => update(student.id, "note", event.target.value)} placeholder="ማስታወሻ (አማራጭ)" /></article>)}{!students.length && <p className="empty-state">በዚህ ወቅት ተማሪ አልተገኘም።</p>}</section></>}</UstazShell>;
}
