"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DirectorHeaderActions, DirectorShell } from "@/components/director-shell";
import { buildSummary, loadDirectorData, rankLabels, Registration, Result, SupplementalResult } from "@/lib/director-data";

export default function DirectorPage() {
  const [periodName, setPeriodName] = useState("የአሁኑ ፈተና");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [supplemental, setSupplemental] = useState<SupplementalResult[]>([]);
  const [ustazCount, setUstazCount] = useState(0);
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");

  async function load() {
    setMessage("መረጃውን በመጫን ላይ…");
    try {
      const data = await loadDirectorData();
      setPeriodName(data.periodName);
      setRegistrations(data.registrations);
      setResults(data.results);
      setSupplemental(data.supplemental);
      setUstazCount(data.ustazes.length);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "መረጃውን ማምጣት አልተቻለም።");
    }
  }

  useEffect(() => { void load(); }, []);
  const summary = useMemo(() => buildSummary(registrations, results, supplemental), [registrations, results, supplemental]);

  return <DirectorShell>
    <header className="workspace-header director-header"><div><p className="eyebrow">የመድረሳ አጠቃላይ ክትትል</p><h1>የፈተና ሪፖርት</h1><p>{periodName} · የመድረሳውን አጠቃላይ ሂደት ይመልከቱ።</p></div><DirectorHeaderActions onRefresh={() => void load()} /></header>
    {message && <p className="admin-message">{message}</p>}
    {!message && <><section className="metrics director-metrics"><article><span>ጠቅላላ ተማሪዎች</span><strong>{summary.registered}</strong></article><article><span>የተመዘገቡ ኡስታዞች</span><strong>{ustazCount}</strong></article><article><span>የተጠናቀቀ ውጤት</span><strong>{summary.submitted}</strong></article><article><span>አማካይ ውጤት</span><strong>{summary.average === null ? "—" : `${summary.average.toFixed(2)} / 100`}</strong></article></section>
    <section className="director-rank-grid">{(Object.keys(rankLabels) as Result["result_class"][]).map((rank) => <article key={rank}><span>{rankLabels[rank]}</span><strong>{summary.ranks[rank]}</strong></article>)}</section>
    <section className="director-view-tabs"><Link href="/director/ustazes">የኡስታዞችን ውጤት በተናጠል ለመመልከት</Link><Link href="/director/classes">የከላሶችን ውጤት ለመመልከት</Link><Link href="/director/report">ሪፖርት ለመመልከት</Link></section></>}
  </DirectorShell>;
}
