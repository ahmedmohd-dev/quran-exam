"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExaminerShell } from "@/components/examiner-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type ResultSummary = { status: "draft" | "submitted"; total_mark: number; result_class: "first" | "second" | "third" | "fourth" };
type AssignedStudent = { assignmentId: string; name: string; level: "alif" | "quran"; place: string; ustazCode: string; result: ResultSummary | null };
type AssignmentRow = { id: string; student_registration: { id: string; current_learning_level: "alif" | "quran"; current_learning_place: string | null; student: { full_name: string } | null; ustaz: { ustaz_code: string | null } | null } | null };

function learningName(level: "alif" | "quran", place: string) {
  const number = Number(place);
  if (!Number.isInteger(number)) return place;
  return level === "quran" ? surahs[number - 1] ?? place : alifFesels[number - 1] ?? place;
}

function markingAvailable(level: "alif" | "quran", place: string) {
  const number = Number(place);
  return (level === "alif" && number >= 1 && number <= 27) || (level === "quran" && number >= 1 && number <= 114);
}

function rankLabel(resultClass: ResultSummary["result_class"]) {
  return { first: "1ኛ ደረጃ", second: "2ኛ ደረጃ", third: "3ኛ ደረጃ", fourth: "4ኛ ደረጃ" }[resultClass];
}

export default function ExaminerTestPage() {
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [message, setMessage] = useState("ተማሪዎች በመጫን ላይ…");

  useEffect(() => {
    async function loadStudents() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("examiner_assignments").select("id, student_registration:student_registrations(id, current_learning_level, current_learning_place, student:students(full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(ustaz_code))").eq("examiner_id", user.id).order("assigned_at");
      if (error) { setMessage(error.message); return; }
      const rows = (data ?? []) as unknown as AssignmentRow[];
      const assignmentIds = rows.map((row) => row.id);
      const { data: resultRows, error: resultsError } = assignmentIds.length
        ? await supabase.from("exam_results").select("examiner_assignment_id, status, total_mark, result_class").in("examiner_assignment_id", assignmentIds)
        : { data: [], error: null };
      if (resultsError) { setMessage(resultsError.message); return; }
      const results = new Map((resultRows ?? []).map((result) => [result.examiner_assignment_id, result as ResultSummary]));
      setStudents(rows.flatMap((row) => {
        const registration = row.student_registration;
        if (!registration?.student?.full_name) return [];
        return [{ assignmentId: row.id, name: registration.student.full_name, level: registration.current_learning_level, place: registration.current_learning_place ?? "", ustazCode: registration.ustaz?.ustaz_code ?? "—", result: results.get(row.id) ?? null }];
      }));
      setMessage("");
    }
    void loadStudents();
  }, []);

  return <ExaminerShell><header className="examiner-header"><Link className="back-link" href="/examiner">← ወደ ዋና ገጽ</Link><p className="eyebrow">የፈተና መጀመሪያ</p><h1>ፈተና ጀምር</h1><p>የተመደቡልዎትን ተማሪዎች ይምረጡ። የኡስታዝ ስም አይታይም፤ ኮዱ ብቻ ይታያል።</p></header>{message && <p className="admin-message">{message}</p>}<section className="examiner-list">{students.map((student, index) => <article className="admin-card examiner-student" key={student.assignmentId}><span className="student-index">{index + 1}</span><div><h2>{student.name}</h2><p>{student.level === "quran" ? "ቁርአን" : "አሊፍ"} · {learningName(student.level, student.place)}</p><small>የኡስታዝ ኮድ: <strong>{student.ustazCode}</strong></small></div>{student.result?.status === "submitted" && <div className="examiner-result-summary"><strong>{Number(student.result.total_mark).toFixed(2)} / 100</strong><span>{rankLabel(student.result.result_class)}</span></div>}{markingAvailable(student.level, student.place) ? <Link className="primary-button examiner-start-button" href={`/examiner/test/${student.assignmentId}`}>{student.result?.status === "submitted" ? "ውጤት ለማስተካከል" : student.result?.status === "draft" ? "ፈተናውን ለመቀጠል" : "ፈተና ጀምር"}</Link> : <button className="secondary-button" type="button" disabled>በቅርብ ቀን</button>}</article>)}{!message && students.length === 0 && <section className="admin-card empty-state"><strong>ምንም ተመድቦ የለም</strong><p>እባክዎ አስተዳዳሪውን ያነጋግሩ።</p></section>}</section></ExaminerShell>;
}
