import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import logo from "../../assets/logo.jpg";
import { SignOutButton } from "@/components/sign-out-button";

type AdminShellProps = {
  active: "periods" | "users" | "students" | "assignments" | "classification" | "review" | "results" | "progress" | "packets";
  children: ReactNode;
};

export function AdminShell({ active, children }: AdminShellProps) {
  return (
    <main className="admin-app">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><Image src={logo} alt="مركز علي الحيدر logo" className="logo" priority /><span>مركز علي الحيدر</span></Link>
        <p className="admin-label">EXAM ADMIN</p>
        <nav className="admin-nav">
          <Link className={active === "periods" ? "active" : ""} href="/admin/periods">Registration control</Link>
          <Link className={active === "users" ? "active" : ""} href="/admin/users">User accounts</Link>
          <Link className={active === "students" ? "active" : ""} href="/admin/students">Students</Link>
          <Link className={active === "classification" ? "active" : ""} href="/admin/classification">Classification</Link>
          <Link className={active === "assignments" ? "active" : ""} href="/admin/assignments">Assignments</Link>
          <Link className={active === "review" ? "active" : ""} href="/admin/review">Review assignments</Link>
          <Link className={active === "results" ? "active" : ""} href="/admin/results">Test results</Link>
          <Link className={active === "progress" ? "active" : ""} href="/admin/progress">Exam progress</Link>
          <Link className={active === "packets" ? "active" : ""} href="/admin/assistant-packets">Assistant packets</Link>
          <span>Examiner setup <small>Phase 2</small></span>
        </nav>
        <div className="admin-help"><strong>Need help?</strong><span>Set the registration dates, then add Ustaz accounts.</span><SignOutButton className="admin-sign-out" /></div>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
