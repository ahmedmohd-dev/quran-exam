"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createClient } from "@/lib/supabase/client";

type Registration = { id: string; current_learning_level: "alif" | "quran"; student: { full_name: string } | null };
type Assignment = { id: string; examiner_id: string; student_registration: Registration | null };
type Examiner = { id: string; full_name: string };
type Packet = { examiner: Examiner; students: Assignment[] };

const hisnulQuestions = [
  "የሰላት መግቢያ ዱአ", "ሱረቱል ፋቲሀ", "ሩኩዕ ላይ እያሉ የሚደረግ ዱዐ", "ከሩኩዕ ሲነሱ የሚባል ዱዐ", "በሱጁድ ወቅት የሚነበብ ዱዐ", "በሁለት ሱጁዶች መሀከል የሚደረግ ዱዐ", "አት-ተሸሁድ", "ከተሸሁድ በኋላ የሚነበብ", "ከመጨረሻው ተሹሁድ በኋላ የሚደረግ ዱአ", "ሰላት ከተገባደደ በኋላ የሚባል ዚክር",
  "ከምግብ በፊት የሚባል ዚክር", "ከምግብ በኃላ የሚባል ዚክር", "አየተልኩርሲይ", "ሰዪዱል ኢስቲግፋር", "መፀዳጃ ቤት ሲገባ የሚደረግ ዱዐ", "ከመፀዳጃ ቤት ሲወጡ የሚደረግ ዱዐ", "ከውዱእ በፊት የሚባል ዚክር", "ውዱእ ከተጠናቀቀ በኋላ የሚባል ዚክር", "የአዛን ውዳሴዎች", "የጠዋትና ማታ ዚክር (3 ዚክር)",
];
const alifHomework = ["ከ أ - ج ያሉትን ፊደላቶች መጻፍ", "በያንዳንዱ ፊደሎች 1 ምሳሌ መጻፍ", "የራሳቸውን ስም እስከነአያት በአረብኛ መጻፍ", "ፋቲሀን በቃል መሸምደድ", "ከ ح - ر ያሉትን ፊደላቶች መጻፍ"];
const quranHomework = ["القلقلة", "الاستعلاء", "أحكام الراء", "الإظهار", "الإدغام"];

function esc(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character] ?? character)); }
function studentName(assignment: Assignment) { return assignment.student_registration?.student?.full_name ?? "Unknown student"; }

export default function AssistantPacketsPage() {
  const [packets, setPackets] = useState<Packet[]>([]);
  const [message, setMessage] = useState("Loading Examiner packets...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: period } = await supabase.from("exam_periods").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!period) { setMessage("No examination period found."); return; }
      const [examinerResponse, assignmentResponse] = await Promise.all([
        supabase.from("profiles").select("id,full_name").eq("role", "examiner").eq("active", true).order("full_name"),
        supabase.from("examiner_assignments").select("id,examiner_id,student_registration:student_registrations(id,current_learning_level,student:students(full_name))").eq("exam_period_id", period.id).order("assigned_at"),
      ]);
      const error = examinerResponse.error ?? assignmentResponse.error;
      if (error) { setMessage(error.message); return; }
      const examiners = (examinerResponse.data ?? []) as Examiner[];
      const assignments = (assignmentResponse.data ?? []) as unknown as Assignment[];
      setPackets(examiners.map((examiner) => ({ examiner, students: assignments.filter((assignment) => assignment.examiner_id === examiner.id) })));
      setMessage("");
    }
    void load();
  }, []);

  function homeworkTable(title: string, questions: string[], students: Assignment[]) {
    if (!students.length) return "";
    const headers = questions.map((_, index) => `<th>Q${index + 1}</th>`).join("");
    const rows = students.map((student, index) => `<tr><td>${index + 1}</td><td>${esc(studentName(student))}</td>${questions.map(() => "<td></td>").join("")}<td></td></tr>`).join("");
    return `<h2>${title} · /5</h2><table class="homework-table"><thead><tr><th>No.</th><th>Student</th>${headers}<th>Total /5</th></tr></thead><tbody>${rows}</tbody></table><div class="questions"><b>Questions:</b><ol>${questions.map((question) => `<li>${esc(question)}</li>`).join("")}</ol></div>`;
  }

  function packetHtml(packet: Packet) {
    const headers = hisnulQuestions.map((_, index) => `<th>${index + 1}</th>`).join("");
    const rows = packet.students.map((student, index) => `<tr><td>${index + 1}</td><td>${esc(studentName(student))}</td>${hisnulQuestions.map(() => "<td></td>").join("")}<td></td></tr>`).join("");
    const alif = packet.students.filter((student) => student.student_registration?.current_learning_level === "alif");
    const quran = packet.students.filter((student) => student.student_registration?.current_learning_level === "quran");
    const homework = homeworkTable("Alif homework", alifHomework, alif) + homeworkTable("Qur’an homework", quranHomework, quran);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Examiner packet - ${esc(packet.examiner.full_name)}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17231e}h1{color:#176b4e;font-size:22px;margin:0 0 6px}h2{color:#176b4e;font-size:16px;margin:18px 0 7px}.subtitle{margin:0 0 10px;color:#52645b}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8px;margin:0 0 8px}th,td{border:1px solid #82988c;padding:3px;text-align:center;height:22px;word-break:break-word}th{background:#e8f3ed}th:nth-child(2),td:nth-child(2){width:145px;text-align:left}.group-row th{background:#cfe5d7;font-size:10px}.questions{font-size:10px;line-height:1.45;margin:4px 0 10px}.questions ol{columns:2;margin:4px 0;padding-left:22px}.page-two{page-break-before:always}.homework-table{font-size:9px}.homework-table th:nth-child(2),.homework-table td:nth-child(2){width:180px}</style></head><body><h1>Hisnul Muslim · Examiner: ${esc(packet.examiner.full_name)}</h1><p class="subtitle">20 questions · Level 1: questions 1–10 · Level 2: questions 11–20 · Total /20</p><table><thead><tr class="group-row"><th colspan="2"></th><th colspan="10">1ኛ ደረጃ</th><th colspan="10">2ኛ ደረጃ</th><th>Total /20</th></tr><tr><th>No.</th><th>Student</th>${headers}<th>Total</th></tr></thead><tbody>${rows}</tbody></table><section class="page-two"><h1>Homework · Examiner: ${esc(packet.examiner.full_name)}</h1><p class="subtitle">Alif students and Qur’an students use their own question list · Total /5</p>${homework}</section></body></html>`;
  }

  function printPacket(packet: Packet) {
    const printWindow = window.open("", "assistant-packet", "width=1200,height=800");
    if (!printWindow) { setMessage("Allow pop-ups to print the packet."); return; }
    printWindow.document.write(packetHtml(packet)); printWindow.document.close(); printWindow.focus(); printWindow.onload = () => printWindow.print();
  }

  function downloadWord(packet: Packet) {
    const blob = new Blob([packetHtml(packet)], { type: "application/msword" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `examiner-packet-${packet.examiner.full_name.replace(/[^a-z0-9]+/gi, "-")}.doc`; link.click(); URL.revokeObjectURL(url);
  }

  return <AdminShell active="packets"><header className="workspace-header"><div><p className="eyebrow">EXAM ADMIN · PHASE 3</p><h1>Assistant examiner packets</h1><p>Prepare one Hisnul Muslim and Homework mark-entry packet for each Examiner.</p></div></header>{message && <p className="admin-message">{message}</p>}<section className="review-list">{packets.map((packet) => <article className="admin-card review-student" key={packet.examiner.id}><div><h2>{packet.examiner.full_name}</h2><small>{packet.students.length} assigned student(s) · 20 Hisnul questions · Homework /5</small></div><div className="account-actions"><button className="primary-button" type="button" onClick={() => printPacket(packet)}>Print / Save PDF</button><button className="secondary-button" type="button" onClick={() => downloadWord(packet)}>Download Word</button></div></article>)}</section></AdminShell>;
}
