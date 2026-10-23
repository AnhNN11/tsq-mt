"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  assessmentOf,
  ethnicitySummary,
  LEVELS,
  TALENT_CATEGORIES,
  type Student,
  type TalentTag,
} from "@/lib/model";

export default function DashboardCharts({
  students,
  subject,
  compact = false,
  talentTags = [],
}: {
  students: Student[];
  subject: string;
  compact?: boolean;
  talentTags?: TalentTag[];
}) {
  const ethnicities = ethnicitySummary(students)
    .slice(0, 6)
    .map((g) => ({ name: g.ethnicity, "Học sinh": g.count }));
  const levels = [...LEVELS, "Chưa đánh giá"].map((name) => ({
    name,
    "Học sinh": students.filter(
      (s) => (assessmentOf(s, subject).after || "Chưa đánh giá") === name,
    ).length,
  }));
  const talents = TALENT_CATEGORIES.map((name) => ({
    name,
    "Học sinh": students.filter(
      (s) =>
        s.talents?.some((t) => t.category === name) ||
        talentTags.some(
          (t) => t.category === name && s.talentTagIds?.includes(t.id),
        ),
    ).length,
  }));
  return (
    <div className={`charts-grid ${compact ? "charts-compact" : ""}`}>
      <section className="chart-card">
        <div className="chart-heading">
          <h2>Học lực môn {subject}</h2>
          <span>{students.length} học sinh</span>
        </div>
        <BarChart
          responsive
          style={{ width: "100%", height: 255 }}
          data={levels}
          layout={compact ? "vertical" : "horizontal"}
          margin={{ left: 0, right: 12, bottom: 12 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="#e7ece5" />
          <XAxis
            dataKey={compact ? undefined : "name"}
            type={compact ? "number" : "category"}
            allowDecimals={false}
            interval={0}
            tick={{
              fontSize: compact ? 19 : 10,
              fontFamily: compact ? "Times New Roman" : undefined,
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            type={compact ? "category" : "number"}
            dataKey={compact ? "name" : undefined}
            width={compact ? 155 : 35}
            tick={{
              fontSize: compact ? 19 : 11,
              fontFamily: compact ? "Times New Roman" : undefined,
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Bar
            dataKey="Học sinh"
            fill="#315b35"
            radius={[5, 5, 0, 0]}
            maxBarSize={46}
            isAnimationActive={false}
          />
        </BarChart>
        <p>Giữ “Chưa đánh giá” riêng để tránh hiểu nhầm là học lực thấp.</p>
      </section>
      <section className="chart-card">
        <div className="chart-heading">
          <h2>{compact ? "Phát triển năng khiếu" : "Phân bố dân tộc"}</h2>
          <span>
            {compact ? "Số học sinh theo lĩnh vực" : "6 nhóm đông nhất"}
          </span>
        </div>
        <BarChart
          responsive
          style={{ width: "100%", height: 255 }}
          data={compact ? talents : ethnicities}
          layout="vertical"
          margin={{ left: 0, right: 25 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke="#e7ece5" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{
              fontSize: compact ? 19 : 10,
              fontFamily: compact ? "Times New Roman" : undefined,
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="name"
            type="category"
            interval={0}
            width={compact ? 135 : 85}
            tick={{
              fontSize: compact ? 19 : 11,
              fontFamily: compact ? "Times New Roman" : undefined,
            }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip />
          <Legend
            wrapperStyle={{
              fontSize: compact ? 19 : 11,
              fontFamily: compact ? "Times New Roman" : undefined,
            }}
          />
          <Bar
            dataKey="Học sinh"
            name={compact ? "Có thẻ hoặc đánh giá" : "Học sinh"}
            fill={compact ? "#b63b3b" : "#8b9d66"}
            radius={[0, 5, 5, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
        <p>
          {compact
            ? "Một học sinh có thể được ghi nhận ở nhiều lĩnh vực."
            : "Xem bảng dân tộc để tra cứu đầy đủ và mở danh sách từng nhóm."}
        </p>
      </section>
    </div>
  );
}
