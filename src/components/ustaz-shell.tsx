"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

export function UstazShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("አስታዝ");
  const [groupCode, setGroupCode] = useState<"boys" | "girls">("boys");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data }, { data: membership }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("exam_group_memberships").select("exam_group:exam_groups!inner(code)").eq("profile_id", user.id).maybeSingle(),
      ]);
      if (data?.full_name) setName(data.full_name);
      const group = membership?.exam_group as unknown as { code?: string } | null;
      if (group?.code === "girls") setGroupCode("girls");
    }
    loadProfile();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <main className="app-shell"><aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}><div className="brand"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></div><nav><a className="nav-link" href="/registration">መመዝገቢያ</a><a className="nav-link" href="/students">የእኔ ተማሪዎች</a>{groupCode === "boys" && <><a className="nav-link" href="/school-information">የትምህርት ቤት መረጃ</a><a className="nav-link" href="/results">የተማሪዎቼ ውጤት</a></>}</nav><div className="profile-card"><strong>{name}</strong><span>አስታዝ</span><button className="sign-out-button" type="button" onClick={signOut}>Sign out</button></div></aside><section className="content student-page"><header className="topbar"><div><p className="eyebrow">መመዝገቢያ</p><h1>የእኔ ተማሪዎች</h1></div><button className={`mobile-menu ${menuOpen ? "menu-open" : ""}`} type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? "×" : "☰"}</button></header>{children}</section></main>;
}
