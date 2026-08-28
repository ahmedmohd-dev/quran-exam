"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";
import { createClient } from "@/lib/supabase/client";

type Settings = { quranDurationYears: number; hisnulDurationYears: number; homeworkDurationYears: number; alifFesel: number; quranSurah: number; minHisnul: number; minHomework: number };
type Registration = { id: string; student_id: string; ustaz_id: string; registered_age: number | null; study_years: number | null; study_months: number | null; current_learning_level: "alif" | "quran"; current_learning_place: string | null };
type Result = { student_registration_id: string; status: "submitted" | "draft"; total_mark: number | null };
type Supplemental = { student_registration_id: string; hisnul_muslim_mark: number | null; homework_mark: number | null };
type Finding = { category: "quran" | "hisnul" | "homework"; registrationId: string; student: string; age: number | null; ustaz: string; issues: string[]; quran: number | null; hisnul: number | null; homework: number | null };

const defaults: Settings = { quranDurationYears: 1, hisnulDurationYears: 1, homeworkDurationYears: 1, alifFesel: 17, quranSurah: 90, minHisnul: 10, minHomework: 2.5 };
const storageKey = "quran-exam-admin-standards";
const categoryDefinitions: Array<{ id: Finding["category"]; title: string; description: string }> = [{ id: "quran", title: "Qur’an study progress", description: "Students whose study duration and current Qur’an/Alif place are below the selected standard." }, { id: "hisnul", title: "Hisnul Muslim standard", description: "Students whose Hisnul Muslim result is missing or below the selected minimum." }, { id: "homework", title: "Homework standard", description: "Students whose Homework result is missing or below the selected minimum." }];

function placeName(level: Registration["current_learning_level"], place: number) {
  return level === "quran" ? `Surah ${place} · ${surahs[place - 1] ?? ""}` : `Fesel ${place} · ${alifFesels[place - 1] ?? ""}`;
}

function yearsAtMederesa(registration: Registration) {
  return Number(registration.study_years ?? 0) + Number(registration.study_months ?? 0) / 12;
}

export default function AdminStandardsPage() {
  const [draft, setDraft] = useState<Settings>(defaults);
  const [applied, setApplied] = useState<Settings>(defaults);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [periodName, setPeriodName] = useState("");
  const [message, setMessage] = useState("Loading below-standard students...");
  const [openUstazes, setOpenUstazes] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setMessage("Loading below-standard students...");
    const supabase = createClient();
    const { data: period, error: periodError } = await supabase.from("exam_periods").select("id,name").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (periodError || !period) { setMessage(periodError?.message ?? "No examination period was found."); return; }
    const { data: registrations, error: registrationError } = await supabase.from("student_registrations").select("id,student_id,ustaz_id,registered_age,study_years,study_months,current_learning_level,current_learning_place").eq("exam_period_id", period.id);
    if (registrationError) { setMessage(registrationError.message); return; }
    const rows = (registrations ?? []) as Registration[];
    const registrationIds = rows.map((row) => row.id);
    const studentIds = [...new Set(rows.map((row) => row.student_id))];
    const ustazIds = [...new Set(rows.map((row) => row.ustaz_id))];
    const [resultQuery, supplementalQuery, studentQuery, ustazQuery] = await Promise.all([
      registrationIds.length ? supabase.from("exam_results").select("student_registration_id,status,total_mark").in("student_registration_id", registrationIds) : Promise.resolve({ data: [], error: null }),
      registrationIds.length ? supabase.from("exam_supplemental_results").select("student_registration_id,hisnul_muslim_mark,homework_mark").in("student_registration_id", registrationIds) : Promise.resolve({ data: [], error: null }),
      studentIds.length ? supabase.from("students").select("id,full_name").in("id", studentIds) : Promise.resolve({ data: [], error: null }),
      ustazIds.length ? supabase.from("profiles").select("id,full_name").in("id", ustazIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const error = [resultQuery.error, supplementalQuery.error, studentQuery.error, ustazQuery.error].find(Boolean);
    if (error) { setMessage(error.message); return; }
    const resultByRegistration = new Map(((resultQuery.data ?? []) as Result[]).map((result) => [result.student_registration_id, result]));
    const supplementalByRegistration = new Map(((supplementalQuery.data ?? []) as Supplemental[]).map((result) => [result.student_registration_id, result]));
    const studentNames = new Map((studentQuery.data ?? []).map((student) => [student.id, student.full_name]));
    const ustazNames = new Map((ustazQuery.data ?? []).map((ustaz) => [ustaz.id, ustaz.full_name]));
    const nextFindings: Finding[] = [];
    rows.forEach((registration) => {
      const result = resultByRegistration.get(registration.id);
      const supplemental = supplementalByRegistration.get(registration.id);
      const addFinding = (category: Finding["category"], issue: string) => nextFindings.push({ category, registrationId: registration.id, student: studentNames.get(registration.student_id) ?? "—", age: registration.registered_age, ustaz: ustazNames.get(registration.ustaz_id) ?? "—", issues: [issue], quran: result?.status === "submitted" ? result.total_mark : null, hisnul: supplemental?.hisnul_muslim_mark ?? null, homework: supplemental?.homework_mark ?? null });
      if (yearsAtMederesa(registration) > applied.quranDurationYears) {
        const place = Number(registration.current_learning_place ?? 0);
        const expected = registration.current_learning_level === "quran" ? applied.quranSurah : applied.alifFesel;
        const belowStandard = registration.current_learning_level === "quran" ? place > expected : place < expected;
        if (belowStandard) addFinding("quran", `Study progress: ${yearsAtMederesa(registration).toFixed(1)} years, current ${placeName(registration.current_learning_level, place)}; expected at least ${placeName(registration.current_learning_level, expected)}.`);
      }
      if (result?.status === "submitted" && yearsAtMederesa(registration) > applied.hisnulDurationYears) {
        if (supplemental?.hisnul_muslim_mark === null || supplemental?.hisnul_muslim_mark === undefined) addFinding("hisnul", "Hisnul Muslim result is missing.");
        else if (Number(supplemental.hisnul_muslim_mark) < applied.minHisnul) addFinding("hisnul", `Hisnul Muslim: ${supplemental.hisnul_muslim_mark}/20, below ${applied.minHisnul}/20.`);
      }
      if (result?.status === "submitted" && yearsAtMederesa(registration) > applied.homeworkDurationYears) {
        if (supplemental?.homework_mark === null || supplemental?.homework_mark === undefined) addFinding("homework", "Homework result is missing.");
        else if (Number(supplemental.homework_mark) < applied.minHomework) addFinding("homework", `Homework: ${supplemental.homework_mark}/5, below ${applied.minHomework}/5.`);
      }
    });
    setPeriodName(period.name ?? "Current examination");
    setFindings(nextFindings.sort((first, second) => first.ustaz.localeCompare(second.ustaz) || first.student.localeCompare(second.student)));
    setMessage("");
  }, [applied]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try { const raw = JSON.parse(saved) as Partial<Settings> & { durationYears?: number }; const parsed = { ...defaults, ...raw, quranDurationYears: raw.quranDurationYears ?? raw.durationYears ?? defaults.quranDurationYears, hisnulDurationYears: raw.hisnulDurationYears ?? raw.durationYears ?? defaults.hisnulDurationYears, homeworkDurationYears: raw.homeworkDurationYears ?? raw.durationYears ?? defaults.homeworkDurationYears } as Settings; setDraft(parsed); setApplied(parsed); } catch { window.localStorage.removeItem(storageKey); }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function update(key: keyof Settings, value: string) { setDraft((current) => ({ ...current, [key]: Number(value) })); }
  function applyStandards() { setApplied(draft); window.localStorage.setItem(storageKey, JSON.stringify(draft)); }

  const categoryGroups = useMemo(() => categoryDefinitions.map((category) => ({ ...category, groups: [...new Set(findings.filter((finding) => finding.category === category.id).map((finding) => finding.ustaz))].map((ustaz) => ({ ustaz, students: findings.filter((finding) => finding.category === category.id && finding.ustaz === ustaz) })) })), [findings]);
  const totalStudents = new Set(findings.map((finding) => finding.registrationId)).size;
  const totalIssues = findings.length;

  return <AdminShell active="standards">
    <header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · STANDARDS</p><h1>Below-standard students</h1><p>Set the expected standards, then review each result category separately.</p>{periodName && <small className="age-results-period">{periodName}</small>}</div><button className="secondary-button" type="button" onClick={() => void load()}>Refresh</button></header>
    {message && <p className="admin-message">{message}</p>}
    {!message && <>
      <section className="standards-input-grid">
        <article className="admin-card standard-input-card"><h2>Qur’an study standard</h2><p>Set the duration and expected learning place.</p><label>More than this many study years<input type="number" min="0" max="30" step="0.1" value={draft.quranDurationYears} onChange={(event) => update("quranDurationYears", event.target.value)} /></label><label>Minimum Alif Fesel<input type="number" min="1" max="27" value={draft.alifFesel} onChange={(event) => update("alifFesel", event.target.value)} /></label><label>Minimum Qur’an Surah<input type="number" min="1" max="114" value={draft.quranSurah} onChange={(event) => update("quranSurah", event.target.value)} /><small>{surahs[draft.quranSurah - 1] ?? ""}</small></label></article>
        <article className="admin-card standard-input-card"><h2>Hisnul Muslim standard</h2><p>Set its own study-duration rule and minimum result.</p><label>More than this many study years<input type="number" min="0" max="30" step="0.1" value={draft.hisnulDurationYears} onChange={(event) => update("hisnulDurationYears", event.target.value)} /></label><label>Minimum score / 20<input type="number" min="0" max="20" step="0.5" value={draft.minHisnul} onChange={(event) => update("minHisnul", event.target.value)} /></label><div className="standards-preview">Students below <strong>{draft.minHisnul}/20</strong> after more than <strong>{draft.hisnulDurationYears} years</strong> will appear below.</div></article>
        <article className="admin-card standard-input-card"><h2>Homework standard</h2><p>Set its own study-duration rule and minimum result.</p><label>More than this many study years<input type="number" min="0" max="30" step="0.1" value={draft.homeworkDurationYears} onChange={(event) => update("homeworkDurationYears", event.target.value)} /></label><label>Minimum score / 5<input type="number" min="0" max="5" step="0.5" value={draft.minHomework} onChange={(event) => update("minHomework", event.target.value)} /></label><div className="standards-preview">Students below <strong>{draft.minHomework}/5</strong> after more than <strong>{draft.homeworkDurationYears} years</strong> will appear below.</div></article>
      </section>
      <section className="admin-card standard-settings"><div className="card-title"><div><h2>Current rules</h2><p>These are example defaults. Adjust them to match the Mederesa policy before reviewing the list.</p></div><strong>{totalStudents} students · {totalIssues} findings</strong></div><div className="standards-preview"><span>Qur’an:</span> more than <strong>{draft.quranDurationYears} years</strong> → at least <strong>Fesel {draft.alifFesel}</strong> for Alif or <strong>{surahs[draft.quranSurah - 1] ?? `Surah ${draft.quranSurah}`}</strong> for Qur’an.<br /><span>Hisnul Muslim:</span> more than <strong>{draft.hisnulDurationYears} years</strong> → at least <strong>{draft.minHisnul}/20</strong>.<br /><span>Homework:</span> more than <strong>{draft.homeworkDurationYears} years</strong> → at least <strong>{draft.minHomework}/5</strong>.</div><button className="primary-button" type="button" onClick={applyStandards}>Apply standards and recalculate</button></section>
      <section className="standard-results">{categoryGroups.map((category) => <section className="standards-category" key={category.id}><div className="standards-category-heading"><div><h2>{category.title}</h2><p>{category.description}</p></div><strong>{category.groups.reduce((sum, group) => sum + group.students.length, 0)} finding(s)</strong></div>{category.groups.map((group) => { const key = `${category.id}:${group.ustaz}`; const isOpen = openUstazes[key] ?? false; return <article className="admin-card standard-group" key={key}><button className="review-heading" type="button" aria-expanded={isOpen} onClick={() => setOpenUstazes((current) => ({ ...current, [key]: !isOpen }))}><span><strong>{group.ustaz}</strong><small>{group.students.length} student(s) below standard</small></span><b>{isOpen ? "−" : "+"}</b></button>{isOpen && <div>{group.students.map((finding) => <div className="standard-student" key={`${finding.registrationId}:${finding.category}`}><div><strong>{finding.student}</strong><small>Age {finding.age ?? "—"}{finding.quran === null ? " · Qur’an result not submitted" : ` · Qur’an ${Number(finding.quran).toFixed(2)}/100`}</small></div><ul>{finding.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>)}</div>}</article>; })}{!category.groups.length && <p className="standards-category-empty">No students below this standard.</p>}</section>)}</section>
    </>}
  </AdminShell>;
}
