export type Level = "KB" | "TK" | "SD" | "SMP" | "SMA";
export const LEVELS: Level[] = ["KB", "TK", "SD", "SMP", "SMA"];
export const SECTIONS = ["1", "2", "3"] as const;
export const MAJORS = ["Sains Murni", "Sosial Murni", "Terapan", "Formal"] as const;

export const GRADES: Record<Level, string[]> = {
  KB: [],
  TK: ["1", "2"],
  SD: ["1", "2", "3", "4", "5", "6"],
  SMP: ["7", "8", "9"],
  SMA: ["10", "11", "12"],
};

export type ClassValue = { level: Level | ""; grade: string; section: string; major: string };

export const EMPTY_CLASS: ClassValue = { level: "", grade: "", section: "", major: "" };

export function needsMajor(v: ClassValue) {
  return v.level === "SMA" && (v.grade === "11" || v.grade === "12");
}

export function isClassComplete(v: ClassValue) {
  if (!v.level) return false;
  if (v.level === "KB") return true;
  if (!v.grade || !v.section) return false;
  if (needsMajor(v) && !v.major) return false;
  return true;
}

/** Canonical stored string, e.g. "KB", "TK 1.2", "SD 3.1", "SMA 11.3 Sains Murni". */
export function serializeClass(v: ClassValue): string {
  if (!v.level) return "";
  if (v.level === "KB") return "KB";
  const base = `${v.level} ${v.grade}.${v.section}`;
  return needsMajor(v) && v.major ? `${base} ${v.major}` : base;
}

export function parseClass(s: string): ClassValue {
  const str = (s ?? "").trim();
  if (!str) return EMPTY_CLASS;
  if (str === "KB") return { level: "KB", grade: "", section: "", major: "" };
  const m = /^(TK|SD|SMP|SMA)\s+(\d{1,2})\.(\d)(?:\s+(.+))?$/.exec(str);
  if (!m) return EMPTY_CLASS;
  const level = m[1] as Level;
  const grade = m[2]!;
  const section = m[3]!;
  const major = m[4] ?? "";
  if (!GRADES[level].includes(grade) || !(SECTIONS as readonly string[]).includes(section)) return EMPTY_CLASS;
  return { level, grade, section, major: (MAJORS as readonly string[]).includes(major) ? major : "" };
}

export const LEVEL_LABEL: Record<"id" | "en", Record<Level, string>> = {
  id: { KB: "Kelompok Bermain", TK: "TK", SD: "SD", SMP: "SMP", SMA: "SMA" },
  en: { KB: "Playgroup", TK: "Kindergarten", SD: "Elementary", SMP: "Junior High", SMA: "Senior High" },
};

/** Human label from stored string, localized. */
export function formatClass(s: string, lang: "id" | "en"): string {
  const v = parseClass(s);
  if (!v.level) return s;
  const lvl = LEVEL_LABEL[lang][v.level];
  if (v.level === "KB") return lvl;
  return `${lvl} ${v.grade}.${v.section}${v.major ? " · " + v.major : ""}`;
}
