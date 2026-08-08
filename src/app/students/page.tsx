import { StudentManager } from "@/components/student-manager";
import { UstazShell } from "@/components/ustaz-shell";

export default function StudentsPage() {
  return <UstazShell><StudentManager /></UstazShell>;
}
