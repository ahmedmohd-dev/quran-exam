"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignOutButtonProps = { className?: string };

export function SignOutButton({ className }: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <button className={className} type="button" onClick={signOut}>{isSigningOut ? "Signing out…" : "Sign out"}</button>;
}
