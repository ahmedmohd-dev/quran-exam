"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { buildProgress, loadDirectorData, UstazProgress } from "@/lib/director-data";

type RankingRow = { rank: number; name: string; average: number; students: number };

function makeRows(progress: UstazProgress[], valueFor: (item: UstazProgress) => number | null, countFor: (item: UstazProgress) => number) {
  return progress
    .filter((item) => valueFor(item) !== null)
    .sort((first, second) => (valueFor(second) ?? 0) - (valueFor(first) ?? 0))
    .map((item, index, sorted) => {
      const average = valueFor(item)!;
      const firstMatchingIndex = sorted.findIndex((candidate) => valueFor(candidate) === average);
      return { rank: firstMatchingIndex + 1, name: item.ustaz.full_name, average, students: countFor(item) };
    });
}

function RankingTable({ title, rows }: { title: string; rows: RankingRow[] }) {
  return <section className="admin-card ranking-card"><div className="card-title"><div><h2>{title}</h2><p>{rows.length} Ustaz groups ranked</p></div></div><div className="age-results-table-wrap"><table className="age-results-table"><thead><tr><th>Rank</th><th>Ustaz</th><th>Average /100</th><th>Students counted</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><th>{row.rank}</th><td>{row.name}</td><td><strong>{row.average.toFixed(2)}</strong></td><td>{row.students}</td></tr>)}</tbody></table></div>{!rows.length && <p className="empty-state">No completed results are available.</p>}</section>;
}

export default function AdminUstazRankingsPage() {
  const [progress, setProgress] = useState<UstazProgress[]>([]);
  const [message, setMessage] = useState("Loading Ustaz rankings...");

  const load = useCallback(async () => {
    setMessage("Loading Ustaz rankings...");
    try {
      const data = await loadDirectorData();
      setProgress(buildProgress(data.ustazes, data.registrations, data.results, data.supplemental));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Ustaz rankings.");
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const rankings = useMemo(() => ({
    quran: makeRows(progress, (item) => item.average, (item) => item.submitted),
    hisnul: makeRows(progress, (item) => item.hisnulAverage, (item) => item.hisnulCount),
    homework: makeRows(progress, (item) => item.homeworkAverage, (item) => item.homeworkCount),
  }), [progress]);

  return <AdminShell active="ustazRankings"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN</p><h1>Ustaz rankings</h1><p>Compare the average results of each top-level Ustaz group.</p></div><button className="secondary-button" type="button" onClick={() => void load()}>Refresh rankings</button></header>{message && <p className="admin-message">{message}</p>}{!message && <><p className="ranking-note">Mohammed and Namus include their managed Ustazes. Students with exactly 1 or 2 months are excluded only from the Hisnul Muslim ranking.</p><RankingTable title="Qur’an average ranking" rows={rankings.quran} /><RankingTable title="Hisnul Muslim average ranking" rows={rankings.hisnul} /><RankingTable title="Homework average ranking" rows={rankings.homework} /></>}</AdminShell>;
}
