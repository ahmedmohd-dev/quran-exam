"use client";

import { useMemo } from "react";
import { buildProgress, buildSummary, buildUstazRankings, loadDirectorData, mederesaClasses, rankLabels, Registration, Result, SupplementalResult, UstazProgress } from "@/lib/director-data";

export type ExamReportData = Awaited<ReturnType<typeof loadDirectorData>>;

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function format(value: number | null, suffix = "") {
  return value === null ? "—" : `${value.toFixed(2)}${suffix}`;
}

function ageRows(registrations: Registration[], results: Result[], supplemental: SupplementalResult[]) {
  const submittedByRegistration = new Map(results.filter((result) => result.status === "submitted").map((result) => [result.student_registration_id, result]));
  const supplementalByAssignment = new Map(supplemental.map((item) => [item.examiner_assignment_id, item]));
  const groups = new Map<number, { registered: number; quran: number[]; hisnul: number[]; homework: number[] }>();
  registrations.forEach((registration) => {
    if (registration.registered_age === null) return;
    const group = groups.get(registration.registered_age) ?? { registered: 0, quran: [], hisnul: [], homework: [] };
    group.registered += 1;
    const result = submittedByRegistration.get(registration.id);
    if (result) {
      group.quran.push(Number(result.total_mark));
      const extra = supplementalByAssignment.get(result.examiner_assignment_id);
      if (extra?.hisnul_muslim_mark !== null && extra?.hisnul_muslim_mark !== undefined) group.hisnul.push(Number(extra.hisnul_muslim_mark) / 20 * 100);
      if (extra?.homework_mark !== null && extra?.homework_mark !== undefined) group.homework.push(Number(extra.homework_mark) / 5 * 100);
    }
    groups.set(registration.registered_age, group);
  });
  return [...groups.entries()].sort(([first], [second]) => first - second).map(([age, group]) => ({ age, registered: group.registered, submitted: group.quran.length, quran: average(group.quran), hisnul: average(group.hisnul), homework: average(group.homework) }));
}

function rankPercent(count: number, total: number) {
  return total ? `${(count / total * 100).toFixed(1)}%` : "—";
}

function classRankRows(ustazes: ExamReportData["ustazes"], registrations: Registration[], results: Result[]) {
  const ustazCodeById = new Map(ustazes.map((ustaz) => [ustaz.id, ustaz.ustaz_code]));
  const classCodes = new Map(mederesaClasses.map((classGroup) => [classGroup.id, new Set(classGroup.ustazCodes)]));
  const submittedByRegistration = new Map(results.filter((result) => result.status === "submitted").map((result) => [result.student_registration_id, result]));
  const rows = mederesaClasses.map((classGroup) => {
    const counts = { first: 0, second: 0, third: 0 };
    let submitted = 0;
    registrations.forEach((registration) => {
      if (!classCodes.get(classGroup.id)?.has(ustazCodeById.get(registration.ustaz_id) ?? "")) return;
      const result = submittedByRegistration.get(registration.id);
      if (!result) return;
      submitted += 1;
      if (result.result_class !== "fourth") counts[result.result_class] += 1;
    });
    return { ...classGroup, submitted, counts };
  });
  const totals = rows.reduce((total, row) => ({
    submitted: total.submitted + row.submitted,
    counts: {
      first: total.counts.first + row.counts.first,
      second: total.counts.second + row.counts.second,
      third: total.counts.third + row.counts.third,
    },
  }), { submitted: 0, counts: { first: 0, second: 0, third: 0 } });
  return { rows, totals };
}

function ReportTables({ ustazes, registrations, results, supplemental, progress }: { ustazes: ExamReportData["ustazes"]; registrations: Registration[]; results: Result[]; supplemental: SupplementalResult[]; progress: UstazProgress[] }) {
  const summary = buildSummary(registrations, results, supplemental);
  const ages = ageRows(registrations, results, supplemental);
  const submitted = results.filter((result) => result.status === "submitted").length;
  const classRanks = classRankRows(ustazes, registrations, results);
  const quranRanks = buildUstazRankings(progress);
  const orderedProgress = [...progress].sort((first, second) => {
    const firstRank = quranRanks[first.ustaz.id].quran;
    const secondRank = quranRanks[second.ustaz.id].quran;
    if (firstRank === null && secondRank === null) return first.ustaz.full_name.localeCompare(second.ustaz.full_name);
    if (firstRank === null) return 1;
    if (secondRank === null) return -1;
    return firstRank - secondRank || first.ustaz.full_name.localeCompare(second.ustaz.full_name);
  });
  return <>
    <section className="report-section"><h2>Overall results</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Category</th><th>Students</th><th>Average result</th><th>Share of submitted</th></tr></thead><tbody>{(Object.keys(rankLabels) as Result["result_class"][]).map((rank) => <tr key={rank}><th>{rankLabels[rank]}</th><td>{summary.ranks[rank]}</td><td>—</td><td>{rankPercent(summary.ranks[rank], submitted)}</td></tr>)}<tr className="report-total"><th>Total submitted</th><td>{submitted}</td><td>{format(summary.average, " / 100")}</td><td>100%</td></tr></tbody></table></div></section>
    <section className="report-section"><h2>የክፍሎች የደረጃ ውጤት</h2><div className="report-table-wrap"><table className="report-table report-class-ranks"><thead><tr><th rowSpan={2}>ተ.ቁ</th><th rowSpan={2}>ክፍል</th><th colSpan={2}>1ኛ ደረጃ</th><th colSpan={2}>2ኛ ደረጃ</th><th colSpan={2}>3ኛ ደረጃ</th><th rowSpan={2}>ድምር</th></tr><tr><th>ብዛት</th><th>%</th><th>ብዛት</th><th>%</th><th>ብዛት</th><th>%</th></tr></thead><tbody>{classRanks.rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><th>{row.title}</th><td>{row.counts.first}</td><td>{rankPercent(row.counts.first, row.submitted)}</td><td>{row.counts.second}</td><td>{rankPercent(row.counts.second, row.submitted)}</td><td>{row.counts.third}</td><td>{rankPercent(row.counts.third, row.submitted)}</td><td>{row.submitted}</td></tr>)}<tr className="report-total"><th colSpan={2}>ድምር</th><td>{classRanks.totals.counts.first}</td><td>{rankPercent(classRanks.totals.counts.first, classRanks.totals.submitted)}</td><td>{classRanks.totals.counts.second}</td><td>{rankPercent(classRanks.totals.counts.second, classRanks.totals.submitted)}</td><td>{classRanks.totals.counts.third}</td><td>{rankPercent(classRanks.totals.counts.third, classRanks.totals.submitted)}</td><td>{classRanks.totals.submitted}</td></tr></tbody></table></div></section>
    <section className="report-section"><h2>Exam component averages</h2><div className="report-summary-grid"><article><span>Qur’an</span><strong>{format(summary.average, " / 100")}</strong></article><article><span>Hisnul Muslim</span><strong>{format(summary.hisnulAverage, " / 100")}</strong></article><article><span>Homework</span><strong>{format(summary.homeworkAverage, " / 100")}</strong></article></div></section>
    <section className="report-section"><h2>Results by age</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Age</th><th>Registered</th><th>Submitted</th><th>Qur’an / 100</th><th>Hisnul / 100</th><th>Homework / 100</th></tr></thead><tbody>{ages.map((row) => <tr key={row.age}><th>{row.age}</th><td>{row.registered}</td><td>{row.submitted}</td><td>{format(row.quran)}</td><td>{format(row.hisnul)}</td><td>{format(row.homework)}</td></tr>)}</tbody></table></div></section>
    <section className="report-section"><h2>Ustaz results</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Qur’an rank</th><th>Ustaz</th><th>Submitted</th><th>Qur’an average / 100</th><th>Hisnul average / 100</th><th>Homework average / 100</th></tr></thead><tbody>{orderedProgress.map((item) => <tr key={item.ustaz.id}><th>{quranRanks[item.ustaz.id].quran ?? "—"}</th><td>{item.ustaz.full_name}</td><td>{item.submitted}</td><td>{format(item.average)}</td><td>{format(item.hisnulAverage)}</td><td>{format(item.homeworkAverage)}</td></tr>)}</tbody></table></div></section>
  </>;
}

export function ExamReport({ data, canPrint = false }: { data: ExamReportData; canPrint?: boolean }) {
  const progress = useMemo(() => buildProgress(data.ustazes, data.registrations, data.results, data.supplemental), [data]);
  const summary = useMemo(() => buildSummary(data.registrations, data.results, data.supplemental), [data]);
  return <main className="exam-report-page"><header className="exam-report-header"><div><p className="eyebrow">مركز علي الحيدر</p><h1>የቁርአን ክለሳ ፈተና ሪፖርት</h1><p>{data.periodName}</p></div>{canPrint && <button className="primary-button no-print" type="button" onClick={() => window.print()}>Print / Save as PDF</button>}</header><section className="report-summary-banner"><div><span>Registered students</span><strong>{summary.registered}</strong></div><div><span>Submitted results</span><strong>{summary.submitted}</strong></div><div><span>Qur’an average</span><strong>{format(summary.average, " / 100")}</strong></div><div><span>Pending results</span><strong>{summary.pending}</strong></div></section><ReportTables ustazes={data.ustazes} registrations={data.registrations} results={data.results} supplemental={data.supplemental} progress={progress} /><section className="report-section report-notes"><h2>Report notes</h2><p>Hisnul Muslim and Homework averages are converted to percentages for comparison. Qur’an results are calculated out of 100. Only submitted Qur’an results are included in completed-result averages.</p></section></main>;
}
