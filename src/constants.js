/* ==========================================================================
   START SECTION: Application Constants
   ========================================================================== */

import { getEditorProvisioningAuth } from "./firebase";

/* --- START SUBSECTION: User Role Definitions --- */
export const ALL_EDITOR_ROLES = [
  "super_admin",
  "admin",
  "editor_full",
  "editor_malazem",
  "editor_taasees",
  "editor_news",
];
/* --- END SUBSECTION: User Role Definitions --- */

export function normalizeUserRole(role) {
  const normalized = (role || "").trim();
  switch (normalized) {
    case "super_admin":
    case "admin":
      return "super_admin";
    case "editor_full":
    case "all":
      return "editor_full";
    case "editor_malazem":
    case "editor_materials":
    case "editor_study":
    case "notes":
      return "editor_malazem";
    case "editor_taasees":
    case "editor_tasiss":
    case "foundation":
      return "editor_taasees";
    case "editor_news":
    case "content":
      return "editor_news";
    case "custom":
      return "custom";
    default:
      return normalized || "user";
  }
}

export function normalizeUsername(s) {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\s\u00A0]+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalizeGrade(grade) {
  if (!grade || typeof grade !== "string") return grade || "";
  const normalized = grade.trim().replace(/\s+/g, " ");
  if (normalized === "ثاني عشر" || normalized === "ثاني عشر (توجيهي)" || normalized.includes("ثاني عشر")) {
    return "ثاني عشر (توجيهي)";
  }
  return normalized;
}

export function canonicalizeBranch(branch) {
  if (!branch || typeof branch !== "string") return branch || "";
  const normalized = branch.trim().replace(/\s+/g, " ");
  if (normalized === "ادبي" || normalized === "أدبي") return "أدبي";
  return normalized;
}

export function normalizeSubjectList(subjects) {
  if (!Array.isArray(subjects)) return [];
  return subjects.map(item => {
    if (typeof item === "string") return { name: item, active: true };
    return {
      name: String(item?.name || "").trim(),
      active: item?.active !== false,
    };
  });
}

export function getSubjectNames(subjects, includeHidden = false) {
  return normalizeSubjectList(subjects)
    .filter(item => includeHidden || item.active)
    .map(item => item.name)
    .filter(Boolean);
}

export function normalizeSubjectsMap(subjectsMap) {
  const normalized = {};
  for (const [key, subjects] of Object.entries(subjectsMap || {})) {
    normalized[key] = normalizeSubjectList(subjects);
  }
  return normalized;
}

export function getCanonicalSubjectKey(grade = "", branch = "") {
  return `${canonicalizeGrade(grade)}_${canonicalizeBranch(branch)}`;
}

export function findMatchingSubjectEntries(subjectsMap = {}, gradeBranchKey = "") {
  if (!subjectsMap || !gradeBranchKey) return [];
  if (subjectsMap[gradeBranchKey]) return subjectsMap[gradeBranchKey];

  const [grade = "", branch = ""] = gradeBranchKey.split("_");
  const targetGrade = canonicalizeGrade(grade);
  const targetBranch = canonicalizeBranch(branch);

  for (const key of Object.keys(subjectsMap)) {
    const [kGrade = "", kBranch = ""] = key.split("_");
    if (canonicalizeGrade(kGrade) === targetGrade && canonicalizeBranch(kBranch) === targetBranch) {
      return subjectsMap[key];
    }
  }

  return [];
}

export function getSubjectsByGradeBranch(subjectsMap = {}, grade = "", branch = "", includeHidden = false) {
  return getSubjectNames(findMatchingSubjectEntries(subjectsMap, getCanonicalSubjectKey(grade, branch)), includeHidden);
}

export { getEditorProvisioningAuth };

/* ==========================================================================
   END SECTION: Application Constants
   ========================================================================== */
