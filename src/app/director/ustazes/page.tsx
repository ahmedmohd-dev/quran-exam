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
  const rankText = (rank: number | null | undefined) => rank ? `${rank}ኛ ደረጃ` : "እስካሁን ደረጃ የለውም";
  const resultDescription = (label: string, average: number | null, rank: number | null | undefined, denominator: number) => average === null
    ? <p>የ{label} ውጤት እስካሁን አልተሞላም።</p>
    : <p>የ{label} አማካይ ውጤት፦ <strong>{average.toFixed(2)} / {denominator}</strong>። ከአጠቃላይ ኡስታዞች በ{label} <strong>{rankText(rank)}</strong> ይዞ አጠናቋል።</p>;

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

  return <DirectorShell><header className="workspace-header"><div><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link><p className="eyebrow">የኡስታዞች ውጤት</p><h1>የኡስታዞች ውጤት</h1><p>{totalSubmitted} ውጤቶች ተመዝግበዋል። በእያንዳንዱ ኡስታዝ ላይ በመጫን ዝርዝሩን ይመልከቱ።</p></div><DirectorHeaderActions onRefresh={() => void load()} /></header>{message && <p className="admin-message">{message}</p>}<section className="director-ustaz-list">{progress.map((item) => { const isOpen = openUstaz === item.ustaz.id; const rank = rankings[item.ustaz.id]; return <article className="admin-card director-ustaz-card" key={item.ustaz.id}><button className="director-ustaz-heading" type="button" onClick={() => setOpenUstaz(isOpen ? null : item.ustaz.id)}><span><strong>{item.ustaz.full_name}</strong><small>{item.ustaz.ustaz_code ?? "—"} · {item.registered} ተማሪዎች</small></span><b>{isOpen ? "−" : "+"}</b></button><div className="director-ustaz-summary"><div className="director-ustaz-descriptions">{resultDescription("ቁርአን", item.average, rank?.quran, 100)}{resultDescription("ሂስኑል ሙስሊም", item.hisnulAverage, rank?.hisnul, 100)}{resultDescription("የቤት ስራ", item.homeworkAverage, rank?.homework, 100)}</div><div className="director-rank-counts"><span>1ኛ ደረጃ ያመጡ ተማሪዎች ብዛት፦ <b>{item.ranks.first}</b> ናቸው።</span><span>2ኛ ደረጃ ያመጡ ተማሪዎች ብዛት፦ <b>{item.ranks.second}</b> ናቸው።</span><span>3ኛ ደረጃ ያመጡ ተማሪዎች ብዛት፦ <b>{item.ranks.third}</b> ናቸው።</span><span>4ኛ ደረጃ ያመጡ ተማሪዎች ብዛት፦ <b>{item.ranks.fourth}</b> ናቸው።</span></div></div>{isOpen && <div className="director-ranks"><span>ከተመዘገቡ {item.registered} ተማሪዎች ውስጥ {item.submitted} ተማሪዎች ተፈትነዋል።</span><form className="director-comment-form" onSubmit={(event) => void saveComment(event, item.ustaz.id)}><label>ለኡስታዙ አጠቃላይ አስተያየት<textarea value={comments[item.ustaz.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [item.ustaz.id]: event.target.value }))} maxLength={2000} placeholder="ኡስታዙ በውጤት ገጹ የሚያየው" /></label><button className="secondary-button" disabled={saving === item.ustaz.id}>{saving === item.ustaz.id ? "በማስቀመጥ ላይ…" : "አስተያየት አስቀምጥ"}</button></form></div>}</article>; })}{!message && !progress.length && <div className="empty-state"><strong>የኡስታዝ መረጃ አልተገኘም።</strong></div>}</section></DirectorShell>;
}
