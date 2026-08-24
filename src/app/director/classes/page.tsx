"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DirectorHeaderActions, DirectorShell } from "@/components/director-shell";
import { buildProgress, loadDirectorData, mederesaClasses, Result, UstazProgress } from "@/lib/director-data";

type ClassProgress = {
  id: string;
  title: string;
  ustazes: UstazProgress[];
  registered: number;
  submitted: number;
  average: number | null;
  hisnulAverage: number | null;
  homeworkAverage: number | null;
  ranks: Record<Result["result_class"], number>;
};

export default function DirectorClassesPage() {
  const [progress, setProgress] = useState<UstazProgress[]>([]);
  const [message, setMessage] = useState("መረጃውን በመጫን ላይ…");
  const [openClass, setOpenClass] = useState<string | null>(null);

  async function load() {
    setMessage("መረጃውን በመጫን ላይ…");
    try {
      const data = await loadDirectorData();
      setProgress(buildProgress(data.ustazes, data.registrations, data.results, data.supplemental));
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "መረጃውን ማምጣት አልተቻለም።"); }
  }

  useEffect(() => { void load(); }, []);

  const classes = useMemo<ClassProgress[]>(() => mederesaClasses.map((classGroup) => {
    const ustazes = progress.filter((item) => item.ustaz.ustaz_code && classGroup.ustazCodes.includes(item.ustaz.ustaz_code));
    const registered = ustazes.reduce((sum, item) => sum + item.registered, 0);
    const submitted = ustazes.reduce((sum, item) => sum + item.submitted, 0);
    const submittedWithAverage = ustazes.filter((item) => item.average !== null);
    const average = submitted ? ustazes.reduce((sum, item) => sum + (item.average ?? 0) * item.submitted, 0) / submitted : null;
    const hisnulCount = ustazes.reduce((sum, item) => sum + item.hisnulCount, 0);
    const homeworkCount = ustazes.reduce((sum, item) => sum + item.homeworkCount, 0);
    const hisnulAverage = hisnulCount ? ustazes.reduce((sum, item) => sum + (item.hisnulAverage ?? 0) * item.hisnulCount, 0) / hisnulCount : null;
    const homeworkAverage = homeworkCount ? ustazes.reduce((sum, item) => sum + (item.homeworkAverage ?? 0) * item.homeworkCount, 0) / homeworkCount : null;
    return {
      id: classGroup.id,
      title: classGroup.title,
      ustazes,
      registered,
      submitted,
      average: submittedWithAverage.length ? average : null,
      hisnulAverage,
      homeworkAverage,
      ranks: ustazes.reduce((totals, item) => ({ first: totals.first + item.ranks.first, second: totals.second + item.ranks.second, third: totals.third + item.ranks.third, fourth: totals.fourth + item.ranks.fourth }), { first: 0, second: 0, third: 0, fourth: 0 }),
    };
  }), [progress]);

  return <DirectorShell><header className="workspace-header"><div><Link className="back-link" href="/director">← ወደ ዋና ገጽ</Link><p className="eyebrow">የክፍሎች ውጤት</p><h1>የመድረሳ ክፍሎች</h1><p>ውጤቶች በአምስቱ የመድረሳ ክፍሎች ተከፍለው ይታያሉ።</p></div><DirectorHeaderActions onRefresh={() => void load()} /></header>{message && <p className="admin-message">{message}</p>}<section className="director-class-list">{classes.map((classGroup) => { const isOpen = openClass === classGroup.id; return <article className="admin-card director-class-card" key={classGroup.id}><button className="director-ustaz-heading" type="button" onClick={() => setOpenClass(isOpen ? null : classGroup.id)}><span><strong>{classGroup.title}</strong><small>{classGroup.registered} ተማሪዎች · የቁርአን አማካይ {classGroup.average === null ? "—" : `${classGroup.average.toFixed(2)} / 100`}</small></span><b>{isOpen ? "−" : "+"}</b></button><div className="director-ustaz-summary"><span>ሂስኑል ሙስሊም: <b>{classGroup.hisnulAverage === null ? "—" : `${classGroup.hisnulAverage.toFixed(2)} / 100`}</b></span><span>የቤት ስራ: <b>{classGroup.homeworkAverage === null ? "—" : `${classGroup.homeworkAverage.toFixed(2)} / 100`}</b></span><span>1ኛ: <b>{classGroup.ranks.first}</b></span><span>2ኛ: <b>{classGroup.ranks.second}</b></span><span>3ኛ: <b>{classGroup.ranks.third}</b></span><span>4ኛ: <b>{classGroup.ranks.fourth}</b></span></div>{isOpen && <div className="director-class-members">{classGroup.ustazes.map((item) => <div key={item.ustaz.id}><strong>{item.ustaz.full_name}</strong><small>{item.registered} ተማሪዎች · ቁርአን {item.average === null ? "—" : `${item.average.toFixed(2)} / 100`} · ሂስኑል {item.hisnulAverage === null ? "—" : `${item.hisnulAverage.toFixed(2)} / 100`} · የቤት ስራ {item.homeworkAverage === null ? "—" : `${item.homeworkAverage.toFixed(2)} / 100`}</small></div>)}</div>}</article>; })}</section></DirectorShell>;
}
