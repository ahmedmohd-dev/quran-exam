"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import logo from "../../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          <label>Password<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} title={showPassword ? "Hide password" : "Show password"}><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">{showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 9.2 4.1 10 7-.3 1.1-1.1 2.5-2.2 3.7" /><path d="M6.2 6.2C4 7.5 2.5 9.6 2 12c.8 2.9 4.8 7 10 7 1.3 0 2.5-.2 3.6-.7" /></> : <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}</svg></button></div></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="login-note">Accounts are created by the Exam Admin.</p>
      </section>
    </main>
  );
}
