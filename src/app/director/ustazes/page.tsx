"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DirectorHeaderActions, DirectorShell } from "@/components/director-shell";
import { buildProgress, buildUstazRankings, loadDirectorData, UstazProgress } from "@/lib/director-data";
import { createClient } from "@/lib/supabase/client";

export default function DirectorUstazesPage() {
  const [progress, setProgress] = useState<UstazProgress[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  const [openUstaz, setOpenUstaz] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setMessage("መረጃውን በመጫን ላይ…");
    try {
      const data = await loadDirectorData();
      const { data: commentData, error } = await createClient().from("ustaz_result_comments").select("ustaz_id,comment").eq("exam_period_id", data.periodId);
      if (error) throw error;
      setPeriodId(data.periodId);
      setProgress(buildProgress(data.ustazes, data.registrations, data.results, data.supplemental));
      setComments(Object.fromEntries((commentData ?? []).map((item) => [item.ustaz_id, item.comment])));
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "መረጃውን ማምጣት አልተቻለም።"); }
  }

  useEffect(() => { void load(); }, []);
  const totalSubmitted = useMemo(() => progress.reduce((sum, item) => sum + item.submitted, 0), [progress]);
  const rankings = useMemo(() => buildUstazRankings(progress), [progress]);

  async function saveComment(event: FormEvent<HTMLFormElement>, ustazId: string) {
    event.preventDefault();
    if (!periodId) return;
    setSaving(ustazId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ustaz_result_comments").upsert({ exam_period_id: periodId, ustaz_id: ustazId, comment: comments[ustazId] ?? "", updated_by: user?.id }, { onConflict: "exam_period_id,ustaz_id" });
    setSaving(null);
    setMessage(error ? error.message : "አስተያየቱ ተቀምጧል።");
  }

  return <DirectorShell><header className="workspace-header"><div><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link><p className="eyebrow">የኡስታዞች ውጤት</p><h1>የኡስታዞች ውጤት</h1><p>{totalSubmitted} ውጤቶች ተመዝግበዋል። በእያንዳንዱ ኡስታዝ ላይ በመጫን ዝርዝሩን ይመልከቱ።</p></div><DirectorHeaderActions onRefresh={() => void load()} /></header>{message && <p className="admin-message">{message}</p>}<section className="director-ustaz-list">{progress.map((item) => { const isOpen = openUstaz === item.ustaz.id; const rank = rankings[item.ustaz.id]; return <article className="admin-card director-ustaz-card" key={item.ustaz.id}><button className="director-ustaz-heading" type="button" onClick={() => setOpenUstaz(isOpen ? null : item.ustaz.id)}><span><strong>{item.ustaz.full_name}</strong><small>{item.ustaz.ustaz_code ?? "—"} · {item.registered} ተማሪዎች</small></span><b>{isOpen ? "−" : "+"}</b></button><div className="director-ustaz-summary"><span>የቁርአን: <b>{item.average === null ? "—" : `${item.average.toFixed(2)} / 100`} · {rank?.quran ?? "—"}ኛ</b></span><span>ሂስኑል: <b>{item.hisnulAverage === null ? "—" : `${item.hisnulAverage.toFixed(2)} / 100`} · {rank?.hisnul ?? "—"}ኛ</b></span><span>የቤት ስራ: <b>{item.homeworkAverage === null ? "—" : `${item.homeworkAverage.toFixed(2)} / 100`} · {rank?.homework ?? "—"}ኛ</b></span><span>1ኛ: <b>{item.ranks.first}</b></span><span>2ኛ: <b>{item.ranks.second}</b></span><span>3ኛ: <b>{item.ranks.third}</b></span><span>4ኛ: <b>{item.ranks.fourth}</b></span></div>{isOpen && <div className="director-ranks"><span>የተመዘገበ ውጤት: <b>{item.submitted}</b></span><form className="director-comment-form" onSubmit={(event) => void saveComment(event, item.ustaz.id)}><label>ለኡስታዙ አጠቃላይ አስተያየት<textarea value={comments[item.ustaz.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.ustaz.id]: event.target.value }))} maxLength={2000} placeholder="ኡስታዙ በውጤት ገጹ የሚያየው" /></label><button className="secondary-button" disabled={saving === item.ustaz.id}>{saving === item.ustaz.id ? "በማስቀመጥ ላይ…" : "አስተያየት አስቀምጥ"}</button></form></div>}</article>; })}{!message && !progress.length && <div className="empty-state"><strong>የኡስታዝ መረጃ አልተገኘም።</strong></div>}</section></DirectorShell>;
}
