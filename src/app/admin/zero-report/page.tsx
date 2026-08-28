"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type ZeroRow = {
  student: string;
  age: number | null;
  ustaz: string;
  hisnul: number | null;
  homework: number | null;
};

function zeroCategories(row: ZeroRow) {
  if (row.hisnul === 0 && row.homework === 0) return "Hisnul Muslim + Homework";
  if (row.hisnul === 0) return "Hisnul Muslim";
  return "Homework";
}

export default function AdminZeroReportPage() {
  const [periodName, setPeriodName] = useState("");
  const [rows, setRows] = useState<ZeroRow[]>([]);
  const [message, setMessage] = useState("Loading zero-mark report...");

  const load = useCallback(async () => {
    setMessage("Loading zero-mark report...");
    const supabase = createClient();
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id,name").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setMessage(periodError?.message ?? "No examination period was found."); return; }

    const [registrationQuery, supplementalQuery] = await Promise.all([
      supabase.from("student_registrations").select("id,student_id,ustaz_id,registered_age").eq("exam_period_id", period.id),
      supabase.from("exam_supplemental_results").select("student_registration_id,hisnul_muslim_mark,homework_mark"),
    ]);
    const error = [registrationQuery.error, supplementalQuery.error].find(Boolean);
    if (error) { setMessage(error.message); return; }

    const registrations = registrationQuery.data ?? [];
    const studentIds = [...new Set(registrations.map((registration) => registration.student_id))];
    const ustazIds = [...new Set(registrations.map((registration) => registration.ustaz_id))];
    const [studentQuery, ustazQuery] = await Promise.all([
      studentIds.length ? supabase.from("students").select("id,full_name").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
      ustazIds.length ? supabase.from("profiles").select("id,full_name").in("id", ustazIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const lookupError = [studentQuery.error, ustazQuery.error].find(Boolean);
    if (lookupError) { setMessage(lookupError.message); return; }

    const studentsById = new Map((studentQuery.data ?? []).map((student) => [student.id, student.full_name]));
    const ustazesById = new Map((ustazQuery.data ?? []).map((ustaz) => [ustaz.id, ustaz.full_name]));
    const supplementalByRegistration = new Map((supplementalQuery.data ?? []).map((result) => [result.student_registration_id, result]));
    const zeroRows = registrations.flatMap((registration) => {
      const supplemental = supplementalByRegistration.get(registration.id);
      if (!supplemental || (supplemental.hisnul_muslim_mark !== 0 && supplemental.homework_mark !== 0)) return [];
      return [{ student: studentsById.get(registration.student_id) ?? "—", age: registration.registered_age, ustaz: ustazesById.get(registration.ustaz_id) ?? "—", hisnul: supplemental.hisnul_muslim_mark, homework: supplemental.homework_mark }];
    }).sort((first, second) => first.ustaz.localeCompare(second.ustaz) || first.student.localeCompare(second.student));

    setPeriodName(period.name ?? "Current examination");
    setRows(zeroRows);
    setMessage("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const hisnulZero = rows.filter((row) => row.hisnul === 0).length;
  const homeworkZero = rows.filter((row) => row.homework === 0).length;
  const bothZero = rows.filter((row) => row.hisnul === 0 && row.homework === 0).length;

  return <AdminShell active="zeroReport">
    <header className="workspace-header">
      <div><p className="eyebrow">EXAM ADMIN · REPORT</p><h1>Zero-mark report</h1><p>Students with a recorded zero in Hisnul Muslim or Homework, grouped by their Ustaz.</p>{periodName && <small className="age-results-period">{periodName}</small>}</div>
      <button className="secondary-button" type="button" onClick={() => void load()}>Refresh report</button>
    </header>
    {message && <p className="admin-message">{message}</p>}
    {!message && <>
      <section className="result-metrics age-result-metrics">
        <article><span>Students with any zero</span><strong>{rows.length}</strong></article>
        <article><span>Hisnul Muslim zero</span><strong>{hisnulZero}</strong></article>
        <article><span>Homework zero</span><strong>{homeworkZero}</strong></article>
        <article><span>Zero in both</span><strong>{bothZero}</strong></article>
      </section>
      <section className="admin-card age-results-card">
        <div className="card-title"><div><h2>Students and Ustazes</h2><p>Only recorded zero marks are included; missing marks are not counted as zero.</p></div></div>
        <div className="age-results-table-wrap"><table className="age-results-table"><thead><tr><th>Student</th><th>Age</th><th>Ustaz</th><th>Zero result</th><th>Hisnul Muslim</th><th>Homework</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.student}-${row.ustaz}`}><th>{row.student}</th><td>{row.age ?? "—"}</td><td>{row.ustaz}</td><td><strong>{zeroCategories(row)}</strong></td><td>{row.hisnul === null ? "—" : `${row.hisnul} / 20`}</td><td>{row.homework === null ? "—" : `${row.homework} / 5`}</td></tr>)}</tbody></table></div>
        {!rows.length && <p className="empty-state">No recorded zero marks were found.</p>}
      </section>
    </>}
  </AdminShell>;
}
