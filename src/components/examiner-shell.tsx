"use client";

import Image from "next/image";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import logo from "../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

const ExaminerGroupContext = createContext<"boys" | "girls">("boys");

export function useExaminerGroup() {
  return useContext(ExaminerGroupContext);
}

export function ExaminerShell({ children }: { children: ReactNode }) {
  const [name, setName] = useState("ፈታኝ");
  const [groupCode, setGroupCode] = useState<"boys" | "girls">("boys");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (data?.full_name) setName(data.full_name);
      const { data: membership } = await supabase.from("exam_group_memberships").select("exam_group:exam_groups(code)").eq("profile_id", user.id).maybeSingle();
      const code = (membership?.exam_group as unknown as { code?: string } | null)?.code;
      if (code === "boys" || code === "girls") setGroupCode(code);
    }
    void loadProfile();
  }, []);

  useEffect(() => {
    if (groupCode === "girls" && (pathname.startsWith("/examiner/hisnul-muslim") || pathname.startsWith("/examiner/homework"))) router.replace("/examiner");
  }, [groupCode, pathname, router]);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <ExaminerGroupContext.Provider value={groupCode}><main className="examiner-app"><aside className="examiner-sidebar"><div className="brand"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></div><p>የፈታኝ ገጽ</p><div className="examiner-group-label">{groupCode === "girls" ? "የሴቶች ፈተና" : "የወንዶች ፈተና"}</div><div className="profile-card"><strong>{name}</strong><span>ፈታኝ</span><button type="button" onClick={signOut}>ውጣ</button></div></aside><section className="examiner-content">{children}</section></main></ExaminerGroupContext.Provider>;
}
