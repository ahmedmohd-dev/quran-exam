"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExaminerShell } from "@/components/examiner-shell";
import { createClient } from "@/lib/supabase/client";
import { alifFesels } from "@/lib/alif-fesels";
import { surahs } from "@/lib/surahs";

type Scheme =
  | "alif_1_17"
  | "alif_18_27"
  | "alif_quran_90_114"
  | "quran_67_89"
  | "quran_47_66"
  | "quran_36_46"
  | "quran_1_35";
type Question = Record<string, number>;
type StudentInfo = {
  assignmentId: string;
  registrationId: string;
  name: string;
  level: "alif" | "quran";
  place: number;
  ustazCode: string;
  scheme: Scheme;
  rounds: number;
  makhrajMaximums: number[];
};
type ResultRow = {
  id: string;
  round_scores: Question[][];
  makhraj_scores: number[];
  examiner_comment: string | null;
  revision_place: number | null;
  revision_track: "alif" | "quran" | "qaida" | "admin" | null;
};
type RevisionTrack = "alif" | "quran" | "qaida" | "admin";

const alifQuestion = (): Question => ({ fluency: 0, speed: 0, hesitation: 0 });
const quranQuestion = (): Question => ({
  mistakes: 0,
  tajweed: 0,
  hesitation: 0,
  surahName: 0,
});
const numberValue = (value: unknown) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const inputValue = (value: unknown) =>
  numberValue(value) === 0 ? "" : String(numberValue(value));

function normalizeQuestion(
  question: Question | null | undefined,
  quran: boolean
): Question {
  const source = question ?? {};
  return quran
    ? {
        mistakes: numberValue(source.mistakes),
        tajweed: numberValue(source.tajweed),
        hesitation: numberValue(source.hesitation),
        surahName: numberValue(source.surahName),
      }
    : {
        fluency: numberValue(source.fluency),
        speed: numberValue(source.speed),
        hesitation: numberValue(source.hesitation),
      };
}

function isQuranScheme(scheme: Scheme) {
  return scheme === "alif_quran_90_114" || scheme.startsWith("quran_");
}

function roundTitle(scheme: Scheme, index: number, currentPlace: number) {
  if (scheme === "alif_1_17") return "ዙር 1 · ፈሰል 1–17";
  if (scheme === "alif_18_27")
    return index === 0 ? "ዙር 1 · ፈሰል 1–17" : "ዙር 2 · ፈሰል 18–27";
  if (scheme === "alif_quran_90_114")
    return index === 0
      ? "ዙር 1 · ፈሰል 1–17"
      : index === 1
      ? "ዙር 2 · ፈሰል 18–27"
      : `ዙር 3 · ${surahs[currentPlace - 1]}`;
  const ranges =
    scheme === "quran_67_89"
      ? [
          [114, 90],
          [89, currentPlace],
        ]
      : scheme === "quran_47_66"
      ? [
          [114, 90],
          [89, 67],
          [66, currentPlace],
        ]
      : scheme === "quran_36_46"
      ? [
          [114, 90],
          [89, 67],
          [66, 47],
          [46, currentPlace],
        ]
      : [
          [114, 90],
          [89, 67],
          [66, 47],
          [46, 36],
          [35, currentPlace],
        ];
  const [start, end] = ranges[index];
  return `ዙር ${index + 1} · ${surahs[start - 1]} – ${surahs[end - 1]}`;
}

function schemeFor(
  level: "alif" | "quran",
  place: number
): Omit<
  StudentInfo,
  "assignmentId" | "registrationId" | "name" | "level" | "place" | "ustazCode"
> | null {
  if (level === "alif" && place >= 1 && place <= 17)
    return { scheme: "alif_1_17", rounds: 1, makhrajMaximums: [20] };
  if (level === "alif" && place >= 18 && place <= 27)
    return { scheme: "alif_18_27", rounds: 2, makhrajMaximums: [10, 10] };
  if (level === "quran" && place >= 90 && place <= 114)
    return {
      scheme: "alif_quran_90_114",
      rounds: 3,
      makhrajMaximums: [5, 5, 10],
    };
  if (level === "quran" && place >= 67 && place <= 89)
    return { scheme: "quran_67_89", rounds: 2, makhrajMaximums: [10, 10] };
  if (level === "quran" && place >= 47 && place <= 66)
    return { scheme: "quran_47_66", rounds: 3, makhrajMaximums: [6, 7, 7] };
  if (level === "quran" && place >= 36 && place <= 46)
    return { scheme: "quran_36_46", rounds: 4, makhrajMaximums: [5, 5, 5, 5] };
  if (level === "quran" && place >= 1 && place <= 35)
    return {
      scheme: "quran_1_35",
      rounds: 5,
      makhrajMaximums: [4, 4, 4, 4, 4],
    };
  return null;
}

function createRounds(scheme: Scheme, rounds: number) {
  return Array.from({ length: rounds }, (_, roundIndex) =>
    Array.from({ length: 8 }, () =>
      isQuranScheme(scheme) &&
      (scheme !== "alif_quran_90_114" || roundIndex === 2)
        ? quranQuestion()
        : alifQuestion()
    )
  );
}

function questionMark(question: Question) {
  return Object.values(question).reduce(
    (total, score) => total + numberValue(score),
    0
  );
}

function totalFor(
  roundScores: Question[][],
  makhrajScores: number[],
  rounds: number
) {
  const rawQuestions = roundScores
    .flat()
    .reduce((total, question) => total + questionMark(question), 0);
  const questionTotal = Math.min(80, (rawQuestions * 80) / (rounds * 80));
  const makhrajTotal = makhrajScores.reduce(
    (total, score) => total + numberValue(score),
    0
  );
  return questionTotal + makhrajTotal;
}

function resultPreview(
  total: number,
  student: StudentInfo | null,
  revisionTrack: RevisionTrack | "",
  revisionPlace: string
) {
  if (total >= 80) return { label: "1ኛ ደረጃ · አልፏል", action: "ክለሳ አያስፈልግም" };
  const label = total >= 60 ? "2ኛ ደረጃ" : total >= 40 ? "3ኛ ደረጃ" : "4ኛ ደረጃ";
  if (total < 40) {
    return {
      label,
      action:
        student?.level === "alif"
          ? "ከቃዒዳ ኑራኒያ መጀመሪያ ጀምሮ ይከለስ"
          : "የሚከለስበት ቦታ በበላይ አካል ይወሰናል",
    };
  }
  if (revisionTrack === "qaida")
    return { label, action: "ከቃዒዳ ኑራኒያ ከመጀመሪያው ይጀምር" };
  if (revisionTrack === "admin")
    return { label, action: "የሚከለስበት ቦታ በበላይ አካል ይወሰናል" };
  if (revisionTrack === "quran" && revisionPlace) {
    const place = Number(revisionPlace);
    return { label, action: `ቁርአን · ${place} · ${surahs[place - 1] ?? ""}` };
  }
  if (revisionTrack === "alif" && revisionPlace) {
    const place = Number(revisionPlace);
    return {
      label,
      action: `አሊፍ · ፈሰል ${place} · ${alifFesels[place - 1] ?? ""}`,
    };
  }
  return { label, action: "የክለሳ ቦታ ይምረጡ" };
}

function revisionTrackFor(
  student: StudentInfo,
  total: number,
  selected: RevisionTrack | ""
) {
  if (total >= 80) return "";
  if (total < 40) return student.level === "alif" ? "qaida" : "admin";
  if (total >= 60 && student.level === "alif") return "alif";
  if (selected === "admin") return "";
  return selected;
}

export default function MarkStudentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [roundScores, setRoundScores] = useState<Question[][]>([]);
  const [makhrajScores, setMakhrajScores] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [revisionPlace, setRevisionPlace] = useState("");
  const [revisionTrack, setRevisionTrack] = useState<RevisionTrack | "">("");
  const [activeRound, setActiveRound] = useState(0);
  const [message, setMessage] = useState("የተማሪውን መረጃ በመጫን ላይ…");
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const changeVersion = useRef(0);

  const total = useMemo(
    () => (student ? totalFor(roundScores, makhrajScores, student.rounds) : 0),
    [student, roundScores, makhrajScores]
  );
  const makhrajTotal = makhrajScores.reduce(
    (sum, score) => sum + numberValue(score),
    0
  );
  const questionTotal = Math.max(0, total - makhrajTotal);
  const activeRevisionTrack = student
    ? revisionTrackFor(student, total, revisionTrack)
    : "";
  const preview = resultPreview(
    total,
    student,
    activeRevisionTrack,
    revisionPlace
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: assignment, error } = await supabase
        .from("examiner_assignments")
        .select(
          "id, student_registration:student_registrations(id, current_learning_level, current_learning_place, student:students(full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(ustaz_code))"
        )
        .eq("id", assignmentId)
        .eq("examiner_id", user.id)
        .maybeSingle();

      if (error || !assignment?.student_registration) {
        setMessage(error?.message ?? "ይህ ተማሪ ለእርስዎ አልተመደበም።");
        return;
      }

      const registration = assignment.student_registration as unknown as {
        id: string;
        current_learning_level: "alif" | "quran";
        current_learning_place: string | null;
        student: { full_name: string } | null;
        ustaz: { ustaz_code: string | null } | null;
      };
      const place = Number(registration.current_learning_place);
      const setup = schemeFor(registration.current_learning_level, place);
      if (!setup || !registration.student) {
        setMessage("የዚህ ተማሪ መመዘኛ ገና አልተዘጋጀም።");
        return;
      }

      setStudent({
        assignmentId,
        registrationId: registration.id,
        name: registration.student.full_name,
        level: registration.current_learning_level,
        place,
        ustazCode: registration.ustaz?.ustaz_code ?? "—",
        ...setup,
      });

      const { data: existing, error: resultError } = await supabase
        .from("exam_results")
        .select(
          "id, round_scores, makhraj_scores, examiner_comment, revision_place, revision_track"
        )
        .eq("examiner_assignment_id", assignmentId)
        .maybeSingle();
      if (resultError) {
        setMessage(resultError.message);
        return;
      }

      const saved = existing as ResultRow | null;
      setResultId(saved?.id ?? null);
      const savedRounds = saved?.round_scores;
      setRoundScores(
        Array.isArray(savedRounds) && savedRounds.length === setup.rounds
          ? Array.from({ length: setup.rounds }, (_, roundIndex) =>
              Array.from({ length: 8 }, (_, questionIndex) =>
                normalizeQuestion(
                  savedRounds[roundIndex]?.[questionIndex],
                  isQuranScheme(setup.scheme) &&
                    (setup.scheme !== "alif_quran_90_114" || roundIndex === 2)
                )
              )
            )
          : createRounds(setup.scheme, setup.rounds)
      );
      setMakhrajScores(
        Array.isArray(saved?.makhraj_scores) &&
          saved.makhraj_scores.length === setup.rounds
          ? setup.makhrajMaximums.map((maximum, index) =>
              Math.max(
                0,
                Math.min(maximum, numberValue(saved.makhraj_scores[index]))
              )
            )
          : setup.makhrajMaximums.map(() => 0)
      );
      setComment(saved?.examiner_comment ?? "");
      setRevisionPlace(
        saved?.revision_place ? String(saved.revision_place) : ""
      );
      setRevisionTrack(saved?.revision_track ?? "");
      setMessage("");
      setHasLoaded(true);
    }

    void load();
  }, [assignmentId]);

  function markDirty() {
    changeVersion.current += 1;
    setDirty(true);
    setAutoSaveStatus("");
  }

  function updateQuestion(
    roundIndex: number,
    questionIndex: number,
    field: string,
    value: string,
    maximum: number
  ) {
    const score = Math.max(0, Math.min(maximum, numberValue(value)));
    markDirty();
    setRoundScores((current) =>
      current.map((round, index) =>
        index !== roundIndex
          ? round
          : round.map((question, questionPosition) =>
              questionPosition === questionIndex
                ? { ...question, [field]: score }
                : question
            )
      )
    );
  }

  function updateMakhraj(value: string) {
    if (!student) return;
    const score = Math.max(
      0,
      Math.min(student.makhrajMaximums[activeRound], numberValue(value))
    );
    markDirty();
    setMakhrajScores((current) =>
      current.map((item, index) => (index === activeRound ? score : item))
    );
  }

  async function save(status: "draft" | "submitted", automatic = false) {
    if (!student) return false;
    const currentTotal = totalFor(roundScores, makhrajScores, student.rounds);
    const selectedTrack = revisionTrackFor(
      student,
      currentTotal,
      revisionTrack
    );
    const needsPlace = selectedTrack === "alif" || selectedTrack === "quran";
    if (
      status === "submitted" &&
      currentTotal >= 60 &&
      currentTotal < 80 &&
      !selectedTrack
    ) {
      setMessage("ውጤት ከማስገባትዎ በፊት የሚከለስበትን ቦታ ይምረጡ!");
      return false;
    }
    if (
      status === "submitted" &&
      currentTotal >= 40 &&
      currentTotal < 80 &&
      needsPlace &&
      !revisionPlace
    ) {
      setMessage("እባክዎ የሚከለስበትን ቦታ ይምረጡ።");
      return false;
    }
    const saveVersion = changeVersion.current;
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setMessage("እባክዎ በድጋሚ ይግቡ።");
      return false;
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("examiner_assignments")
      .select("exam_period_id")
      .eq("id", student.assignmentId)
      .single();
    if (assignmentError || !assignment) {
      setSaving(false);
      setMessage(assignmentError?.message ?? "የፈተና መረጃ አልተገኘም።");
      return false;
    }

    const payload = {
      exam_period_id: assignment.exam_period_id,
      examiner_assignment_id: student.assignmentId,
      student_registration_id: student.registrationId,
      examiner_id: user.id,
      marking_scheme: student.scheme,
      round_scores: roundScores,
      makhraj_scores: makhrajScores,
      examiner_comment: comment.trim() || null,
      revision_place:
        needsPlace && revisionPlace ? Number(revisionPlace) : null,
      revision_track: selectedTrack || null,
      status,
    };
    const request = resultId
      ? supabase
          .from("exam_results")
          .update(payload)
          .eq("id", resultId)
          .select("id, total_mark")
          .single()
      : supabase
          .from("exam_results")
          .insert(payload)
          .select("id, total_mark")
          .single();
    const { data, error } = await request;
    setSaving(false);
    if (error) {
      if (automatic) setAutoSaveStatus("ራስ-ሰር ማስቀመጥ አልተሳካም።");
      setMessage(error.message);
      return false;
    }
    setResultId(data.id);
    if (changeVersion.current === saveVersion) setDirty(false);
    if (status === "submitted") setShowSubmitDialog(false);
    if (automatic) {
      setAutoSaveStatus("ራስ-ሰር ተቀምጧል።");
      window.setTimeout(() => setAutoSaveStatus(""), 3500);
    } else setMessage(
      status === "submitted"
        ? `ውጤቱ ተልኳል። ጠቅላላ ውጤት: ${data.total_mark}/100`
        : "ረቂቁ ተቀምጧል።"
    );
    if (!automatic) window.setTimeout(() => setMessage(""), 4000);
    if (status === "submitted")
      window.setTimeout(() => router.push("/examiner/test"), 1200);
    return true;
  }

  const saveRef = useRef<typeof save | null>(null);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!hasLoaded || !dirty || saving || !student) return;
    const timer = window.setTimeout(
      () => void saveRef.current?.("draft", true),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [
    hasLoaded,
    dirty,
    saving,
    student,
    roundScores,
    makhrajScores,
    comment,
    revisionPlace,
    revisionTrack,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  async function returnToStudents() {
    if (saving) {
      setMessage("ረቂቱ በመቀመጥ ላይ ነው። እባክዎ ይጠብቁ።");
      return;
    }
    if (dirty && !(await save("draft", true))) return;
    router.push("/examiner/test");
  }

  if (!student)
    return (
      <ExaminerShell>
        <p className="admin-message">{message}</p>
      </ExaminerShell>
    );

  const questions = roundScores[activeRound] ?? [];
  const quranRound =
    isQuranScheme(student.scheme) &&
    (student.scheme !== "alif_quran_90_114" || activeRound === 2);

  return (
    <ExaminerShell>
      <header className="examiner-header">
        <Link
          className="back-link"
          href="/examiner/test"
          onClick={(event) => {
            event.preventDefault();
            void returnToStudents();
          }}
        >
          ← ወደ ተማሪዎች
        </Link>
        <p className="eyebrow">የፈተና መመዝገቢያ</p>
        <h1>{student.name}</h1>
        <p>
          {student.level === "quran" ? "ቁርአን" : "አሊፍ"} ·{" "}
          {student.level === "quran"
            ? surahs[student.place - 1]
            : alifFesels[student.place - 1]}{" "}
          · የኡስታዝ ኮድ: {student.ustazCode}
        </p>
      </header>

      {message && (
        <div className="examiner-toast" role="status" aria-live="polite">
          <span>{message}</span>
          <button
            type="button"
            aria-label="Close notification"
            onClick={() => setMessage("")}
          >
            ×
          </button>
        </div>
      )}

      <section className="score-summary">
        <div>
          <span>የጥያቄ ውጤት</span>
          <strong>{questionTotal.toFixed(2)} /80%</strong>
        </div>
        <div>
          <span>መኸረጅ እና ሲፋ</span>
          <strong>{makhrajTotal} /20%</strong>
        </div>
        <div>
          <span>ጠቅላላ</span>
          <strong>{total.toFixed(2)} /100%</strong>
        </div>
        <div>
          <span>{preview.label}</span>
          <small>{preview.action}</small>
        </div>
      </section>

      {student.rounds > 1 && (
        <nav className="round-tabs" aria-label="Test rounds">
          {Array.from({ length: student.rounds }, (_, index) => (
            <button
              key={index}
              className={index === activeRound ? "active" : ""}
              type="button"
              onClick={() => setActiveRound(index)}
            >
              {roundTitle(student.scheme, index, student.place)}
            </button>
          ))}
        </nav>
      )}

      <section className="marking-rounds">
        <article className="admin-card marking-round">
          <div className="card-title">
            <div>
              <h2>{roundTitle(student.scheme, activeRound, student.place)}</h2>
              <p>እያንዳንዱ ጥያቄ ከ10% · 8 ጥያቄዎች</p>
            </div>
          </div>
          <div className="question-grid">
            {questions.map((question, questionIndex) => (
              <fieldset className="question-card" key={questionIndex}>
                <legend>ጥያቄ {questionIndex + 1}</legend>
                {quranRound ? (
                  <div className="score-fields">
                    <label>
                      ስህተት ከ5%
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={inputValue(question.mistakes)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "mistakes",
                            event.target.value,
                            5
                          )
                        }
                      />
                    </label>
                    <label>
                      ተጅዊድ ከ2%
                      <input
                        type="number"
                        min="0"
                        max="2"
                        value={inputValue(question.tajweed)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "tajweed",
                            event.target.value,
                            2
                          )
                        }
                      />
                    </label>
                    <label>
                      መንተባተብ ከ2%
                      <input
                        type="number"
                        min="0"
                        max="2"
                        value={inputValue(question.hesitation)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "hesitation",
                            event.target.value,
                            2
                          )
                        }
                      />
                    </label>
                    <label>
                      የሱራ ስም ከ1%
                      <input
                        type="number"
                        min="0"
                        max="1"
                        value={inputValue(question.surahName)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "surahName",
                            event.target.value,
                            1
                          )
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="score-fields">
                    <label>
                      በማፋገጥ ከ4%
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={inputValue(question.fluency)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "fluency",
                            event.target.value,
                            4
                          )
                        }
                      />
                    </label>
                    <label>
                      በሽምደዳ ከ4%
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={inputValue(question.speed)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "speed",
                            event.target.value,
                            4
                          )
                        }
                      />
                    </label>
                    <label>
                      መንተባተብ ከ2%
                      <input
                        type="number"
                        min="0"
                        max="2"
                        value={inputValue(question.hesitation)}
                        onChange={(event) =>
                          updateQuestion(
                            activeRound,
                            questionIndex,
                            "hesitation",
                            event.target.value,
                            2
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <label className="makhraj-field">
            መኸረጅ እና ሲፋ ከ{student.makhrajMaximums[activeRound]}%
            <input
              type="number"
              min="0"
              max={student.makhrajMaximums[activeRound]}
              value={inputValue(makhrajScores[activeRound])}
              onChange={(event) => updateMakhraj(event.target.value)}
            />
          </label>
        </article>
      </section>

      <section className="admin-card examiner-comment">
        <label>
          የፈታኙ አስተያየት
          <textarea
            value={comment}
            onChange={(event) => {
              markDirty();
              setComment(event.target.value);
            }}
            placeholder="ያዩትን ስህተት ወይም ማስታወሻ ይጻፉ።"
            rows={4}
          />
        </label>
        <div className="marking-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={saving}
            onClick={() => void save("draft")}
          >
            ለበኋላ አስቀምጥ
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={saving}
            onClick={() => setShowSubmitDialog(true)}
          >
            ውጤት አስገባ
          </button>
        </div>
      </section>
      {showSubmitDialog && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal submit-review-modal" role="dialog" aria-modal="true" aria-labelledby="submit-review-title">
            <div className="modal-heading">
              <div>
                <h2 id="submit-review-title">ውጤቱን ያረጋግጡ</h2>
                <p className="form-help">ውጤቱን ከማስገባትዎ በፊት የክለሳ ምርጫውን ይሙሉ።</p>
              </div>
              <button className="close" type="button" onClick={() => setShowSubmitDialog(false)}>×</button>
            </div>
            <div className="submit-review-summary">
              <div><span>የጥያቄ ውጤት</span><strong>{questionTotal.toFixed(2)} /80%</strong></div>
              <div><span>መኸረጅ እና ሲፋ</span><strong>{makhrajTotal} /20%</strong></div>
              <div><span>ጠቅላላ</span><strong>{total.toFixed(2)} /100%</strong></div>
              <div><span>ደረጃ</span><strong>{preview.label}</strong></div>
            </div>
            {total >= 40 && total < 80 && (student.level === "quran" || total < 60) && (
              <label>
                የሚከለሰው ወደ ቁርአን ነው ወይስ ወደ አሊፍ?
                <select value={revisionTrack === "admin" ? "" : revisionTrack} onChange={(event) => { markDirty(); setRevisionTrack((event.target.value || "") as RevisionTrack | ""); setRevisionPlace(""); }}>
                  <option value="">ይምረጡ</option>
                  <option value="quran">ቁርአን</option>
                  <option value="alif">አሊፍ</option>
                  {total < 60 && <option value="qaida">ከቃኢዳ ኑራኒያ ከመጀመሪያው ይጀምር</option>}
                </select>
              </label>
            )}
            {total >= 60 && total < 80 && student.level === "alif" && <p className="form-help">የአሊፍ ተማሪ ስለሆነ ክለሳው ከአሊፍ ፈሰል ይመረጣል።</p>}
            {total >= 40 && total < 80 && activeRevisionTrack === "alif" && (
              <label>
                የሚከለስበት የአሊፍ ፈሰል
                <select value={revisionPlace} onChange={(event) => { markDirty(); setRevisionPlace(event.target.value); }}>
                  <option value="">ፈሰል ይምረጡ</option>
                  {alifFesels.map((fesel, index) => <option key={index} value={index + 1}>ፈሰል {index + 1} · {fesel}</option>)}
                </select>
              </label>
            )}
            {total >= 40 && total < 80 && activeRevisionTrack === "quran" && (
              <label>
                የሚከለስበት የቁርአን ሱራ
                <select value={revisionPlace} onChange={(event) => { markDirty(); setRevisionPlace(event.target.value); }}>
                  <option value="">ሱራ ይምረጡ</option>
                  {surahs.map((surah, index) => <option key={index} value={index + 1}>{index + 1} · {surah}</option>)}
                </select>
              </label>
            )}
            {total >= 40 && total < 60 && activeRevisionTrack === "qaida" && <p className="form-help">ከቃኢዳ ኑራኒያ ከመጀመሪያው ይጀምር።</p>}
            {total < 40 && student.level === "alif" && <p className="form-help">ከቃኢዳ ኑራኒያ ከመጀመሪያው ይጀምር።</p>}
            {total < 40 && student.level === "quran" && <p className="form-help">የሚከለስበት ቦታ በበላይ አካል የሚወሰን ይሆናል።</p>}
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setShowSubmitDialog(false)}>ተመለስ</button>
              <button className="primary-button" type="button" disabled={saving} onClick={() => void save("submitted")}>{saving ? "በማስቀመጥ ላይ…" : "እርግጠኛ ነኝ · ውጤት አስገባ"}</button>
            </div>
          </div>
        </div>
      )}

      {autoSaveStatus && (
        <p className="form-help autosave-status">{autoSaveStatus}</p>
      )}
    </ExaminerShell>
  );
}
