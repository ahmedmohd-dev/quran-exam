"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Level = "Alif" | "Qur'an";
type Ustaz = { id: string; full_name: string };
type Student = { registrationId: string; name: string; number: string; ustazId: string; ustazName: string; level: Level; place: number };
type GroupDefinition = { key: string; title: string; level: "alif" | "quran"; minimum: number; maximum: number; order: number };
type Group = GroupDefinition & { students: Student[] };
type SavedRange = { id: string; group_key: string; place_start: number; place_end: number };

const groupDefinitions: GroupDefinition[] = [
  { key: "alif-low", title: "Alif - Fesel 1-17", level: "alif", minimum: 1, maximum: 17, order: 1 },
  { key: "alif-high", title: "Alif - Fesel 18-27", level: "alif", minimum: 18, maximum: 27, order: 2 },
  { key: "quran-90-114", title: "Alif Quran - Surahs 90-114", level: "quran", minimum: 90, maximum: 114, order: 3 },
  { key: "quran-67-89", title: "Qur'an - Surahs 67-89", level: "quran", minimum: 67, maximum: 89, order: 4 },
  { key: "quran-47-66", title: "Qur'an - Surahs 47-66", level: "quran", minimum: 47, maximum: 66, order: 5 },
  { key: "quran-36-46", title: "Qur'an - Surahs 36-46", level: "quran", minimum: 36, maximum: 46, order: 6 },
  { key: "quran-1-35", title: "Qur'an - Surahs 1-35", level: "quran", minimum: 1, maximum: 35, order: 7 },
];

function classify(student: Student) {
  if (student.level === "Alif" && student.place <= 17) return "alif-low";
  if (student.level === "Alif") return "alif-high";
  if (student.place >= 90) return "quran-90-114";
  if (student.place >= 67) return "quran-67-89";
  if (student.place >= 47) return "quran-47-66";
  if (student.place >= 36) return "quran-36-46";
  return "quran-1-35";
}

function buildRanges(group: Group, requestedCount: number) {
  const placeCounts = Array.from(group.students.filter((student) => Number.isFinite(student.place)).reduce((counts, student) => counts.set(student.place, (counts.get(student.place) ?? 0) + 1), new Map<number, number>()).entries()).sort(([first], [second]) => first - second);
  const rangeCount = Math.max(1, Math.min(requestedCount, Math.max(1, placeCounts.length)));
  if (placeCounts.length === 0) return [{ start: group.minimum, end: group.maximum, students: 0 }];
  const ranges: { start: number; end: number; students: number }[] = [];
  let nextStart = group.minimum;
  let bucketIndex = 0;
  let remainingStudents = group.students.length;

  for (let rangeIndex = 0; rangeIndex < rangeCount; rangeIndex += 1) {
    const remainingRanges = rangeCount - rangeIndex;
    if (remainingRanges === 1) {
      ranges.push({ start: nextStart, end: group.maximum, students: remainingStudents });
      break;
    }
    if (bucketIndex >= placeCounts.length) {
      ranges.push({ start: nextStart, end: group.maximum, students: remainingStudents });
      break;
    }
    const target = remainingStudents / remainingRanges;
    let studentsInRange = 0;
    let end = nextStart;
    while (bucketIndex < placeCounts.length) {
      const [place, count] = placeCounts[bucketIndex];
      studentsInRange += count;
      end = place;
      bucketIndex += 1;
      const bucketsLeft = placeCounts.length - bucketIndex;
      if (studentsInRange >= target && bucketsLeft >= remainingRanges - 1) break;
    }
    ranges.push({ start: nextStart, end, students: studentsInRange });
    nextStart = end + 1;
    remainingStudents -= studentsInRange;
  }
  return ranges;
}

export default function ClassificationPage() {
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [ustazes, setUstazes] = useState<Ustaz[]>([]);
  const [bigUstazIds, setBigUstazIds] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>([]);
  const [rangeCounts, setRangeCounts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("Loading classification data...");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") { setMessage("Only the Exam Admin can manage classification."); return; }
    const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!period) { setMessage("Create the current examination session first."); return; }
    setPeriodId(period.id);
    const [ustazResult, bigResult, registrationResult, rangeResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "ustaz").eq("active", true).order("full_name"),
      supabase.from("exam_period_big_ustazes").select("ustaz_id").eq("exam_period_id", period.id),
      supabase.from("student_registrations").select("id, ustaz_id, current_learning_level, current_learning_place, student:students(student_number, full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)").eq("exam_period_id", period.id).order("created_at", { ascending: true }),
      supabase.from("exam_assignment_groups").select("id, group_key, place_start, place_end").eq("exam_period_id", period.id).order("place_start"),
    ]);
    if (ustazResult.error || bigResult.error || registrationResult.error || rangeResult.error) {
      setMessage(ustazResult.error?.message ?? bigResult.error?.message ?? registrationResult.error?.message ?? rangeResult.error?.message ?? "Could not load classification data.");
      return;
    }
    const loadedRanges = rangeResult.data ?? [];
    setUstazes(ustazResult.data ?? []);
    setBigUstazIds((bigResult.data ?? []).map((item) => item.ustaz_id));
    setSavedRanges(loadedRanges);
    const loadedCounts = loadedRanges.reduce<Record<string, number>>((counts, range) => ({ ...counts, [range.group_key]: (counts[range.group_key] ?? 0) + 1 }), {});
    setRangeCounts(loadedCounts);
    setStudents((registrationResult.data ?? []).map((item) => {
      const student = item.student as unknown as { student_number: string; full_name: string };
      const ustaz = item.ustaz as unknown as { full_name: string } | null;
      return { registrationId: item.id, name: student.full_name, number: student.student_number, ustazId: item.ustaz_id, ustazName: ustaz?.full_name ?? "", level: item.current_learning_level === "alif" ? "Alif" : "Qur'an", place: Number(item.current_learning_place) };
    }));
    setMessage("");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void loadData(); }, 0); return () => window.clearTimeout(timer); }, []);

  const regularStudents = useMemo(() => students.filter((student) => !bigUstazIds.includes(student.ustazId)), [students, bigUstazIds]);
  const bigStudents = useMemo(() => students.filter((student) => bigUstazIds.includes(student.ustazId)), [students, bigUstazIds]);
  const groups = useMemo<Group[]>(() => groupDefinitions.map((definition) => ({ ...definition, students: regularStudents.filter((student) => classify(student) === definition.key).sort((first, second) => first.place - second.place) })), [regularStudents]);
  const bigGroups = useMemo(() => bigUstazIds.map((id) => ({ ustaz: ustazes.find((item) => item.id === id), students: bigStudents.filter((student) => student.ustazId === id) })), [bigStudents, bigUstazIds, ustazes]);

  async function saveBigUstazes() {
    if (!periodId || bigUstazIds.length !== 3) { setMessage("Select exactly the 3 Ustazes who have Big students."); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("exam_period_big_ustazes").delete().eq("exam_period_id", periodId);
    const { error } = deleteError ? { error: deleteError } : await supabase.from("exam_period_big_ustazes").insert(bigUstazIds.map((ustazId) => ({ exam_period_id: periodId, ustaz_id: ustazId, selected_by: user.id })));
    setSaving(false);
    setMessage(error ? error.message : "Big Ustazes saved. Their students stay separate from regular classification.");
    if (!error) await loadData();
  }

  async function saveRanges(group: Group) {
    if (!periodId) return;
    const count = rangeCounts[group.key] ?? 1;
    const ranges = buildRanges(group, count);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("exam_assignment_groups").delete().eq("exam_period_id", periodId).eq("group_key", group.key);
    const { error } = deleteError ? { error: deleteError } : await supabase.from("exam_assignment_groups").insert(ranges.map((range) => ({ exam_period_id: periodId, group_key: group.key, group_title: group.title, group_order: group.order, learning_level: group.level, place_start: range.start, place_end: range.end, created_by: user.id })));
    setSaving(false);
    setMessage(error ? error.message : `${group.title}: ${ranges.length} examination range(s) saved.`);
    if (!error) await loadData();
  }

  return <AdminShell active="classification"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN - PHASE 2</p><h1>Student classification</h1><p>Separate Big students first, then choose how many Examiners will cover each regular group.</p></div><div className="workspace-step"><span>1</span><div><strong>Classification</strong><small>{regularStudents.length} regular students</small></div></div></header><section className="admin-card"><div className="card-title"><div><h2>Big Ustazes</h2><p>Select the 3 Ustazes whose students must remain in separate groups.</p></div><button className="primary-button" type="button" onClick={saveBigUstazes} disabled={saving}>{saving ? "Saving..." : "Save Big Ustazes"}</button></div>{message && <p className="admin-message">{message}</p>}<div className="big-ustaz-options">{ustazes.map((ustaz) => <label key={ustaz.id}><input type="checkbox" checked={bigUstazIds.includes(ustaz.id)} onChange={() => setBigUstazIds((current) => current.includes(ustaz.id) ? current.filter((id) => id !== ustaz.id) : current.length < 3 ? [...current, ustaz.id] : current)} /><span>{ustaz.full_name}</span></label>)}</div></section><section className="classification-groups">{groups.map((group) => { const maximumRanges = Math.max(1, new Set(group.students.map((student) => student.place)).size); const requestedCount = Math.max(1, Math.min(rangeCounts[group.key] ?? 1, maximumRanges)); const preview = buildRanges(group, requestedCount); const configured = savedRanges.filter((range) => range.group_key === group.key); return <article className="admin-card classification-group" key={group.key}><div className="card-title"><div><h2>{group.title}</h2><p>{group.students.length} students</p></div><label className="range-count">Examiners<input type="number" min="1" max={maximumRanges} defaultValue={requestedCount} onChange={(event) => { const numeric = Number(event.target.value); if (event.target.value && Number.isFinite(numeric)) setRangeCounts((current) => ({ ...current, [group.key]: Math.max(1, Math.min(maximumRanges, numeric)) })); }} onBlur={(event) => { const numeric = Number(event.currentTarget.value); const safe = Number.isFinite(numeric) && numeric >= 1 ? Math.min(maximumRanges, numeric) : 1; event.currentTarget.value = String(safe); setRangeCounts((current) => ({ ...current, [group.key]: safe })); }} /></label></div><div className="range-preview">{preview.map((range) => <span key={`${range.start}-${range.end}`}>{range.start}-{range.end} <small>{range.students} students</small></span>)}</div><button className="secondary-button" type="button" onClick={() => void saveRanges(group)} disabled={saving}>Save these ranges</button>{configured.length > 0 && <p className="muted">Saved: {configured.map((range) => `${range.place_start}-${range.place_end}`).join(", ")}</p>}</article>; })}</section><section className="classification-groups">{bigGroups.map((group) => <article className="admin-card classification-group big-group" key={group.ustaz?.id ?? "big"}><div className="card-title"><h2>Big - {group.ustaz?.full_name ?? "Ustaz"}</h2><strong>{group.students.length}</strong></div>{group.students.slice(0, 8).map((student) => <div className="classification-student" key={student.registrationId}><strong>{student.name}</strong><small>{student.number} - {student.level} - place {student.place}</small></div>)}{group.students.length > 8 && <p>Showing 8 of {group.students.length}.</p>}{group.students.length === 0 && <p>No students in this group.</p>}</article>)}</section></AdminShell>;
}
