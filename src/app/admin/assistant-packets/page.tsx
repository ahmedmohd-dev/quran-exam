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

  function packetHtml(packet: Packet) {
    const compactPacket = packet.students.length > 18;
    const packetStyle = `style="--score-row-height:${compactPacket ? "6.5mm" : "10mm"};--homework-row-height:${compactPacket ? "7mm" : "12mm"};--questions-padding:${compactPacket ? "8mm" : "15mm"}"`;
    const headers = hisnulQuestions.map((_, index) => `<th>${index + 1}</th>`).join("");
    const hisnulColumns = `<col class="number-column"><col class="student-column">${hisnulQuestions.map(() => '<col class="question-column">').join("")}<col class="total-column">`;
    const rows = packet.students.map((student, index) => `<tr><td>${index + 1}</td><td>${esc(studentName(student))}</td>${hisnulQuestions.map(() => "<td></td>").join("")}<td></td></tr>`).join("");
    const homeworkHeaders = [1, 2, 3, 4, 5].map((question) => `<th>${question}</th>`).join("");
    const homeworkRows = packet.students.map((student, index) => `<tr><td>${index + 1}</td><td>${esc(studentName(student))}</td>${[1, 2, 3, 4, 5].map(() => "<td></td>").join("")}<td></td></tr>`).join("");
    const questionRows = (questions: string[]) => questions.map((question, index) => `<tr><th>${index + 1}</th><td>${esc(question)}</td></tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title></title><style>@page{size:A4 portrait;margin:13mm 12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}.packet-page{min-height:270mm;display:flex;flex-direction:column}.page-two{page-break-before:always}.packet-meta{display:flex;justify-content:space-between;align-items:center;font-size:9pt;margin:0 0 7mm}.brand{font-family:serif;font-size:19pt;font-weight:700;color:#174e4c;text-align:center;text-decoration:underline;margin:0 0 8px}.packet-title{font-size:15pt;font-weight:700;text-align:center;margin:0 0 16px}.score-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7pt}.score-table th,.score-table td{border:1px solid #789589;text-align:center;padding:2px}.score-table tbody td{height:var(--score-row-height)}.score-table thead th{background:#e8f2ed;font-size:8pt}.score-table .level-row th{background:#d4e8da;font-size:9pt;height:8mm}.number-column{width:7mm}.student-column{width:42mm}.question-column{width:6.25mm}.total-column{width:12mm}.score-table th:nth-child(2),.score-table td:nth-child(2){text-align:left;padding-left:4px}.questions-panel{width:72%;margin-top:auto;padding-top:var(--questions-padding)}.question-table{width:100%;border-collapse:collapse;font-size:7pt}.question-table th,.question-table td{border:1px solid #111;padding:2px;line-height:1.15}.question-table th:first-child{width:8mm;text-align:center}.question-table td{text-align:left}.question-table .question-level{font-size:9pt;text-align:center}.homework-page .packet-title{margin-bottom:20mm}.homework-page .score-table{width:72%;margin-left:1mm;font-size:9pt}.homework-page .score-table tbody td{height:var(--homework-row-height)}.homework-page .score-table th:nth-child(2),.homework-page .score-table td:nth-child(2){width:58%;font-size:9pt}.homework-page .score-table th:last-child,.homework-page .score-table td:last-child{width:18mm}.homework-questions{display:flex;gap:12mm;width:78%;margin:18mm auto 0}.homework-questions table{width:50%;border-collapse:collapse;font-size:8pt}.homework-questions th,.homework-questions td{border:1px solid #111;padding:2px}.homework-questions th:first-child{width:8mm}.homework-questions .question-level{text-align:center;font-size:9pt}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><section class="packet-page" ${packetStyle}><div class="packet-meta"><span>የአጋዥ ፈታኝ ስም = _____________________</span><span>የዋና ፈታኝ ስም፡ ${esc(packet.examiner.full_name)}</span></div><h1 class="brand">مركز علي الحيدر</h1><h2 class="packet-title">የሂስኑል ሙስሊም ፈተና ወጤት መመዝገቢያ</h2><table class="score-table"><colgroup>${hisnulColumns}</colgroup><thead><tr class="level-row"><th colspan="2"></th><th colspan="10">1ኛ ደረጃ</th><th colspan="10">2ኛ ደረጃ</th><th></th></tr><tr><th></th><th>የተማሪ ስም</th>${headers}<th>ድምር</th></tr></thead><tbody>${rows}</tbody></table><div class="questions-panel"><table class="question-table"><thead><tr><th colspan="2" class="question-level">1ኛ ደረጃ</th><th colspan="2" class="question-level">2ኛ ደረጃ</th></tr></thead><tbody>${hisnulQuestions.slice(0, 10).map((question, index) => `<tr><th>${index + 1}</th><td>${esc(question)}</td><th>${index + 11}</th><td>${esc(hisnulQuestions[index + 10])}</td></tr>`).join("")}</tbody></table></div></section><section class="packet-page page-two homework-page" ${packetStyle}><div class="packet-meta"><span>የአጋዥ ፈታኝ ስም = _____________________</span><span>የዋና ፈታኝ ስም፡ ${esc(packet.examiner.full_name)}</span></div><h1 class="packet-title">የየቤት ስራ ፈተና ወጤት መመዝገቢያ</h1><table class="score-table"><thead><tr><th></th><th>የተማሪ ስም</th>${homeworkHeaders}<th>ድምር ከ5</th></tr></thead><tbody>${homeworkRows}</tbody></table><div class="homework-questions"><table><thead><tr><th colspan="2" class="question-level">አሊፍ ላይ ላሉ</th></tr></thead><tbody>${questionRows(alifHomework)}</tbody></table><table><thead><tr><th colspan="2" class="question-level">ቁርአን ላይ ላሉ</th></tr></thead><tbody>${questionRows(quranHomework)}</tbody></table></div></section></body></html>`;
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
