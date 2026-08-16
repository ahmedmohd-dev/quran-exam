"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExaminerShell } from "@/components/examiner-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type StudentAssignment = {
  id: string;
  student_registration: { student: { full_name: string } | null } | null;
};

type ResultRow = {
  id: string;
  examiner_assignment_id: string;
  total_mark: number;
  result_class: string;
  status: string;
  examiner_comment: string | null;
  revision_track: "alif" | "quran" | "qaida" | "admin" | null;
  revision_place: number | null;
};

type SupplementalRow = {
  examiner_assignment_id: string;
  hisnul_muslim_mark: number;
  homework_mark: number;
};

function resultClassLabel(value: string) {
  return ({
    first: "1ተኛ ደረጃ",
    second: "2ተኛ ደረጃ",
    third: "3ተኛ ደረጃ",
    fourth: "4ተኛ ደረጃ",
  } as Record<string, string>)[value] ?? value;
}

function revisionLabel(result: ResultRow) {
  if (result.revision_track === "qaida") return "ከቃኢዳ ኑራኒያ ከመጀመሪያው";
  if (result.revision_track === "admin") return "በበላይ አካል ይወሰናል";
  if (!result.revision_place) return "አልተመረጠም";
  if (result.revision_track === "quran") {
    return `ቁርአን · ${result.revision_place} · ${surahs[result.revision_place - 1] ?? ""}`;
  }
  return `አሊፍ · ፈሰል ${result.revision_place} · ${alifFesels[result.revision_place - 1] ?? ""}`;
}

export default function ExaminerResultsPage() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [quranResults, setQuranResults] = useState<Map<string, ResultRow>>(new Map());
  const [supplemental, setSupplemental] = useState<Map<string, SupplementalRow>>(new Map());
  const [message, setMessage] = useState("Loading results...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMessage("Please sign in again.");
        return;
      }

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("examiner_assignments")
        .select("id,student_registration:student_registrations(student:students(full_name))")
        .eq("examiner_id", userData.user.id);
      if (assignmentError) {
        setMessage(assignmentError.message);
        return;
      }

      const rows = (assignmentData ?? []) as unknown as StudentAssignment[];
      const assignmentIds = rows.map((row) => row.id);
      const [quranResponse, supplementalResponse] = await Promise.all([
        assignmentIds.length
          ? supabase
              .from("exam_results")
              .select("id,examiner_assignment_id,total_mark,result_class,status,examiner_comment,revision_track,revision_place")
              .in("examiner_assignment_id", assignmentIds)
          : Promise.resolve({ data: [], error: null }),
        assignmentIds.length
          ? supabase
              .from("exam_supplemental_results")
              .select("examiner_assignment_id,hisnul_muslim_mark,homework_mark")
              .in("examiner_assignment_id", assignmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (quranResponse.error || supplementalResponse.error) {
        setMessage((quranResponse.error ?? supplementalResponse.error)?.message ?? "Could not load results.");
        return;
      }

      setAssignments(rows);
      setQuranResults(new Map(((quranResponse.data ?? []) as ResultRow[]).map((row) => [row.examiner_assignment_id, row])));
      setSupplemental(new Map(((supplementalResponse.data ?? []) as SupplementalRow[]).map((row) => [row.examiner_assignment_id, row])));
      setMessage("");
    }
    void load();
  }, []);

  return (
    <ExaminerShell>
      <header className="examiner-header">
        <Link className="back-link" href="/examiner">← ወደ ዋና ገጽ</Link>
        <h1>ሙሉ ውጤት</h1>
        <p>የተሞሉ ውጤቶችን ይመልከቱ። እያንዳንዱ ክፍል ከራሱ መለኪያ ጋር ይታያል።</p>
      </header>
      {message && <p className="admin-message">{message}</p>}
      <section className="review-list">
        {assignments.map((assignment) => {
          const name = assignment.student_registration?.student?.full_name ?? "Unknown student";
          const quran = quranResults.get(assignment.id);
          const extra = supplemental.get(assignment.id);
          return (
            <article className="admin-card review-student" key={assignment.id}>
              <div>
                <h2>{name}</h2>
                <small>Qur’an exam: {quran ? `${Number(quran.total_mark).toFixed(2)} / 100` : "Not entered"}</small>
                <small>Hisnul Muslim: {Number(extra?.hisnul_muslim_mark ?? 0).toFixed(2)} / 20</small>
                <small>Homework: {Number(extra?.homework_mark ?? 0).toFixed(2)} / 5</small>
                {quran && <strong>Class: {resultClassLabel(quran.result_class)}</strong>}
                {quran && <small>የሚከለስበት ቦታ: {revisionLabel(quran)}</small>}
                {quran?.examiner_comment && <small>{quran.examiner_comment}</small>}
              </div>
              <span className={`tag ${quran?.status === "submitted" ? "complete" : "pending"}`}>
                {quran?.status ?? "supplementary only"}
              </span>
            </article>
          );
        })}
        {!message && !assignments.length && <div className="empty-state"><strong>No assigned students yet.</strong></div>}
      </section>
    </ExaminerShell>
  );
}
