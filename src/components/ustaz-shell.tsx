"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

export function UstazShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("አስታዝ");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    }
    loadProfile();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <main className="app-shell"><aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}><div className="brand"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></div><nav><a className="nav-link" href="/">መመዝገቢያ</a><a className="nav-link active" href="/students">የእኔ ተማሪዎች</a></nav><div className="profile-card"><strong>{name}</strong><span>አስታዝ</span><button type="button" onClick={signOut}>ውጣ</button></div></aside><section className="content student-page"><header className="topbar"><div><p className="eyebrow">መመዝገቢያ</p><h1>የእኔ ተማሪዎች</h1></div><button className="mobile-menu" type="button" aria-label="Open menu" onClick={() => setMenuOpen((open) => !open)}>☰</button></header>{children}</section></main>;
}
