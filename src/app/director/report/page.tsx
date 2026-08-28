"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DirectorShell } from "@/components/director-shell";
import { ExamReport, ExamReportData } from "@/components/exam-report";
import { loadDirectorData } from "@/lib/director-data";

export default function DirectorReportPage() {
  const [data, setData] = useState<ExamReportData | null>(null);
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  useEffect(() => { const timer = window.setTimeout(() => { void loadDirectorData().then(setData).catch((error) => setMessage(error instanceof Error ? error.message : "ሪፖርቱን ማምጣት አልተቻለም።")); }, 0); return () => window.clearTimeout(timer); }, []);
  return <DirectorShell><div className="report-page-actions"><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link></div>{message && !data && <p className="admin-message">{message}</p>}{data && <ExamReport data={data} />}</DirectorShell>;
}
