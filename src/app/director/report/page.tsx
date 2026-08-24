"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DirectorHeaderActions, DirectorShell } from "@/components/director-shell";
import { buildSummary, loadDirectorData, Registration, Result, SupplementalResult } from "@/lib/director-data";

export default function DirectorReportPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [supplemental, setSupplemental] = useState<SupplementalResult[]>([]);
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  async function load() { setMessage("መረጃውን በመጫን ላይ…"); try { const data = await loadDirectorData(); setRegistrations(data.registrations); setResults(data.results); setSupplemental(data.supplemental); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : "መረጃውን ማምጣት አልተቻለም።"); } }
  useEffect(() => { void load(); }, []);
  const summary = useMemo(() => buildSummary(registrations, results, supplemental), [registrations, results, supplemental]);
  return <DirectorShell><header className="workspace-header"><div><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link><p className="eyebrow">የመድረሳ ሪፖርት</p><h1>የመድረሳ ሪፖርት</h1><p>የመድረሳውን የተጠናቀቀ ውጤት አጠቃላይ ማጠቃለያ ይመልከቱ።</p></div><DirectorHeaderActions onRefresh={() => void load()} /></header>{message && <p className="admin-message">{message}</p>}{!message && <section className="admin-card director-report"><h2>የመድረሳ ውጤት ማጠቃለያ</h2><p>ጠቅላላ ተማሪዎች: {summary.registered}። የተመዘገበ ውጤት: {summary.submitted}።</p><p>የቁርአን አማካይ ውጤት: {summary.average === null ? "—" : `${summary.average.toFixed(2)} / 100`}።</p><p>የሂስኑል ሙስሊም አማካይ: {summary.hisnulAverage === null ? "—" : `${summary.hisnulAverage.toFixed(2)} / 100`}።</p><p>የቤት ስራ አማካይ: {summary.homeworkAverage === null ? "—" : `${summary.homeworkAverage.toFixed(2)} / 100`}።</p><p>1ኛ ደረጃ: {summary.ranks.first}፣ 2ኛ ደረጃ: {summary.ranks.second}፣ 3ኛ ደረጃ: {summary.ranks.third}፣ 4ኛ ደረጃ: {summary.ranks.fourth}።</p></section>}</DirectorShell>;
}
