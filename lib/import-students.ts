import {
  newStudent,
  normalize,
  normalizeClass,
  studentKey,
  type Student,
} from "./model";

export type ImportedStudent = Partial<
  Omit<Student, "assessments" | "talents" | "talentTagIds">
> &
  Pick<Student, "name" | "className">;
export type ImportRow = {
  index: number;
  student: ImportedStudent;
  status: "new" | "update" | "duplicate" | "invalid";
  reason: string;
};

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const line = source.split(/\r?\n/, 1)[0];
  const delimiter = [",", ";", "\t"].sort(
    (a, b) => line.split(b).length - line.split(a).length,
  )[0];
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell.length === 0) quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("File CSV có dấu ngoặc kép chưa đóng.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const aliases: Record<string, keyof ImportedStudent> = {
  "ho va ten": "name",
  "ho ten": "name",
  name: "name",
  lop: "className",
  classname: "className",
  phong: "room",
  room: "room",
  day: "block",
  "day nha": "block",
  block: "block",
  "gioi tinh": "gender",
  "ngay sinh": "birthDate",
  "nam sinh": "birthDate",
  "dan toc": "ethnicity",
  "dan toc ton giao": "ethnicity",
  "noi o hien nay": "address",
  "noi o": "address",
  "dia chi": "address",
  "hoan canh gia dinh": "family",
  family: "family",
  "phu huynh lien he": "parents",
  "ho va ten cha ho va ten me sdt": "parents",
  "ho va ten cha ho va ten me sdt lien he": "parents",
  "kqgd pcnl": "priorEducation",
  "ket qua giao duc pham chat nguon": "priorEducation",
  "so truong suc khoe": "strengths",
  "so truong suc khoe nguon": "strengths",
  "tinh cach": "personality",
  "ghi chu": "notes",
};
function headerKey(text: string) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "")
    .trim();
}
const compactAliases = Object.fromEntries(
  Object.entries(aliases).map(([key, value]) => [headerKey(key), value]),
);

export function rowsToStudents(
  rows: string[][],
  fallbackClass: string,
  source: string,
  existing: Student[] = [],
): ImportedStudent[] {
  const result: ImportedStudent[] = [];
  let headers: (keyof ImportedStudent | undefined)[] = [];
  let numbered = false;
  let c2Format = false;
  let currentClass = normalizeClass(fallbackClass);
  for (const row of rows) {
    if (row.every((c) => !c.trim())) continue;
    if (row.some((c) => /danh sach lop truong/.test(normalize(c)))) break;
    const heading = row.find((c) => /^l[oớ]p\s*\d+[./]\d+/i.test(c.trim()));
    if (heading) {
      const match = heading.match(/\d+[./]\d+/);
      if (match) currentClass = normalizeClass(match[0]);
      continue;
    }
    const mapped = row.map((c) => compactAliases[headerKey(c)]);
    if (mapped.includes("name")) {
      c2Format = row.some((c) => headerKey(c) === "thongtingiadinh");
      headers =
        c2Format ||
        mapped.some(
          (k) =>
            k === "className" ||
            k === "gender" ||
            k === "room" ||
            k === "block" ||
            k === "family",
        )
          ? mapped
          : [];
      numbered = /^(tt|stt)$/.test(headerKey(row[0]));
      continue;
    }
    if (!headers.includes("name")) continue;
    if (c2Format) {
      // C2 combines grades/classes and includes staff. Only enrich an unambiguous existing pupil.
      const birthDate = row[1]?.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0];
      if (!birthDate || row.length !== 8) continue;
      const name = row[1].replace(birthDate, "").trim();
      const matches = existing.filter(
        (s) => studentKey({ name, className: s.className }) === studentKey(s),
      );
      if (matches.length !== 1) continue;
      const lines = row[7]
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const parent = (l: string) => /^(cha:|me:|sdt)/.test(normalize(l));
      const strength = (l: string) =>
        /^(so thich:|di ung|bi di ung|ho tro)/.test(normalize(l));
      result.push({
        name: matches[0].name,
        className: matches[0].className,
        birthDate,
        ethnicity: row[5].trim(),
        address: row[6].trim(),
        priorEducation: row[4].trim(),
        parents: lines.filter(parent).join("\n"),
        family: lines.filter((l) => !parent(l) && !strength(l)).join("\n"),
        strengths: lines.filter(strength).join("\n"),
        source,
      });
      continue;
    }
    if (numbered && !/^\d+$/.test(row[0]?.trim())) continue;
    const student: ImportedStudent = {
      name: "",
      className: currentClass,
      source,
    };
    row.forEach((cell, i) => {
      const key = headers[i];
      if (key) student[key] = cell.trim();
    });
    student.className = normalizeClass(student.className || currentClass);
    if (!student.name && row.every((c) => !c.trim() || /^\d+$/.test(c.trim())))
      continue;
    result.push(student);
    if (result.length > 10000)
      throw new Error("Chỉ hỗ trợ tối đa 10.000 dòng học sinh mỗi lần import.");
  }
  return result;
}

export async function readStudentFile(
  file: File,
  fallbackClass: string,
  existing: Student[] = [],
): Promise<ImportedStudent[]> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Vui lòng chọn file nhỏ hơn 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: string[][];
  if (extension === "docx") {
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(await file.arrayBuffer());
    const content = await archive.file("word/document.xml")?.async("string");
    if (!content || content.length > 10_000_000)
      throw new Error("File Word không hợp lệ hoặc quá lớn.");
    const doc = new DOMParser().parseFromString(content, "application/xml");
    if (doc.querySelector("parsererror"))
      throw new Error("Không đọc được cấu trúc file Word.");
    const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const text = (el: Element): string => {
      if (el.namespaceURI === ns && el.localName === "t")
        return el.textContent ?? "";
      if (el.namespaceURI === ns && ["br", "cr"].includes(el.localName))
        return "\n";
      if (el.namespaceURI === ns && el.localName === "tab") return "\t";
      return Array.from(el.children).map(text).join("");
    };
    rows = [];
    const body = doc.getElementsByTagNameNS(ns, "body")[0];
    for (const child of Array.from(body?.children ?? [])) {
      if (child.localName === "p") {
        const heading = text(child);
        if (/danh sach lop truong/.test(normalize(heading))) break;
        // Footnotes can mention another class; only actual paragraph headings set scope.
        const match = normalize(heading).match(
          /^(?:danh sach hoc sinh\s+)?lop\s*(\d+[./]\d+)/,
        );
        if (match) rows.push([`Lớp ${match[1]}`]);
      } else if (child.localName === "tbl") {
        rows.push(
          ...Array.from(child.getElementsByTagNameNS(ns, "tr"))
            .map((tr) =>
              Array.from(tr.children)
                .filter((c) => c.localName === "tc")
                .map((tc) =>
                  Array.from(tc.children)
                    .filter((p) => p.localName === "p")
                    .map(text)
                    .join("\n"),
                ),
            )
            .filter((r) => r.length > 1),
        );
      }
    }
  } else if (extension === "xlsx") {
    const { default: readXlsx } = await import("read-excel-file/browser");
    const sheets = await readXlsx(file);
    rows = sheets[0].data.map((row) =>
      row.map((cell) =>
        cell instanceof Date
          ? cell.toLocaleDateString("vi-VN", { timeZone: "UTC" })
          : String(cell ?? ""),
      ),
    );
  } else if (extension === "csv") rows = parseCsv(await file.text());
  else
    throw new Error(
      "Định dạng chưa hỗ trợ. Vui lòng chọn .docx, .xlsx hoặc .csv.",
    );
  const students = rowsToStudents(rows, fallbackClass, file.name, existing);
  if (!students.length)
    throw new Error(
      "Không tìm thấy bảng học sinh. File cần cột “Họ và tên” hoặc “Họ tên”.",
    );
  return students;
}

export function previewImport(
  incoming: ImportedStudent[],
  existing: Student[],
): ImportRow[] {
  const seen = new Set<string>();
  const keys = new Set(existing.map(studentKey));
  return incoming.map((student, index) => {
    const key = studentKey(student);
    let status: ImportRow["status"] = "new",
      reason = "Thêm học sinh mới";
    if (
      !student.name.trim() ||
      !/^\d{1,2}\/\d{1,2}$/.test(student.className) ||
      Object.values(student).some(
        (v) => typeof v !== "string" || v.length > 20000,
      )
    ) {
      status = "invalid";
      reason = "Thiếu họ tên, lớp không hợp lệ hoặc nội dung quá dài";
    } else if (seen.has(key)) {
      status = "duplicate";
      reason = "Trùng họ tên và lớp trong file";
    } else if (keys.has(key)) {
      status = "update";
      reason = "Bổ sung thông tin cho hồ sơ đã có";
    }
    if (status !== "invalid") seen.add(key);
    return { index: index + 1, student, status, reason };
  });
}

export function mergeStudents(
  existing: Student[],
  incoming: ImportedStudent[],
  overwrite: boolean,
) {
  const result = existing.map((s) => ({ ...s }));
  const preview = previewImport(incoming, existing);
  for (const row of preview) {
    if (row.status === "invalid" || row.status === "duplicate") continue;
    const target = result.find(
      (s) => studentKey(s) === studentKey(row.student),
    );
    if (!target) result.push({ ...newStudent(), ...row.student });
    else {
      for (const [key, value] of Object.entries(row.student)) {
        if (
          key === "name" ||
          key === "className" ||
          key === "id" ||
          key === "source" ||
          !value.trim()
        )
          continue;
        const field = key as keyof Omit<
          Student,
          "assessments" | "talents" | "talentTagIds"
        >;
        if (overwrite || !target[field]) target[field] = value;
      }
      if (row.student.source && !target.source.includes(row.student.source))
        target.source += `; ${row.student.source}`;
    }
  }
  return result;
}
