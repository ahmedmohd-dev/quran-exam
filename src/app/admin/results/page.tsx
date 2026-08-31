"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type Result = { id: string; examiner_assignment_id: string; student_registration_id: string; status: "draft" | "submitted"; total_mark: number; result_class: string; revision_place: number | null; revision_track: "alif" | "quran" | "qaida" | "admin" | null; examiner_comment: string | null; examiner: { full_name: string } | null; assignment: { student_registration: { student: { full_name: string } | null; ustaz: { full_name: string } | null } | null } | null };
type Supplemental = { student_registration_id: string; hisnul_muslim_mark: number; homework_mark: number };

export default function AdminResultsPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [supplemental, setSupplemental] = useState<Map<string, Supplemental>>(new Map());
  const [message, setMessage] = useState("Loading test results...");
  const [openStatuses, setOpenStatuses] = useState<Record<string, boolean>>({ draft: true, submitted: true });
  const [openExaminers, setOpenExaminers] = useState<Record<string, boolean>>({});
  const [openUstazes, setOpenUstazes] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("exam_results").select("id, examiner_assignment_id, student_registration_id, status, total_mark, result_class, revision_place, revision_track, examiner_comment, examiner:profiles!exam_results_examiner_id_fkey(full_name), assignment:examiner_assignments(student_registration:student_registrations(student:students(full_name),ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)))").order("updated_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    setResults((data ?? []) as unknown as Result[]);
    const registrationIds = ((data ?? []) as unknown as Result[]).map((result) => result.student_registration_id);
    if (registrationIds.length) {
      const { data: extra, error: extraError } = await supabase.from("exam_supplemental_results").select("student_registration_id,hisnul_muslim_mark,homework_mark").in("student_registration_id", registrationIds);
      if (extraError) { setMessage(extraError.message); return; }
      setSupplemental(new Map(((extra ?? []) as Supplemental[]).map((row) => [row.student_registration_id, row])));
    } else setSupplemental(new Map());
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);

  async function clearResult(result: Result) {
    const name = result.assignment?.student_registration?.student?.full_name ?? "this student";
    if (!window.confirm(`Clear the test result for ${name}?`)) return;
    const { error } = await createClient().from("exam_results").delete().eq("id", result.id);
    if (error) { setMessage(error.message); return; }
    setMessage("Test result cleared. The examiner can enter it again.");
    await load();
  }

  const visibleResults = useMemo(() => results.filter((result) => {
    const student = result.assignment?.student_registration?.student?.full_name ?? "";
    const examiner = result.examiner?.full_name ?? "";
    const matchesQuery = `${student} ${examiner}`.toLowerCase().includes(query.toLowerCase());
    const needsAttention = result.status === "submitted" && !result.examiner_comment?.trim();
    return matchesQuery && (!attentionOnly || needsAttention);
  }), [attentionOnly, query, results]);

  const groups = useMemo(() => (["draft", "submitted"] as const).map((status) => {
    const statusResults = visibleResults.filter((result) => result.status === status);
    const examiners = Array.from(new Set(statusResults.map((result) => result.examiner?.full_name ?? "Unknown examiner"))).map((name) => ({ name, results: statusResults.filter((result) => (result.examiner?.full_name ?? "Unknown examiner") === name) }));
    return { status, results: statusResults, examiners };
  }), [visibleResults]);

  const ustazGroups = useMemo(() => {
    const submitted = results.filter((result) => result.status === "submitted");
    return Array.from(new Set(submitted.map((result) => result.assignment?.student_registration?.ustaz?.full_name ?? "Unknown Ustaz"))).map((name) => ({
      name,
      results: submitted.filter((result) => (result.assignment?.student_registration?.ustaz?.full_name ?? "Unknown Ustaz") === name),
    }));
  }, [results]);

  function revisionName(result: Result) {
    if (result.revision_track === "qaida") return "ከቃኢዳ ኑራኒያ መጀመሪያ";
    if (result.revision_track === "admin") return "በበላይ አካል ይወሰናል";
    if (result.revision_track === "quran") return result.revision_place ? `ቁርአን · ${result.revision_place} · ${surahs[result.revision_place - 1] ?? ""}` : "ቁርአን";
    return result.revision_place ? `አሊፍ · ፈሰል ${result.revision_place} · ${alifFesels[result.revision_place - 1] ?? ""}` : "—";
  }

  function exportValue(value: string | number) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  function exportResults(format: "excel" | "pdf", selectedResults = results, filePrefix = "quran-examination-results") {
    const rows = selectedResults.map((result) => {
      const extra = supplemental.get(result.student_registration_id);
      const student = result.assignment?.student_registration?.student?.full_name ?? "Unknown student";
      const examiner = result.examiner?.full_name ?? "Unknown examiner";
      return `<tr><td>${exportValue(examiner)}</td><td>${exportValue(student)}</td><td>${result.status}</td><td>${Number(result.total_mark).toFixed(2)} / 100</td><td>${exportValue(result.result_class)}</td><td>${exportValue(revisionName(result))}</td><td>${Number(extra?.hisnul_muslim_mark ?? 0).toFixed(2)} / 20</td><td>${Number(extra?.homework_mark ?? 0).toFixed(2)} / 5</td><td>${exportValue(result.examiner_comment ?? "")}</td></tr>`;
    }).join("");
    const table = `<table border="1"><thead><tr><th>Examiner</th><th>Student</th><th>Status</th><th>Qur'an</th><th>Rank</th><th>Revision</th><th>Hisnul Muslim</th><th>Homework</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table>`;
    if (format === "excel") {
      const url = URL.createObjectURL(new Blob([`<html><head><meta charset="utf-8"></head><body><h1>Qur'an Examination Results</h1>${table}</body></html>`], { type: "application/vnd.ms-excel;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `${filePrefix}.xls`; link.click(); URL.revokeObjectURL(url);
      return;
    }
    const printWindow = window.open("", "quran-exam-results-pdf", "width=1200,height=800");
    if (!printWindow) { setMessage("Allow pop-ups to export the PDF."); return; }
    printWindow.document.write(`<html><head><title>Qur'an Examination Results</title><style>body{font-family:Arial;padding:24px}h1{color:#176b4e}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #b8c8bf;padding:6px;text-align:left}th{background:#e8f3ed}@media print{button{display:none}}</style></head><body><h1>Qur'an Examination Results</h1>${table}<script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  }

  function exportUstazPdf(ustazName: string, selectedResults: Result[]) {
    const rankName = (resultClass: string) => ({ first: "1ኛ ደረጃ", second: "2ኛ ደረጃ", third: "3ኛ ደረጃ", fourth: "4ኛ ደረጃ" }[resultClass] ?? resultClass);
    const rows = selectedResults.map((result, index) => {
      const extra = supplemental.get(result.student_registration_id);
      const student = result.assignment?.student_registration?.student?.full_name ?? "Unknown student";
      return `<tr><td>${index + 1}</td><td>${exportValue(student)}</td><td>${Number(result.total_mark).toFixed(2)}</td><td>${exportValue(rankName(result.result_class))}</td><td>${exportValue(revisionName(result))}</td><td>${Number(extra?.hisnul_muslim_mark ?? 0).toFixed(2)}</td><td>${Number(extra?.homework_mark ?? 0).toFixed(2)}</td><td>${exportValue(result.examiner_comment ?? "")}</td></tr>`;
    }).join("");
    const printWindow = window.open("", "quran-exam-ustaz-results-pdf", "width=1200,height=800");
    if (!printWindow) { setMessage("Allow pop-ups to print the Ustaz PDF."); return; }
    const today = new Date().toLocaleDateString("am-ET");
    printWindow.document.write(`<html lang="am"><head><meta charset="utf-8"><title>${exportValue(ustazName)} — ውጤት</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans Ethiopic",sans-serif;color:#17231e;margin:0;direction:rtl}.header{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:start;text-align:center;margin-bottom:8px}.header-side{font-size:12px;padding-top:12px;white-space:nowrap}.header-side:first-child{text-align:left;direction:rtl}.header-side:last-child{text-align:right}.logo{width:58px;height:58px;object-fit:contain}.center-name{font-size:16px;font-weight:700;margin-top:2px}.title{text-align:center;font-size:18px;font-weight:700;text-decoration:underline;margin:8px 0 12px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px;direction:ltr}th,td{border:1px solid #789688;padding:5px 4px;text-align:center;vertical-align:middle;line-height:1.35}th{background:#d8e9dc;font-weight:700}th:first-child,td:first-child{width:5%}th:nth-child(2),td:nth-child(2){width:17%;text-align:left;direction:ltr}th:nth-child(3),td:nth-child(3){width:9%}th:nth-child(4),td:nth-child(4){width:9%}th:nth-child(5),td:nth-child(5){width:13%;direction:rtl}th:nth-child(6),td:nth-child(6){width:10%}th:nth-child(7),td:nth-child(7){width:8%}th:last-child,td:last-child{width:29%;text-align:right;direction:rtl;white-space:pre-wrap;word-break:break-word}.note{font-size:9px;margin-top:8px;color:#52645b}@media print{button{display:none}}</style></head><body><header class="header"><div class="header-side">ቀን: ${exportValue(today)}</div><div><img class="logo" src="/logo.jpg" alt="مركز علي الحيدر"><div class="center-name">مركز علي الحيدر</div></div><div class="header-side">የኡስታዝ ስም: ${exportValue(ustazName)}</div></header><h1 class="title">የቁርአን ክለሳ ፈተና ውጤት</h1><table><thead><tr><th>ቁ.</th><th>የተማሪ ስም</th><th>ቁርአን<br>(ከ100%)</th><th>ደረጃ</th><th>የክለሳ ቦታ</th><th>ሂስኑል ሙስሊም<br>(ከ20%)</th><th>የቤት ስራ<br>(ከ5%)</th><th>የፈታኝ አስተያየት</th></tr></thead><tbody>${rows}</tbody></table><p class="note">ማስታወሻ፦ የቁርአን ውጤት ከ100%፣ ሂስኑል ሙስሊም ከ20% እና የቤት ስራ ከ5% ተለይተው ይታያሉ።</p><script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  }

 return <AdminShell active="results"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · PHASE 3</p><h1>Test results</h1><p>Open a status, then an examiner, to see the students.</p></div><div className="manager-actions"><button className="secondary-button" type="button" onClick={() => exportResults("excel")} disabled={!results.length}>Export Excel</button><button className="secondary-button" type="button" onClick={() => exportResults("pdf")} disabled={!results.length}>Export PDF</button><div className="workspace-step"><span>{results.length}</span><div><strong>Results</strong><small>Drafts and submitted</small></div></div></div></header>{message && <p className="admin-message">{message}</p>} {!message && results.length > 0 && <div className="results-toolbar"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or examiner" aria-label="Search student or examiner" /><label className="attention-filter"><input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} /> Missing comments only</label><span>{visibleResults.length} shown</span></div>}<section className="review-list">{groups.map((group) => <article className="admin-card review-examiner" key={group.status}><button className="review-heading" type="button" onClick={() => setOpenStatuses((current) => ({ ...current, [group.status]: !current[group.status] }))}><span><strong>{group.status === "draft" ? "Draft results" : "Submitted results"}</strong><small>{group.results.length} student(s)</small></span><b>{openStatuses[group.status] ? "−" : "+"}</b></button>{openStatuses[group.status] && <div className="review-students">{group.examiners.map((examiner) => { const key = `${group.status}:${examiner.name}`; return <div className="results-examiner-group" key={key}><button className="review-heading results-examiner-heading" type="button" onClick={() => setOpenExaminers((current) => ({ ...current, [key]: !current[key] }))}><span><strong>{examiner.name}</strong><small>{examiner.results.length} student(s)</small></span><b>{openExaminers[key] ? "−" : "+"}</b></button>{openExaminers[key] && examiner.results.map((result) => { const student = result.assignment?.student_registration?.student?.full_name ?? "Unknown student"; const extra = supplemental.get(result.student_registration_id); return <div className="review-student" key={result.id}><div><strong>{student}</strong><small>{result.result_class} · {Number(result.total_mark).toFixed(2)} / 100 · Revision: {revisionName(result)}</small><small>Hisnul Muslim: {Number(extra?.hisnul_muslim_mark ?? 0).toFixed(2)} / 20 · Homework: {Number(extra?.homework_mark ?? 0).toFixed(2)} / 5</small>{result.examiner_comment ? <small>Comment: {result.examiner_comment}</small> : result.status === "submitted" ? <small className="attention-text">Missing examiner comment</small> : null}</div><div className="review-actions"><Link className="text-button" href={`/admin/results/${result.id}`}>Edit</Link><button className="text-button delete-button" type="button" onClick={() => void clearResult(result)}>Clear test result</button></div></div>; })}</div>; })}{!group.results.length && <p className="empty-state">No {group.status} results.</p>}</div>}</article>)}{!message && !results.length && <div className="empty-state"><strong>No test results yet.</strong></div>}</section><section className="admin-card ustaz-report-section"><div className="card-title"><div><p className="eyebrow">USTAZ REPORTS</p><h2>Print results by Ustaz</h2><p>These reports group students under their registered Ustaz. Examiner names are not printed.</p></div></div><div className="ustaz-report-list">{ustazGroups.map((group) => { const key = `ustaz:${group.name}`; return <article className="ustaz-report-row" key={key}><button className="review-heading" type="button" onClick={() => setOpenUstazes((current) => ({ ...current, [key]: !current[key] }))}><span><strong>{group.name}</strong><small>{group.results.length} submitted student(s)</small></span><b>{openUstazes[key] ? "−" : "+"}</b></button>{openUstazes[key] && <button className="secondary-button" type="button" onClick={() => exportUstazPdf(group.name, group.results)}>Print this Ustaz PDF</button>}</article>; })}{!ustazGroups.length && <p className="empty-state">No submitted results are ready for Ustaz reports.</p>}</div></section></AdminShell>;
}
