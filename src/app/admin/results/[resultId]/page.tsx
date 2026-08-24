"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Question = Record<string, number>;
type ResultData = {
  id: string;
  examiner_assignment_id: string;
  student_registration_id: string;
  examiner_id: string;
  round_scores: Question[][];
  makhraj_scores: number[];
  examiner_comment: string | null;
  revision_track: "alif" | "quran" | "qaida" | "admin" | null;
  revision_place: number | null;
  assignment: { student_registration: { student: { full_name: string } | null } | null } | null;
};

function maximumFor(key: string) {
  return key === "fluency" || key === "speed" ? 4 : key === "mistakes" ? 5 : key === "surahName" ? 1 : 2;
}

export default function AdminEditResultPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);
  const [roundScores, setRoundScores] = useState<Question[][]>([]);
  const [makhrajScores, setMakhrajScores] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [revisionTrack, setRevisionTrack] = useState<ResultData["revision_track"]>(null);
  const [revisionPlace, setRevisionPlace] = useState("");
  const [hisnul, setHisnul] = useState("");
  const [homework, setHomework] = useState("");
  const [message, setMessage] = useState("Loading result...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("exam_results").select("id,examiner_assignment_id,student_registration_id,examiner_id,round_scores,makhraj_scores,examiner_comment,revision_track,revision_place,assignment:examiner_assignments(student_registration:student_registrations(student:students(full_name)))").eq("id", resultId).maybeSingle();
      if (error || !data) { setMessage(error?.message ?? "Result not found."); return; }
      const loaded = data as unknown as ResultData;
      const { data: extra } = await supabase.from("exam_supplemental_results").select("hisnul_muslim_mark,homework_mark").eq("examiner_assignment_id", loaded.examiner_assignment_id).maybeSingle();
      setResult(loaded);
      setRoundScores(loaded.round_scores ?? []);
      setMakhrajScores(loaded.makhraj_scores ?? []);
      setComment(loaded.examiner_comment ?? "");
      setRevisionTrack(loaded.revision_track);
      setRevisionPlace(loaded.revision_place ? String(loaded.revision_place) : "");
      setHisnul(extra?.hisnul_muslim_mark == null ? "" : String(extra.hisnul_muslim_mark));
      setHomework(extra?.homework_mark == null ? "" : String(extra.homework_mark));
      setMessage("");
    }
    void load();
  }, [resultId]);

  function updateScore(roundIndex: number, questionIndex: number, key: string, value: string) {
    const maximum = maximumFor(key);
    const score = Math.max(0, Math.min(maximum, Number(value) || 0));
    setRoundScores((current) => current.map((round, index) => index === roundIndex ? round.map((question, questionNumber) => questionNumber === questionIndex ? { ...question, [key]: score } : question) : round));
  }

  async function save() {
    if (!result) return;
    setSaving(true); setMessage("");
    const supabase = createClient();
    const { error } = await supabase.from("exam_results").update({ round_scores: roundScores, makhraj_scores: makhrajScores, examiner_comment: comment.trim() || null, revision_track: revisionTrack, revision_place: revisionPlace ? Number(revisionPlace) : null }).eq("id", result.id);
    if (error) { setSaving(false); setMessage(error.message); return; }
    const { error: extraError } = await supabase.from("exam_supplemental_results").upsert({ examiner_assignment_id: result.examiner_assignment_id, student_registration_id: result.student_registration_id, examiner_id: result.examiner_id, hisnul_muslim_mark: Number(hisnul || 0), homework_mark: Number(homework || 0) }, { onConflict: "examiner_assignment_id" });
    setSaving(false);
    if (extraError) { setMessage(extraError.message); return; }
    setMessage("Result correction saved.");
    window.setTimeout(() => router.push("/admin/results"), 900);
  }

  return <AdminShell active="results"><header className="workspace-header"><div><Link className="back-link" href="/admin/results">← Back to results</Link><p className="eyebrow">ADMIN RESULT CORRECTION</p><h1>{result?.assignment?.student_registration?.student?.full_name ?? "Result"}</h1><p>Correct the saved marks, comments, revision, or supplemental scores. Totals and rank are recalculated automatically.</p></div></header>{message && <p className="admin-message">{message}</p>}{result && <><section className="admin-card marking-rounds">{roundScores.map((round, roundIndex) => <fieldset className="marking-round" key={roundIndex}><legend>Round {roundIndex + 1}</legend><div className="question-grid">{round.map((question, questionIndex) => <fieldset className="question-card" key={questionIndex}><legend>Question {questionIndex + 1}</legend><div className="score-fields">{Object.entries(question).map(([key, value]) => <label key={key}>{key}<input type="number" min="0" max={maximumFor(key)} step="0.01" value={value} onChange={(event) => updateScore(roundIndex, questionIndex, key, event.target.value)} /></label>)}</div></fieldset>)}</div></fieldset>)}</section><section className="admin-card"><div className="form-grid"><fieldset className="score-fields"><legend>Makhraj round scores</legend>{makhrajScores.map((score, roundIndex) => <label key={roundIndex}>Round {roundIndex + 1}<input type="number" min="0" max="20" step="0.01" value={score} onChange={(event) => setMakhrajScores((current) => current.map((value, index) => index === roundIndex ? Math.max(0, Number(event.target.value) || 0) : value))} /></label>)}</fieldset><label>Revision track<select value={revisionTrack ?? ""} onChange={(event) => setRevisionTrack((event.target.value || null) as ResultData["revision_track"])}><option value="">None</option><option value="alif">Alif</option><option value="quran">Qur'an</option><option value="qaida">Qaida Nuraniya</option><option value="admin">Admin decision</option></select></label></div><div className="form-grid"><label>Revision place<input type="number" min="1" max="114" value={revisionPlace} onChange={(event) => setRevisionPlace(event.target.value)} /></label><label>Hisnul Muslim / 20<input type="number" min="0" max="20" step="0.01" value={hisnul} onChange={(event) => setHisnul(event.target.value)} /></label><label>Homework / 5<input type="number" min="0" max="5" step="0.01" value={homework} onChange={(event) => setHomework(event.target.value)} /></label></div><label>Examiner comment<textarea rows={4} value={comment} onChange={(event) => setComment(event.target.value)} /></label><div className="modal-actions"><Link className="secondary-button" href="/admin/results">Cancel</Link><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving..." : "Save correction"}</button></div></section></>}</AdminShell>;
}
