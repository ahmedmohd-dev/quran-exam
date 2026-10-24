"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { DirectorShell } from "@/components/director-shell";
import { createClient } from "@/lib/supabase/client";

type AttendanceRow = { id: string; student_id: string; studentName: string; ustazName: string; status: "present" | "absent" | "late"; note: string | null };
type PermissionRow = { id: string; student_id: string; studentName: string; ustazName: string; absence_date: string; parent_name: string; reason: string; status: "pending" | "approved" | "rejected"; response_note: string | null };
type StudentOption = { id: string; name: string; ustazId: string; ustazName: string };

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function DirectorAttendancePage() {
  const [date, setDate] = useState(localDate);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [parentName, setParentName] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setMessage("መረጃውን በመጫን ላይ…");
    const supabase = createClient();
    const [{ data: attendanceRows, error: attendanceError }, { data: permissionRows, error: permissionError }, { data: registrationRows, error: registrationError }] = await Promise.all([
      supabase.from("attendance_records").select("id,student_id,status,note,student:students(full_name),ustaz:profiles!attendance_records_ustaz_id_fkey(full_name)").eq("attendance_date", date).eq("status", "absent").order("created_at"),
      supabase.from("attendance_permissions").select("id,student_id,absence_date,parent_name,reason,status,response_note,student:students(full_name),ustaz:profiles!attendance_permissions_ustaz_id_fkey(full_name)").eq("absence_date", date).order("created_at", { ascending: false }),
      supabase.from("student_registrations").select("student_id,ustaz_id,student:students(full_name),ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)").order("created_at", { ascending: false }),
    ]);
    const error = attendanceError ?? permissionError ?? registrationError;
    if (error) { setMessage(error.message); return; }
    const name = (value: unknown) => (value as { full_name?: string } | null)?.full_name ?? "—";
    setAttendance((attendanceRows ?? []).map((row) => ({ id: row.id, student_id: row.student_id, studentName: name(row.student), ustazName: name(row.ustaz), status: row.status, note: row.note })));
    setPermissions((permissionRows ?? []).map((row) => ({ id: row.id, student_id: row.student_id, studentName: name(row.student), ustazName: name(row.ustaz), absence_date: row.absence_date, parent_name: row.parent_name, reason: row.reason, status: row.status, response_note: row.response_note })));
    const unique = new Map<string, StudentOption>();
    (registrationRows ?? []).forEach((row) => unique.set(row.student_id, { id: row.student_id, name: name(row.student), ustazId: row.ustaz_id, ustazName: name(row.ustaz) }));
    setStudents(Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name)));
    setMessage("");
  }

  useEffect(() => { void load(); }, [date]);

  async function review(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const { data: { user } } = await createClient().auth.getUser();
    const { error } = await createClient().from("attendance_permissions").update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    setBusy(null);
    if (error) setMessage(error.message); else await load();
  }

  async function addPermission(event: FormEvent) {
    event.preventDefault();
    const student = students.find((item) => item.id === selectedStudent);
    if (!student || !parentName.trim() || !reason.trim()) return;
    setBusy("new");
    const { error } = await createClient().from("attendance_permissions").insert({ student_id: student.id, ustaz_id: student.ustazId, absence_date: date, parent_name: parentName.trim(), reason: reason.trim() });
    setBusy(null);
    if (error) setMessage(error.message); else { setSelectedStudent(""); setParentName(""); setReason(""); await load(); }
  }

  const pending = useMemo(() => permissions.filter((item) => item.status === "pending"), [permissions]);
  const approved = useMemo(() => permissions.filter((item) => item.status === "approved"), [permissions]);

  return <DirectorShell><header className="workspace-header director-header"><div><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link><p className="eyebrow">የዕለት ክትትል</p><h1>መገኘት እና የወላጅ ፈቃድ</h1><p>የቀሩ ተማሪዎችን እና የወላጆችን ፈቃድ በፍጥነት ይከታተሉ።</p></div><label className="director-date-filter">ቀን<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
    {message && <p className="admin-message">{message}</p>}
    {!message && <><section className="metrics director-metrics attendance-dashboard-metrics"><article><span>የቀሩ</span><strong>{attendance.length}</strong></article><article><span>ፈቃድ የሚጠብቁ</span><strong>{pending.length}</strong></article><article><span>ፈቃድ ያገኙ</span><strong>{approved.length}</strong></article></section>
      <section className="attendance-dashboard-grid"><article className="panel dashboard-panel"><div className="panel-heading"><h2>ፈቃድ የሚጠብቁ</h2><span>{pending.length}</span></div>{pending.map((item) => <div className="permission-row" key={item.id}><div><strong>{item.studentName}</strong><small>{item.ustazName} · {item.parent_name}</small><p>{item.reason}</p></div><div className="permission-actions"><button type="button" disabled={busy === item.id} onClick={() => void review(item.id, "approved")}>ፍቀድ</button><button type="button" className="danger-button" disabled={busy === item.id} onClick={() => void review(item.id, "rejected")}>አትፍቀድ</button></div></div>)}{!pending.length && <p className="empty-state">ለዚህ ቀን የሚጠብቅ ፈቃድ የለም።</p>}</article><article className="panel dashboard-panel"><div className="panel-heading"><h2>የወላጅ ፈቃድ መመዝገብ</h2></div><form className="permission-form" onSubmit={addPermission}><label>ተማሪ<select value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} required><option value="">ተማሪ ይምረጡ…</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.ustazName}</option>)}</select></label><label>የወላጅ ስም<input value={parentName} onChange={(event) => setParentName(event.target.value)} required /></label><label>ምክንያት<textarea value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} /></label><button type="submit" disabled={busy === "new"}>{busy === "new" ? "በማስቀመጥ ላይ…" : "ፈቃድ መዝግብ"}</button></form></article></section>
      <section className="panel dashboard-panel attendance-absent-panel"><div className="panel-heading"><h2>ዛሬ የቀሩ ተማሪዎች</h2><span>{attendance.length}</span></div>{attendance.map((item) => <div className="absent-row" key={item.id}><strong>{item.studentName}</strong><span>{item.ustazName}</span><small>{item.note || "ማስታወሻ የለም"}</small></div>)}{!attendance.length && <p className="empty-state">በዚህ ቀን የቀረ ተማሪ የለም።</p>}</section></>}
  </DirectorShell>;
}
