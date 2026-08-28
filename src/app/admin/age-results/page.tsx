"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Registration = { id: string; registered_age: number | null };
type QuranResult = { student_registration_id: string; status: "draft" | "submitted"; total_mark: number | null };
type SupplementalResult = { student_registration_id: string; hisnul_muslim_mark: number | null; homework_mark: number | null };

type AgeResult = {
  age: number;
  registered: number;
  quranCount: number;
  quranAverage: number | null;
  hisnulCount: number;
  hisnulAverage: number | null;
  homeworkCount: number;
  homeworkAverage: number | null;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function formatAverage(value: number | null) {
  return value === null ? "—" : value.toFixed(2);
}

export default function AdminAgeResultsPage() {
  const [periodName, setPeriodName] = useState("");
  const [rows, setRows] = useState<AgeResult[]>([]);
  const [message, setMessage] = useState("Loading age results...");

  const load = useCallback(async () => {
    setMessage("Loading age results...");
    const supabase = createClient();
    const { data: period, error: periodError } = await supabase
      .from("exam_periods")
      .select("id,name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodError || !period) {
      setMessage(periodError?.message ?? "No examination period was found.");
      return;
    }

    const [registrationQuery, resultQuery, supplementalQuery] = await Promise.all([
      supabase.from("student_registrations").select("id,registered_age").eq("exam_period_id", period.id),
      supabase.from("exam_results").select("student_registration_id,status,total_mark").eq("exam_period_id", period.id).eq("status", "submitted"),
      supabase.from("exam_supplemental_results").select("student_registration_id,hisnul_muslim_mark,homework_mark"),
    ]);
    const error = [registrationQuery.error, resultQuery.error, supplementalQuery.error].find(Boolean);
    if (error) {
      setMessage(error.message);
      return;
    }

    setPeriodName(period.name ?? "Current examination");
    const registrations = (registrationQuery.data ?? []) as Registration[];
    const quranResults = (resultQuery.data ?? []) as QuranResult[];
    const supplementalResults = (supplementalQuery.data ?? []) as SupplementalResult[];
    const ageByRegistration = new Map(registrations.map((registration) => [registration.id, registration.registered_age]));
    const supplementalByRegistration = new Map(supplementalResults.map((result) => [result.student_registration_id, result]));
    const grouped = new Map<number, { registered: number; quran: number[]; hisnul: number[]; homework: number[] }>();

    registrations.forEach((registration) => {
      if (registration.registered_age === null || registration.registered_age < 0) return;
      const current = grouped.get(registration.registered_age) ?? { registered: 0, quran: [], hisnul: [], homework: [] };
      current.registered += 1;
      grouped.set(registration.registered_age, current);
    });

    quranResults.forEach((result) => {
      const age = ageByRegistration.get(result.student_registration_id);
      if (age === null || age === undefined) return;
      const current = grouped.get(age) ?? { registered: 0, quran: [], hisnul: [], homework: [] };
      if (result.total_mark !== null) current.quran.push(Number(result.total_mark));
      const supplemental = supplementalByRegistration.get(result.student_registration_id);
      if (supplemental?.hisnul_muslim_mark !== null && supplemental?.hisnul_muslim_mark !== undefined) current.hisnul.push(Number(supplemental.hisnul_muslim_mark));
      if (supplemental?.homework_mark !== null && supplemental?.homework_mark !== undefined) current.homework.push(Number(supplemental.homework_mark));
      grouped.set(age, current);
    });

    setRows([...grouped.entries()].sort(([first], [second]) => first - second).map(([age, values]) => ({
      age,
      registered: values.registered,
      quranCount: values.quran.length,
      quranAverage: average(values.quran),
      hisnulCount: values.hisnul.length,
      hisnulAverage: average(values.hisnul),
      homeworkCount: values.homework.length,
      homeworkAverage: average(values.homework),
    })));
    setMessage("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => ({
    registered: rows.reduce((sum, row) => sum + row.registered, 0),
    quran: rows.reduce((sum, row) => sum + row.quranCount, 0),
    hisnul: rows.reduce((sum, row) => sum + row.hisnulCount, 0),
    homework: rows.reduce((sum, row) => sum + row.homeworkCount, 0),
  }), [rows]);

  return <AdminShell active="ageResults">
    <header className="workspace-header">
      <div><p className="eyebrow">EXAM ADMIN</p><h1>Results by age</h1><p>Compare the average Qur’an, Hisnul Muslim, and Homework results for each student age.</p>{periodName && <small className="age-results-period">{periodName}</small>}</div>
      <button className="secondary-button" type="button" onClick={() => void load()}>Refresh results</button>
    </header>
    {message && <p className="admin-message">{message}</p>}
    {!message && <>
      <section className="result-metrics age-result-metrics">
        <article><span>Registered students</span><strong>{totals.registered}</strong></article>
        <article><span>Qur’an results</span><strong>{totals.quran}</strong></article>
        <article><span>Hisnul Muslim filled</span><strong>{totals.hisnul}</strong></article>
        <article><span>Homework filled</span><strong>{totals.homework}</strong></article>
      </section>
      <section className="admin-card age-results-card">
        <div className="card-title"><div><h2>Average results by age</h2><p>Qur’an is out of 100, Hisnul Muslim is out of 20, and Homework is out of 5.</p></div></div>
        <div className="age-results-table-wrap"><table className="age-results-table"><thead><tr><th>Age</th><th>Registered</th><th>Qur’an average / 100</th><th>Hisnul Muslim average / 20</th><th>Homework average / 5</th></tr></thead><tbody>{rows.map((row) => <tr key={row.age}><th>{row.age} years</th><td>{row.registered}</td><td><strong>{formatAverage(row.quranAverage)}</strong><small>{row.quranCount} submitted</small></td><td><strong>{formatAverage(row.hisnulAverage)}</strong><small>{row.hisnulCount} filled</small></td><td><strong>{formatAverage(row.homeworkAverage)}</strong><small>{row.homeworkCount} filled</small></td></tr>)}</tbody></table></div>
        {!rows.length && <p className="empty-state">No age data is available for this examination.</p>}
      </section>
    </>}
  </AdminShell>;
}
