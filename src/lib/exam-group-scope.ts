import type { SupabaseClient } from "@supabase/supabase-js";

export type ExamGroupCode = "boys" | "girls";

export async function getExamGroupScope(supabase: SupabaseClient, code: ExamGroupCode) {
  const { data: group, error: groupError } = await supabase.from("exam_groups").select("id").eq("code", code).maybeSingle();
  if (groupError) return { groupId: null, profileIds: new Set<string>(), studentIds: new Set<string>(), error: groupError };
  if (!group) return { groupId: null, profileIds: new Set<string>(), studentIds: new Set<string>(), error: new Error("Examination group is not configured.") };
  const { data, error } = await supabase.from("exam_group_memberships").select("profile_id,student_id").eq("exam_group_id", group.id);
  return {
    groupId: group.id,
    profileIds: new Set((data ?? []).map((row) => row.profile_id).filter((id): id is string => Boolean(id))),
    studentIds: new Set((data ?? []).map((row) => row.student_id).filter((id): id is string => Boolean(id))),
    error,
  };
}
