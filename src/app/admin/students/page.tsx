import { AdminShell } from "@/components/admin-shell";
import { StudentManager } from "@/components/student-manager";

export default function AdminStudentsPage() {
  return <AdminShell active="students"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · STUDENTS</p><h1>Student management</h1><p>Manage all current registrations, grouped under their Ustaz.</p></div></header><StudentManager admin /></AdminShell>;
}
