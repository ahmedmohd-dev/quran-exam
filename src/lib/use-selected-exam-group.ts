"use client";

import { useEffect, useState } from "react";

export type SelectedExamGroup = "boys" | "girls";

function storedGroup(): SelectedExamGroup {
  if (typeof window === "undefined") return "boys";
  return window.localStorage.getItem("exam-group") === "girls" ? "girls" : "boys";
}

export function useSelectedExamGroup() {
  const [groupCode, setGroupCode] = useState<SelectedExamGroup>(storedGroup);

  useEffect(() => {
    function onGroupChanged(event: Event) {
      const code = (event as CustomEvent<SelectedExamGroup>).detail;
      if (code === "boys" || code === "girls") setGroupCode(code);
    }
    window.addEventListener("exam-group-changed", onGroupChanged);
    return () => window.removeEventListener("exam-group-changed", onGroupChanged);
  }, []);

  return groupCode;
}
