"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import logo from "../../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const supabase = createClient();
    const login = String(formData.get("email")).trim().toLowerCase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: login.includes("@") ? login : `${login}@users.merekez.local`,
      password: String(formData.get("password")),
    });
    setLoading(false);

    if (signInError) {
      setError("Your email address or password is incorrect. Please try again.");
      return;
    }
    window.location.assign("/");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="login-brand" href="/"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /> مركز علي الحيدر</Link>
        <div><p className="eyebrow">SECURE ACCESS</p><h1>Welcome back</h1><p>Sign in to manage the Qur&apos;an Revision Examination.</p></div>
        <form onSubmit={signIn} className="login-form">
          <label>Username or email address<input name="email" required autoComplete="username" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="login-note">Accounts are created by the Exam Admin.</p>
      </section>
    </main>
  );
}
