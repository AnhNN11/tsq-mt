import {
  assessmentOf,
  ethnicitySummary,
  genderSummary,
  lessonStats,
  LEVELS,
  type Lesson,
  type SchoolClass,
  type Student,
  type TalentTag,
} from "./model";
export type ReportData = {
  students: Student[];
  classes: SchoolClass[];
  lessons: Lesson[];
  subject: string;
  period?: string;
  studentScope?: string;
  teacherName?: string;
  schoolYear?: string;
  chartImages?: string[];
  talentTags?: TalentTag[];
};
export function reportSummary(data: ReportData) {
  const stats = lessonStats(data.lessons);
  return {
    ...stats,
    students: data.students.length,
    assessed: data.students.filter((s) => assessmentOf(s, data.subject).after)
      .length,
    talents: data.students.filter(
      (s) => s.talents?.length || s.talentTagIds?.length,
    ).length,
    ethnicities: ethnicitySummary(data.students),
    genders: genderSummary(data.students),
    levels: [...LEVELS, "Chưa đánh giá"].map((name) => ({
      name,
      count: data.students.filter(
        (s) =>
          (assessmentOf(s, data.subject).after || "Chưa đánh giá") === name,
      ).length,
    })),
  };
}
export async function chartImages(selector = ".report-charts") {
  await document.fonts.ready;
  return Promise.all(
    Array.from(
      document.querySelectorAll<SVGSVGElement>(
        `${selector} .recharts-wrapper > svg.recharts-surface`,
      ),
    )
      .slice(0, 2)
      .map(async (svg) => {
        const { width, height } = svg.getBoundingClientRect();
        const copy = svg.cloneNode(true) as SVGSVGElement;
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.setAttribute("width", String(width));
        copy.setAttribute("height", String(height));
        copy.style.fontFamily = '"Times New Roman", Times, serif';
        copy.querySelectorAll("text").forEach((text) => {
          text.style.fontFamily = '"Times New Roman", Times, serif';
          text.style.fontSize = `${Math.max(19, ((width / 460) * 14 * 96) / 72)}px`;
        });
        copy.style.background = "white";
        const source = URL.createObjectURL(
          new Blob([new XMLSerializer().serializeToString(copy)], {
            type: "image/svg+xml;charset=utf-8",
          }),
        );
        try {
          const image = new Image();
          image.src = source;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(width * 2);
          canvas.height = Math.ceil(height * 2);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Không tạo được ảnh biểu đồ.");
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL("image/png");
        } finally {
          URL.revokeObjectURL(source);
        }
      }),
  );
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
