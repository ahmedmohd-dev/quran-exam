"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Group = { id: string; code: "boys" | "girls"; name: string };

export function ExamGroupSwitcher() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [girlReady, setGirlReady] = useState(false);
  const [selected, setSelected] = useState<"boys" | "girls">("boys");

  useEffect(() => {
    const stored = window.localStorage.getItem("exam-group");
    if (stored === "boys" || stored === "girls") setSelected(stored);
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("exam_groups").select("id,code,name").eq("active", true).order("code");
      const nextGroups = (data ?? []) as Group[];
      setGroups(nextGroups);
      const girls = nextGroups.find((group) => group.code === "girls");
      if (!girls) return;
      const { count } = await supabase.from("exam_group_memberships").select("id", { count: "exact", head: true }).eq("exam_group_id", girls.id);
      setGirlReady((count ?? 0) > 0);
    }
    void load();
  }, []);

  function choose(code: "boys" | "girls") {
    if (code === "girls" && !girlReady) return;
    setSelected(code);
    window.localStorage.setItem("exam-group", code);
    window.dispatchEvent(new CustomEvent("exam-group-changed", { detail: code }));
    window.location.reload();
  }

  return <div className="exam-group-switcher" aria-label="Examination group"><span>የፈተና ቡድን</span><div>{groups.map((group) => <button key={group.code} type="button" className={selected === group.code ? "active" : ""} disabled={group.code === "girls" && !girlReady} onClick={() => choose(group.code)}>{group.code === "boys" ? "ወንዶች" : "ሴቶች"}{group.code === "girls" && !girlReady ? " · ዝግጅት ላይ" : ""}</button>)}</div></div>;
}
