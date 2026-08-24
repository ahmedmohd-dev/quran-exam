"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UstazShell } from "@/components/ustaz-shell";
import { createClient } from "@/lib/supabase/client";

type Result = {
  student_registration_id: string;
  total_mark: number;
  result_class: "first" | "second" | "third" | "fourth";
  examiner_assignment_id: string;
};
type Supplemental = {
  examiner_assignment_id: string;
  hisnul_muslim_mark: number | null;
  homework_mark: number | null;
};

export default function UstazResultsDashboard() {
  const [results, setResults] = useState<Result[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [supplemental, setSupplemental] = useState<Supplemental[]>([]);
  const [comment, setComment] = useState("");
  const [ranks, setRanks] = useState<{ quran_rank: number | null; hisnul_rank: number | null; homework_rank: number | null } | null>(null);
  const [message, setMessage] = useState("ውጤቶችን በመጫን ላይ…");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("እባክዎ እንደገና ይግቡ።");
        return;
      }
      const { data: period } = await supabase
        .from("exam_periods")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!period) {
        setMessage("የፈተና ወቅት አልተገኘም።");
        return;
      }
      const { data: registrations, error: registrationError } = await supabase
        .from("student_registrations")
        .select("id")
        .eq("exam_period_id", period.id)
        .eq("ustaz_id", user.id);
      if (registrationError) {
        setMessage(registrationError.message);
        return;
      }
      const registrationIds = (registrations ?? []).map((item) => item.id);
      setStudentCount(registrationIds.length);
      const [resultResponse, commentResponse] = await Promise.all([
        registrationIds.length
          ? supabase
              .from("exam_results")
              .select(
                "student_registration_id,total_mark,result_class,examiner_assignment_id"
              )
              .in("student_registration_id", registrationIds)
              .eq("status", "submitted")
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("ustaz_result_comments")
          .select("comment")
          .eq("exam_period_id", period.id)
          .eq("ustaz_id", user.id)
          .maybeSingle(),
      ]);
      if (resultResponse.error || commentResponse.error) {
        setMessage(
          (resultResponse.error ?? commentResponse.error)?.message ??
            "ውጤት አልተገኘም።"
        );
        return;
      }
      const loadedResults = (resultResponse.data ?? []) as Result[];
      const assignmentIds = loadedResults.map(
        (item) => item.examiner_assignment_id
      );
      const { data: extra, error: extraError } = assignmentIds.length
        ? await supabase
            .from("exam_supplemental_results")
            .select("examiner_assignment_id,hisnul_muslim_mark,homework_mark")
            .in("examiner_assignment_id", assignmentIds)
        : { data: [], error: null };
      if (extraError) {
        setMessage(extraError.message);
        return;
      }
      setResults(loadedResults);
      setSupplemental((extra ?? []) as Supplemental[]);
      setComment(commentResponse.data?.comment ?? "");
      const { data: rankingData } = await supabase.rpc("get_own_ustaz_rankings");
      setRanks(rankingData?.[0] ?? null);
      setMessage("");
    }
    void load();
  }, []);

  const summary = useMemo(() => {
    const extraByAssignment = new Map(
      supplemental.map((item) => [item.examiner_assignment_id, item])
    );
    const extras = results
      .map((item) => extraByAssignment.get(item.examiner_assignment_id))
      .filter(Boolean) as Supplemental[];
    const percentage = (values: Array<number | null>, maximum: number) => {
      const filled = values.filter((value): value is number => value !== null);
      return filled.length
        ? (filled.reduce((sum, value) => sum + value, 0) /
            filled.length /
            maximum) *
            100
        : null;
    };
    return {
      quran: results.length
        ? results.reduce((sum, item) => sum + Number(item.total_mark), 0) /
          results.length
        : null,
      hisnul: percentage(
        extras.map((item) => item.hisnul_muslim_mark),
        20
      ),
      homework: percentage(
        extras.map((item) => item.homework_mark),
        5
      ),
      first: results.filter((item) => item.result_class === "first").length,
      second: results.filter((item) => item.result_class === "second").length,
      third: results.filter((item) => item.result_class === "third").length,
      fourth: results.filter((item) => item.result_class === "fourth").length,
    };
  }, [results, supplemental]);
  const score = (value: number | null) =>
    value === null ? "—" : `${value.toFixed(2)} / 100`;
  const rankLabel = (value: number | null | undefined) => value ? `${value}ኛ ደረጃ` : "—";

  return (
    <UstazShell>
      <header className="ustaz-results-header">
        <p className="eyebrow">የፈተና ውጤት</p>
        <h1>የተማሪዎቼ ውጤት</h1>
        <p>የተማሪዎችዎን አጠቃላይ ውጤትና ደረጃ ይመልከቱ።</p>
      </header>
      {message && <p className="admin-message">{message}</p>}
      {!message && (
        <>
          <section className="result-metrics">
            <article>
              <span>ጠቅላላ ተማሪዎች</span>
              <strong>{studentCount}</strong>
            </article>
            <article>
              <span>የተላከ ውጤት</span>
              <strong>{results.length}</strong>
            </article>
            <article>
              <span>የቁርአን አማካይ</span>
              <strong>{score(summary.quran)}</strong>
            </article>
            <article>
              <span>የሚከለሱ ተማሪዎች</span>
              <strong>{summary.second + summary.third + summary.fourth}</strong>
            </article>
          </section>
          <section className="result-metrics">
            <article>
              <span>ሂስኑል ሙስሊም</span>
              <strong>{score(summary.hisnul)}</strong>
            </article>
            <article>
              <span>የቤት ስራ</span>
              <strong>{score(summary.homework)}</strong>
            </article>
          </section>
          <section className="result-metrics">
            <article><span>የቁርአን ደረጃ</span><strong>{rankLabel(ranks?.quran_rank)}</strong></article>
            <article><span>የሂስኑል ሙስሊም ደረጃ</span><strong>{rankLabel(ranks?.hisnul_rank)}</strong></article>
            <article><span>የቤት ስራ ደረጃ</span><strong>{rankLabel(ranks?.homework_rank)}</strong></article>
          </section>
          {comment && (
            <section className="ustaz-general-comment">
              <p className="eyebrow">አጠቃላይ አስተያየት</p>
              <p>{comment}</p>
            </section>
          )}
          <section className="ustaz-result-actions ustaz-result-actions-large">
            <Link className="secondary-button" href="/results/students">
              የተማሪዎችን ውጤት ለማየት
            </Link>
            <Link className="secondary-button" href="/results/feedback">
              ስለ ፈተናው ጠቅላላ አስተያየትና ሀሳብ ለመስጠት
            </Link>
            <Link className="secondary-button" href="/results/review">
              ቅሬታ ማስገቢያ
            </Link>
          </section>
        </>
      )}
    </UstazShell>
  );
}
