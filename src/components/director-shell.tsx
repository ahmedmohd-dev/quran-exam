"use client";

import Image from "next/image";
import { ReactNode, useEffect, useState } from "react";
import logo from "../../assets/logo.jpg";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/client";

export function DirectorShell({ children }: { children: ReactNode }) {
  const [name, setName] = useState("የመድረሳ አስተዳዳሪ");

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return;
      const { data } = await createClient().from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
    }
    void loadProfile();
  }, []);

  return (
    <main className="director-app">
      <aside className="director-sidebar">
        <div className="brand">
          <Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority />
          <span>مركز علي الحيدر</span>
        </div>
        <p>የመድረሳ አስተዳዳሪ</p>
        <div className="profile-card">
          <strong>{name}</strong>
          <span>አስተዳዳሪ</span>
          <SignOutButton className="director-sign-out" label="ውጣ" signingOutLabel="በመውጣት ላይ…" />
        </div>
      </aside>
      <section className="director-content">{children}</section>
    </main>
  );
}

export function DirectorHeaderActions({ onRefresh }: { onRefresh: () => void }) {
  return <button className="secondary-button" type="button" onClick={onRefresh}>መረጃ አድስ</button>;
}
