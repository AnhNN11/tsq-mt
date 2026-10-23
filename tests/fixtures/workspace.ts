import {
  DEFAULT_SETTINGS,
  DEFAULT_TALENT_TAGS,
  newStudent,
  type Workspace,
} from "../../lib/model";
import { DEFAULT_ACADEMIC_TAGS } from "../../lib/academic-tags";
// Entirely synthetic test fixtures. Production student records live only in Supabase.
export const INITIAL_DATA: Workspace = {
  version: 1,
  sourceVersion: 2,
  settings: structuredClone(DEFAULT_SETTINGS),
  classes: ["6/1", "6/2", "10/1", "10/2"].map((name) => ({
    id: `CLASS-${name}`,
    name,
    track: "Khối kiểm thử",
    note: "Dữ liệu giả lập",
  })),
  students: Array.from({ length: 160 }, (_, i) => ({
    ...newStudent(),
    id: i === 0 ? "HS001" : `TEST-${i}`,
    name:
      i === 119 || i === 159
        ? "Trùng tên cần kiểm tra"
        : `Học sinh giả lập ${i + 1}`,
    className: ["6/1", "6/2", "10/1", "10/2"][Math.floor(i / 40)],
    priorEducation: i < 156 ? "HT\nTốt" : "",
    ethnicity: i < 156 ? (i % 2 ? "Gia-rai\nKhông" : "Kinh\nKhông") : "",
    source: "Dữ liệu kiểm thử tổng hợp",
  })),
  pendingStudents: Array.from({ length: 5 }, (_, i) => ({
    ...newStudent(),
    id: `PENDING-${i}`,
    name: `Hồ sơ chờ ${i + 1}`,
    className: "",
    grade: "10",
  })),
  lessons: [],
  talentTags: structuredClone(DEFAULT_TALENT_TAGS),
  academicTags: structuredClone(DEFAULT_ACADEMIC_TAGS),
};
