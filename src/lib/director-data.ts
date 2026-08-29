import { createClient } from "@/lib/supabase/client";

export type Ustaz = { id: string; full_name: string; ustaz_code: string | null; manager_id: string | null };
export type Registration = { id: string; ustaz_id: string; registered_age: number | null; study_years: number | null; study_months: number | null; class_group: string | null; student: { full_name: string } | null };
export type Result = {
  student_registration_id: string;
  examiner_assignment_id: string;
  status: "draft" | "submitted";
  total_mark: number;
  result_class: "first" | "second" | "third" | "fourth";
};

export type SupplementalResult = {
  examiner_assignment_id: string;
  hisnul_muslim_mark: number | null;
  homework_mark: number | null;
};

export type UstazProgress = {
  ustaz: Ustaz;
  registered: number;
  submitted: number;
  drafts: number;
  notStarted: number;
  average: number | null;
  hisnulAverage: number | null;
  homeworkAverage: number | null;
  hisnulCount: number;
  homeworkCount: number;
  ranks: Record<Result["result_class"], number>;
};

export type UstazRankings = Record<string, { quran: number | null; hisnul: number | null; homework: number | null }>;

export const rankLabels: Record<Result["result_class"], string> = {
  first: "1ኛ ደረጃ",
  second: "2ኛ ደረጃ",
  third: "3ኛ ደረጃ",
  fourth: "4ኛ ደረጃ",
};

export const mederesaClasses = [
  { id: "alif", title: "أ ክፍል (የፉአድ ክፍል)", ustazCodes: ["UST-03", "UST-17", "UST-07"] },
  { id: "ba", title: "ب ክፍል (የሙበሽር ክፍል)", ustazCodes: ["UST-18", "UST-06", "UST-12"] },
  { id: "ta", title: "ت ክፍል (የሰላሀዲን ክፍል)", ustazCodes: ["UST-10", "UST-09", "UST-11", "UST-25"] },
  { id: "jim", title: "ج ክፍል (የመሀመድ ክፍል)", ustazCodes: ["UST-21", "UST-24", "UST-22", "UST-20", "UST-08", "UST-14", "UST-23", "UST-05"] },
  { id: "mezelah", title: "مظلة (የናሙስ ክፍል)", ustazCodes: ["UST-02", "UST-15", "UST-16", "UST-19", "UST-13", "UST-04"] },
];

export async function loadDirectorData() {
  const supabase = createClient();
  const { data: period, error: periodError } = await supabase
    .from("exam_periods")
    .select("id,name")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error(periodError?.message ?? "የፈተና ወቅት አልተገኘም።");

  const [ustazQuery, registrationQuery, resultQuery] = await Promise.all([
    supabase.from("profiles").select("id,full_name,ustaz_code,manager_id").eq("role", "ustaz").eq("active", true).order("full_name"),
    supabase.from("student_registrations").select("id,ustaz_id,registered_age,study_years,study_months,class_group,student:students(full_name)").eq("exam_period_id", period.id),
    supabase.from("exam_results").select("student_registration_id,examiner_assignment_id,status,total_mark,result_class").eq("exam_period_id", period.id),
  ]);
  const error = [ustazQuery.error, registrationQuery.error, resultQuery.error].find(Boolean);
  if (error) throw new Error(error.message);

  const results = (resultQuery.data ?? []) as Result[];
  const assignmentIds = results.map((result) => result.examiner_assignment_id).filter(Boolean);
  const supplementalQuery = assignmentIds.length
    ? await supabase
        .from("exam_supplemental_results")
        .select("examiner_assignment_id,hisnul_muslim_mark,homework_mark")
        .in("examiner_assignment_id", assignmentIds)
    : { data: [], error: null };
  if (supplementalQuery.error) throw new Error(supplementalQuery.error.message);

  return {
    periodId: period.id,
    periodName: period.name ?? "የአሁኑ ፈተና",
    ustazes: (ustazQuery.data ?? []) as Ustaz[],
    registrations: (registrationQuery.data ?? []) as unknown as Registration[],
    results,
    supplemental: (supplementalQuery.data ?? []) as SupplementalResult[],
  };
}

function averageAsPercent(values: Array<number | null>, rawMaximum: number) {
  const filledValues = values.filter((value): value is number => value !== null && value !== undefined);
  return filledValues.length ? filledValues.reduce((sum, value) => sum + Number(value), 0) / filledValues.length / rawMaximum * 100 : null;
}

export function buildProgress(ustazes: Ustaz[], registrations: Registration[], results: Result[], supplemental: SupplementalResult[]): UstazProgress[] {
  const resultByRegistration = new Map(results.map((result) => [result.student_registration_id, result]));
  const supplementalByAssignment = new Map(supplemental.map((result) => [result.examiner_assignment_id, result]));
  return ustazes.filter((ustaz) => !ustaz.manager_id).map((ustaz) => {
    const managedIds = ustazes.filter((candidate) => candidate.manager_id === ustaz.id).map((candidate) => candidate.id);
    const ownRegistrations = registrations.filter((registration) => [ustaz.id, ...managedIds].includes(registration.ustaz_id));
    const ownResults = ownRegistrations.map((registration) => resultByRegistration.get(registration.id)).filter((result): result is Result => Boolean(result));
    const submittedResults = ownResults.filter((result) => result.status === "submitted");
    const submittedSupplemental = submittedResults
      .map((result) => supplementalByAssignment.get(result.examiner_assignment_id))
      .filter((result): result is SupplementalResult => Boolean(result));
    const hisnulEligibleRegistrationIds = new Set(ownRegistrations
      .filter((registration) => {
        const durationInMonths = (registration.study_years ?? 0) * 12 + (registration.study_months ?? 0);
        return durationInMonths !== 1 && durationInMonths !== 2;
      })
      .map((registration) => registration.id));
    const hisnulEligibleSupplemental = submittedResults
      .filter((result) => hisnulEligibleRegistrationIds.has(result.student_registration_id))
      .map((result) => supplementalByAssignment.get(result.examiner_assignment_id))
      .filter((result): result is SupplementalResult => Boolean(result));
    const ranks = { first: 0, second: 0, third: 0, fourth: 0 };
    submittedResults.forEach((result) => { ranks[result.result_class] += 1; });
    return {
      ustaz,
      registered: ownRegistrations.length,
      submitted: submittedResults.length,
      drafts: ownResults.filter((result) => result.status === "draft").length,
      notStarted: ownRegistrations.length - ownResults.length,
      average: submittedResults.length ? submittedResults.reduce((sum, result) => sum + Number(result.total_mark), 0) / submittedResults.length : null,
      hisnulAverage: averageAsPercent(hisnulEligibleSupplemental.map((result) => result.hisnul_muslim_mark), 20),
      homeworkAverage: averageAsPercent(submittedSupplemental.map((result) => result.homework_mark), 5),
      hisnulCount: hisnulEligibleSupplemental.filter((result) => result.hisnul_muslim_mark !== null).length,
      homeworkCount: submittedSupplemental.filter((result) => result.homework_mark !== null).length,
      ranks,
    };
  }).sort((first, second) => second.submitted - first.submitted || first.ustaz.full_name.localeCompare(second.ustaz.full_name));
}

function rankValues(items: UstazProgress[], valueFor: (item: UstazProgress) => number | null) {
  const ranked = items.filter((item) => valueFor(item) !== null).sort((first, second) => Number(valueFor(second)) - Number(valueFor(first)));
  const ranks = new Map<string, number>();
  let previousValue: number | null = null;
  let currentRank = 0;
  ranked.forEach((item, index) => {
    const value = valueFor(item)!;
    if (previousValue === null || value !== previousValue) currentRank = index + 1;
    ranks.set(item.ustaz.id, currentRank);
    previousValue = value;
  });
  return ranks;
}

export function buildUstazRankings(progress: UstazProgress[]): UstazRankings {
  const quranRanks = rankValues(progress, (item) => item.average);
  const hisnulRanks = rankValues(progress, (item) => item.hisnulAverage);
  const homeworkRanks = rankValues(progress, (item) => item.homeworkAverage);
  return Object.fromEntries(progress.map((item) => [item.ustaz.id, {
    quran: quranRanks.get(item.ustaz.id) ?? null,
    hisnul: hisnulRanks.get(item.ustaz.id) ?? null,
    homework: homeworkRanks.get(item.ustaz.id) ?? null,
  }]));
}

export function buildSummary(registrations: Registration[], results: Result[], supplemental: SupplementalResult[]) {
  const submitted = results.filter((result) => result.status === "submitted");
  const supplementalByAssignment = new Map(supplemental.map((result) => [result.examiner_assignment_id, result]));
  const submittedSupplemental = submitted
    .map((result) => supplementalByAssignment.get(result.examiner_assignment_id))
    .filter((result): result is SupplementalResult => Boolean(result));
  const ranks = { first: 0, second: 0, third: 0, fourth: 0 };
  submitted.forEach((result) => { ranks[result.result_class] += 1; });
  return {
    registered: registrations.length,
    submitted: submitted.length,
    drafts: results.filter((result) => result.status === "draft").length,
    pending: registrations.length - submitted.length,
    average: submitted.length ? submitted.reduce((sum, result) => sum + Number(result.total_mark), 0) / submitted.length : null,
    hisnulAverage: averageAsPercent(submittedSupplemental.map((result) => result.hisnul_muslim_mark), 20),
    homeworkAverage: averageAsPercent(submittedSupplemental.map((result) => result.homework_mark), 5),
    hisnulCount: submittedSupplemental.filter((result) => result.hisnul_muslim_mark !== null).length,
    homeworkCount: submittedSupplemental.filter((result) => result.homework_mark !== null).length,
    ranks,
  };
}
