"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import logo from "../../assets/logo.jpg";
import { createClient } from "@/lib/supabase/client";
import { surahs } from "@/lib/surahs";
import { alifFesels } from "@/lib/alif-fesels";

type Role = "admin" | "ustaz" | "examiner" | "director";
type Student = {
  id: string;
  registrationId?: string;
  name: string;
  age: number;
  ustaz: string;
  level: "Alif" | "Qur'an";
  learningPlace: string;
  studyYears: number;
  studyMonths: number;
};

type RegistrationPeriod = {
  status: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  registration_override: "automatic" | "force_open" | "force_closed";
};

function registrationIsOpen(period: RegistrationPeriod) {
  if (period.registration_override === "force_open") return true;
  if (period.registration_override === "force_closed") return false;
  const now = new Date();
  if (!period.registration_opens_at && !period.registration_closes_at)
    return period.status === "registration_open";
  return (
    (!period.registration_opens_at ||
      new Date(period.registration_opens_at) <= now) &&
    (!period.registration_closes_at ||
      new Date(period.registration_closes_at) > now)
  );
}

export default function Home() {
  const [students, setStudents] = useState<Student[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("አስታዝ");
  const [learningLevel, setLearningLevel] = useState<"Alif" | "Qur'an">(
    "Qur'an"
  );
  const [placeNumber, setPlaceNumber] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) return;

      const userRole = profile.role as Role;
      setRole(userRole);
      setDisplayName(profile.full_name);
      const { data: activePeriod } = await supabase
        .from("exam_periods")
        .select(
          "id, status, registration_opens_at, registration_closes_at, registration_override"
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!activePeriod) {
        setNotice("የተከፈተ የምዝገባ ወቅት የለም።");
        return;
      }

      setActivePeriodId(activePeriod.id);
      setRegistrationOpen(
        registrationIsOpen(activePeriod as RegistrationPeriod)
      );
      let registrationQuery = supabase
        .from("student_registrations")
        .select(
          "id, registered_age, current_learning_level, current_learning_place, study_years, study_months, student:students(student_number, full_name), ustaz:profiles!student_registrations_ustaz_id_fkey(full_name)"
        )
        .eq("exam_period_id", activePeriod.id)
        .order("created_at", { ascending: false });
      if (userRole !== "admin")
        registrationQuery = registrationQuery.eq("ustaz_id", user.id);
      const { data: registrations, error } = await registrationQuery;
      if (error) throw error;
      setStudents(
        (registrations ?? []).map((registration) => {
          const student = registration.student as unknown as {
            student_number: string;
            full_name: string;
          };
          const ustaz = registration.ustaz as unknown as {
            full_name: string;
          } | null;
          return {
            id: student.student_number,
            registrationId: registration.id,
            name: student.full_name,
            age: registration.registered_age ?? 0,
            ustaz: ustaz?.full_name ?? "",
            level:
              registration.current_learning_level === "alif"
                ? "Alif"
                : "Qur'an",
            learningPlace: registration.current_learning_place ?? "",
            studyYears: registration.study_years ?? 0,
            studyMonths: registration.study_months ?? 0,
          };
        })
      );
    }
    loadDashboard().catch(() => setNotice("መረጃውን ማምጣት አልተሳካም። ግንኙነትዎን ያረጋግጡ።"));
  }, []);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) =>
        `${student.name} ${student.id}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [query, students]
  );

  function closeForm() {
    setShowForm(false);
    setEditingStudent(null);
    setLearningLevel("Qur'an");
    setPlaceNumber("");
  }

  function openAdd() {
    if (!registrationOpen) {
      setNotice("ምዝገባ አሁን ተዘግቷል።");
      return;
    }
    closeForm();
    setShowForm(true);
  }

  function openEdit(student: Student) {
    setEditingStudent(student);
    setLearningLevel(student.level);
    setPlaceNumber(student.learningPlace);
    setShowForm(true);
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const age = Number(form.get("age"));
    const learningPlace = String(form.get("learningPlace") ?? "");
    const studyYears = Number(form.get("studyYears") ?? 0);
    const studyMonths = Number(form.get("studyMonths") ?? 0);
    if (!name || !age || !learningPlace) return;

    const updatedStudent = {
      name,
      age,
      level: learningLevel,
      learningPlace,
      studyYears,
      studyMonths,
    };
    const supabase = createClient();
    if (editingStudent) {
      setStudents((current) =>
        current.map((student) =>
          student.id === editingStudent.id
            ? { ...student, ...updatedStudent }
            : student
        )
      );
      if (editingStudent.registrationId && navigator.onLine) {
        const { error } = await supabase.rpc("update_student_registration", {
          p_registration_id: editingStudent.registrationId,
          p_full_name: name,
          p_registered_age: age,
          p_current_learning_level: learningLevel === "Alif" ? "alif" : "quran",
          p_current_learning_place: learningPlace,
          p_study_years: studyYears,
          p_study_months: studyMonths,
        });
        setNotice(error ? "ማስተካከያው አልተቀመጠም።" : `${name} ተስተካክሏል።`);
      } else {
        setNotice("ማስተካከያው በዚህ ስልክ ላይ ተቀምጧል።");
      }
      closeForm();
      return;
    }

    if (!registrationOpen || !activePeriodId || !navigator.onLine) {
      setNotice("ለመመዝገብ የተከፈተ ወቅት እና ግንኙነት ያስፈልጋል።");
      return;
    }
    const { error } = await supabase.rpc("register_student", {
      p_exam_period_id: activePeriodId,
      p_full_name: name,
      p_registered_age: age,
      p_current_learning_level: learningLevel === "Alif" ? "alif" : "quran",
      p_current_learning_place: learningPlace,
      p_class_group: null,
      p_study_years: studyYears,
      p_study_months: studyMonths,
    });
    if (error) {
      setNotice("ምዝገባው አልተሳካም። መረጃውን እና ግንኙነትዎን ያረጋግጡ።");
      return;
    }
    setNotice(`${name} በተሳካ ሁኔታ ተመዝግቧል።`);
    closeForm();
    window.location.reload();
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`${student.name}ን ከዚህ የፈተና ምዝገባ ማስወገድ ይፈልጋሉ?`)) return;
    setStudents((current) => current.filter((item) => item.id !== student.id));
    if (!student.registrationId || !navigator.onLine) {
      setNotice("ተማሪው ከዝርዝሩ ተወግዷል።");
      return;
    }
    const { error } = await createClient().rpc("delete_student_registration", {
      p_registration_id: student.registrationId,
    });
    setNotice(error ? "መሰረዙ አልተሳካም።" : `${student.name} ከምዝገባው ተወግዷል።`);
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  const placementPreview =
    learningLevel === "Qur'an"
      ? placeNumber && surahs[Number(placeNumber) - 1]
        ? `${placeNumber} — ${surahs[Number(placeNumber) - 1]}`
        : "የሱራ ቁጥር ያስገቡ"
      : placeNumber
      ? `የቃዒዳ በግዳዲያ ፈስል ${placeNumber}`
      : "የፈስል ቁጥር ያስገቡ";

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMobileMenu ? "mobile-open" : ""}`}>
        <div className="brand">
          <Image
            src={logo}
            alt="مركز علي الحيدر logo"
            className="logo"
            priority
          />
          <span>مركز علي الحيدر</span>
        </div>
        <nav>
          <button
            className="nav-link active"
            type="button"
            onClick={() => {
              setShowMobileMenu(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            መመዝገቢያ
          </button>
          <button
            className="nav-link"
            type="button"
            onClick={() => window.location.assign("/students")}
          >
            የእኔ ተማሪዎች
          </button>
        </nav>
        <div className="profile-card">
          <strong>{displayName}</strong>
          <span>{role === "admin" ? "የፈተና አስተዳዳሪ" : "አስታዝ"}</span>
          {role === "admin" && <a href="/admin/users">Admin setup</a>}
          <button type="button" onClick={signOut}>
            ውጣ
          </button>
        </div>
      </aside>

      <section className="content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">አሁን ያለው ፈተና</p>
            <h1>የቁርአን ክለሳ ፈተና</h1>
            <p className="muted">3ኛ ሩብ ዓመት · 2018 ዓ.ም</p>
          </div>
          <button
            className="mobile-menu"
            type="button"
            aria-label="Open menu"
            onClick={() => setShowMobileMenu((open) => !open)}
          >
            ☰
          </button>
        </header>
        <section className="period-banner">
          <div>
            <span className="status-dot" />{" "}
            {registrationOpen
              ? "ምዝገባ ክፍት ነው (ምዝገባ ሰኞ ነሃሴ 4 ሰለሚዘጋ በጊዜ ያጠናቁ!)"
              : "ምዝገባ ተዘግቷል"}
          </div>
          <button onClick={openAdd} disabled={!registrationOpen}>
            + ተማሪ መዝግብ
          </button>
        </section>
        <section className="metrics">
          <article>
            <span>ጠቅላላ ተማሪዎች</span>
            <strong>{students.length}</strong>
            <small>በእርስዎ ስር ያሉ</small>
          </article>
          <article>
            <span>የቁርአን ተማሪዎች</span>
            <strong>
              {students.filter((student) => student.level === "Qur'an").length}
            </strong>
            <small>ሱራ እየተማሩ</small>
          </article>
          <article>
            <span>የአሊፍ ተማሪዎች</span>
            <strong>
              {students.filter((student) => student.level === "Alif").length}
            </strong>
            <small>ቃዒዳ እየተማሩ</small>
          </article>
        </section>
        <section className="panel" id="students">
          <div className="panel-heading">
            <div>
              <h2>የእኔ ተማሪዎች</h2>
              <p>የተመዘገቡ ተማሪዎችን ይመልከቱ፣ ያስተካክሉ ወይም ይሰርዙ።</p>
            </div>
            <button className="secondary-button" onClick={openAdd}>
              ተማሪ መዝግብ
            </button>
          </div>
          <div className="toolbar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="በስም ወይም በመለያ ፈልግ"
              aria-label="ተማሪዎችን ፈልግ"
            />
            <span>{filteredStudents.length} ተማሪዎች</span>
          </div>
          <div className="student-list">
            {filteredStudents.map((student) => (
              <article className="student-row" key={student.id}>
                <div className="avatar">{student.name.slice(0, 1)}</div>
                <div className="student-name">
                  <strong>{student.name}</strong>
                  <span>
                    {student.id} · ዕድሜ {student.age}
                  </span>
                  <em>
                    {student.level === "Qur'an"
                      ? `${student.learningPlace} — ${
                          surahs[Number(student.learningPlace) - 1] ?? ""
                        }`
                      : `ፈስል ${student.learningPlace}`}
                  </em>
                </div>
                <span
                  className={`tag ${
                    student.level === "Alif" ? "alif" : "quran"
                  }`}
                >
                  {student.level === "Alif" ? "አሊፍ" : "ቁርአን"}
                </span>
                <div className="row-actions">
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => openEdit(student)}
                  >
                    አስተካክል
                  </button>
                  <button
                    className="text-button delete-button"
                    type="button"
                    onClick={() => deleteStudent(student)}
                  >
                    ሰርዝ
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={saveStudent}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">የተማሪ ምዝገባ</p>
                <h2>{editingStudent ? "የተማሪ መረጃ ያስተካክሉ" : "ተማሪ ይመዝግቡ"}</h2>
              </div>
              <button type="button" className="close" onClick={closeForm}>
                ×
              </button>
            </div>
            <label>
              የተማሪ ሙሉ ስም
              <input
                name="name"
                required
                defaultValue={editingStudent?.name ?? ""}
                placeholder="ለምሳሌ፦ ኡመር መሐመድ"
              />
            </label>
            <p className="name-warning">የተማሪዎችን ስም ከአማርኛ ውጪ መጻፍ የተከለከለ ነው!!!</p>
            <div className="form-grid">
              <label>
                ዕድሜ
                <input
                  name="age"
                  required
                  type="number"
                  min="3"
                  max="30"
                  defaultValue={editingStudent?.age ?? ""}
                />
              </label>
              <label>
                በመድረሳ የቆየበት ጊዜ
                <div className="duration-inputs">
                  <input
                    name="studyYears"
                    required
                    type="number"
                    min="0"
                    max="30"
                    defaultValue={editingStudent?.studyYears ?? 0}
                  />
                  <span>ዓመት</span>
                  <input
                    name="studyMonths"
                    required
                    type="number"
                    min="0"
                    max="11"
                    defaultValue={editingStudent?.studyMonths ?? 0}
                  />
                  <span>ወር</span>
                </div>
              </label>
            </div>
            <label>
              አሁን ያለበት የትምህርት ደረጃ
              <select
                name="level"
                value={learningLevel}
                onChange={(event) => {
                  setLearningLevel(event.target.value as "Alif" | "Qur'an");
                  setPlaceNumber("");
                }}
              >
                <option value="Alif">አሊፍ</option>
                <option value="Qur'an">ቁርአን</option>
              </select>
            </label>
            <label>
              {learningLevel === "Qur'an"
                ? "የሱራ ቁጥር (1–114)"
                : "የቃዒዳ ፈስል ቁጥር (1–27)"}
              <input
                name="learningPlace"
                required
                type="number"
                min="1"
                max={learningLevel === "Qur'an" ? 114 : 27}
                value={placeNumber}
                onChange={(event) => setPlaceNumber(event.target.value)}
              />
            </label>
            <div className="place-preview">
              <span>የተመረጠው</span>
              <strong>
                {learningLevel === "Alif"
                  ? placeNumber
                    ? `${placeNumber} — ${
                        alifFesels[Number(placeNumber) - 1] ?? ""
                      }`
                    : "የፈስል ቁጥር ያስገቡ"
                  : placementPreview}
              </strong>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
              >
                ሰርዝ
              </button>
              <button type="submit">
                {editingStudent ? "ማስተካከያውን አስቀምጥ" : "ምዝገባን አስቀምጥ"}
              </button>
            </div>
          </form>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
