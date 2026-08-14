"use client";

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

export function ExaminerShell({ children }: { children: ReactNode }) {
  const [name, setName] = useState("ፈታኝ");

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    }
    void loadProfile();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <main className="examiner-app"><aside className="examiner-sidebar"><div className="brand"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></div><p>የፈታኝ ገጽ</p><div className="profile-card"><strong>{name}</strong><span>ፈታኝ</span><button type="button" onClick={signOut}>ውጣ</button></div></aside><section className="examiner-content">{children}</section></main>;
}
