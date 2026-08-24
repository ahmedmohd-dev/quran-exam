"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { loadDirectorData, rankLabels, Registration, Result, Ustaz } from "@/lib/director-data";

type RankStudent = { id: string; studentName: string; ustazName: string; totalMark: number };

export default function AdminClassesPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [message, setMessage] = useState("Loading rank results...");

  async function load() {
    setMessage("Loading rank results...");
    try {
      const data = await loadDirectorData();
      setRegistrations(data.registrations);
      setResults(data.results);
      setUstazes(data.ustazes);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load rank results."); }
  }

  useEffect(() => { void load(); }, []);
  const groups = useMemo<Record<Result["result_class"], RankStudent[]>>(() => {
    const registrationsById = new Map(registrations.map((registration) => [registration.id, registration]));
    const ustazesById = new Map(ustazes.map((ustaz) => [ustaz.id, ustaz]));
    const output: Record<Result["result_class"], RankStudent[]> = { first: [], second: [], third: [], fourth: [] };
    results.filter((result) => result.status === "submitted").forEach((result) => {
      const registration = registrationsById.get(result.student_registration_id);
      if (!registration) return;
      output[result.result_class].push({ id: result.student_registration_id, studentName: registration.student?.full_name ?? "—", ustazName: ustazesById.get(registration.ustaz_id)?.full_name ?? "—", totalMark: Number(result.total_mark) });
    });
    (Object.keys(output) as Result["result_class"][]).forEach((rank) => output[rank].sort((first, second) => second.totalMark - first.totalMark));
    return output;
  }, [registrations, results, ustazes]);

  return <AdminShell active="classResults"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN</p><h1>Results by rank</h1><p>Review submitted students grouped by first, second, third, and fourth rank.</p></div><button className="secondary-button" type="button" onClick={() => void load()}>Refresh results</button></header>{message && <p className="admin-message">{message}</p>}<section className="director-class-list">{(Object.keys(rankLabels) as Result["result_class"][]).map((rank) => <article className="admin-card director-class-card" key={rank}><div className="card-title"><div><h2>{rankLabels[rank]}</h2><p>{groups[rank].length} student(s)</p></div></div>{groups[rank].map((student, index) => <div className="director-class-student" key={student.id}><span>{index + 1}</span><strong>{student.studentName}</strong><small>{student.ustazName}</small><b>{student.totalMark.toFixed(2)} / 100</b></div>)}{!message && !groups[rank].length && <p className="empty-state">No submitted result yet.</p>}</article>)}</section></AdminShell>;
}
