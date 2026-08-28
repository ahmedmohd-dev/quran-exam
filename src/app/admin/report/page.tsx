"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { ExamReport, ExamReportData } from "@/components/exam-report";
import { loadDirectorData } from "@/lib/director-data";

export default function AdminReportPage() {
  const [data, setData] = useState<ExamReportData | null>(null);
  const [message, setMessage] = useState("Loading full exam report...");
  useEffect(() => { const timer = window.setTimeout(() => { void loadDirectorData().then(setData).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load the report.")); }, 0); return () => window.clearTimeout(timer); }, []);
  return <AdminShell active="report"><header className="workspace-header no-print"><div><Link className="back-link" href="/admin/results">← Back to results</Link><p className="eyebrow">EXAM ADMIN · REPORT</p><h1>Full exam report</h1><p>Review the complete report and print or save it as a PDF.</p></div></header>{message && !data && <p className="admin-message">{message}</p>}{data && <ExamReport data={data} canPrint />}</AdminShell>;
}
