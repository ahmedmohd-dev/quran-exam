"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import logo from "../../assets/logo.jpg";
import { SignOutButton } from "@/components/sign-out-button";

type AdminShellProps = {
  active: "periods" | "users" | "students" | "assignments" | "classification" | "review" | "results" | "classResults" | "progress" | "packets" | "ustazFeedback" | "ageResults" | "zeroReport" | "report" | "standards" | "ustazRankings";
  children: ReactNode;
};

export function AdminShell({ active, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <main className="admin-app">
      <button className="admin-menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="admin-navigation">
        {menuOpen ? "×" : "☰"}<span>{menuOpen ? "ዝጋ" : "ምናሌ"}</span>
      </button>
      {menuOpen && <button className="admin-menu-backdrop" type="button" onClick={closeMenu} aria-label="የአስተዳዳሪ ምናሌን ዝጋ" />}
      <aside className={`admin-sidebar ${menuOpen ? "mobile-open" : ""}`} id="admin-navigation">
        <Link className="admin-brand" href="/" onClick={closeMenu}><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></Link>
        <p className="admin-label">EXAM ADMIN</p>
        <nav className="admin-nav">
          <Link className={active === "periods" ? "active" : ""} href="/admin/periods" onClick={closeMenu}>Registration control</Link>
          <Link className={active === "users" ? "active" : ""} href="/admin/users" onClick={closeMenu}>User accounts</Link>
          <Link className={active === "students" ? "active" : ""} href="/admin/students" onClick={closeMenu}>Students</Link>
          <Link className={active === "classification" ? "active" : ""} href="/admin/classification" onClick={closeMenu}>Classification</Link>
          <Link className={active === "assignments" ? "active" : ""} href="/admin/assignments" onClick={closeMenu}>Assignments</Link>
          <Link className={active === "review" ? "active" : ""} href="/admin/review" onClick={closeMenu}>Review assignments</Link>
          <Link className={active === "results" ? "active" : ""} href="/admin/results" onClick={closeMenu}>Test results</Link>
          <Link className={active === "classResults" ? "active" : ""} href="/admin/classes" onClick={closeMenu}>Results by rank</Link>
          <Link className={active === "ageResults" ? "active" : ""} href="/admin/age-results" onClick={closeMenu}>Results by age</Link>
          <Link className={active === "ustazRankings" ? "active" : ""} href="/admin/ustaz-rankings" onClick={closeMenu}>Ustaz rankings</Link>
          <Link className={active === "zeroReport" ? "active" : ""} href="/admin/zero-report" onClick={closeMenu}>Zero-mark report</Link>
          <Link className={active === "report" ? "active" : ""} href="/admin/report" onClick={closeMenu}>Full exam report</Link>
          <Link className={active === "standards" ? "active" : ""} href="/admin/standards" onClick={closeMenu}>Below standard</Link>
          <Link className={active === "progress" ? "active" : ""} href="/admin/progress" onClick={closeMenu}>Exam progress</Link>
          <Link className={active === "packets" ? "active" : ""} href="/admin/assistant-packets" onClick={closeMenu}>Assistant packets</Link>
          <Link className={active === "ustazFeedback" ? "active" : ""} href="/admin/ustaz-feedback" onClick={closeMenu}>Ustaz feedback</Link>
          <span>Examiner setup <small>Phase 2</small></span>
        </nav>
        <div className="admin-help"><strong>Need help?</strong><span>Set the registration dates, then add Ustaz accounts.</span><SignOutButton className="admin-sign-out" /></div>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
