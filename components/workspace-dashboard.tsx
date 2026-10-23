"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Alert,
  App,
  Avatar,
  Button,
  Collapse,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd";
import {
  BarChartOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  HomeOutlined,
  ImportOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  assessmentOf,
  ethnicityOf,
  ethnicitySummary,
  genderOf,
  genderSummary,
  isComplete,
  lessonStats,
  newStudent,
  normalize,
  type Lesson,
  type SchoolClass,
  type Student,
  type Workspace,
} from "@/lib/model";
import {
  migrateLegacyWorkspace,
  refreshWorkspace,
  saveWorkspace,
  useWorkspace,
} from "@/lib/store";
import { canManage, roleLabel } from "@/lib/access";
import { useUser } from "./auth-context";
import ClassTable from "./class-table";
import ClassEditor from "./class-editor";
import StudentEditor from "./student-editor";
import EvaluationTable from "./evaluation-table";
import TalentTable from "./talent-table";
import LessonEditor, { today } from "./lesson-editor";
import ImportModal from "./import-modal";
import ReportView from "./report-view";
import EthnicityTable from "./ethnicity-table";
import SourceReviewTable from "./source-review-table";
import DashboardCharts from "./dashboard-charts";
import AdminPanel from "./admin-panel";
import PendingEnrollment from "./pending-enrollment";
import { exportExcel } from "@/lib/excel-export";
import { academicLabel, academicTag } from "@/lib/academic-tags";
import StatusBadge from "./status-badge";
import { studentDataIssues } from "@/lib/data-quality";

type View =
  | "overview"
  | "students"
  | "assessments"
  | "talents"
  | "lessons"
  | "reports"
  | "settings";
const labels: Record<View, string> = {
  overview: "Tổng quan quản lý",
  students: "Quản lý lớp và học sinh",
  assessments: "Quản lý học lực",
  talents: "Quản lý năng khiếu",
  lessons: "Quản lý giảng dạy",
  reports: "Báo cáo và thống kê",
  settings: "Quản trị hệ thống",
};
export default function WorkspaceDashboard() {
  const router = useRouter();
  const user = useUser();
  const manage = canManage(user);
  const admin = user.role === "admin";
  const { data, loading, error, updatedAt, revision } = useWorkspace();
  const { message } = App.useApp();
  const [view, setView] = useState<View>("overview");
  const [mobile, setMobile] = useState(false);
  const [studentTab, setStudentTab] = useState("classes");
  const [className, setClassName] = useState("all");
  const [ethnicity, setEthnicity] = useState("all");
  const [gender, setGender] = useState("all");
  const [selectedSubject, setSubject] = useState(user.subjects[0] || "Tin học");
  const subjects = data.settings.subjects.filter(
    (s) => user.role !== "teacher" || user.subjects.includes(s),
  );
  const subject = subjects.includes(selectedSubject)
    ? selectedSubject
    : subjects[0] || "Tin học";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selection, setSelection] = useState<React.Key[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [editor, setEditor] = useState<{
    student: Student;
    isNew: boolean;
    initialTab?: string;
  } | null>(null);
  const [classEditor, setClassEditor] = useState<{
    schoolClass: SchoolClass;
    isNew: boolean;
  } | null>(null);
  const [lessonEditor, setLessonEditor] = useState<{
    lesson: Lesson;
    isNew: boolean;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const migrated = useRef(false);
  useEffect(() => {
    if (!loading && !error && admin && revision <= 1 && !migrated.current) {
      migrated.current = true;
      void migrateLegacyWorkspace().catch((e) => message.warning(e.message));
    }
  }, [loading, error, admin, revision, message]);
  const classStudents = data.students.filter(
    (s) => className === "all" || s.className === className,
  );
  const ethnicStudents = classStudents.filter(
    (s) => ethnicity === "all" || ethnicityOf(s) === ethnicity,
  );
  const students = ethnicStudents.filter(
    (s) => gender === "all" || genderOf(s) === gender,
  );
  const classes = data.classes.filter(
    (c) => className === "all" || c.name === className,
  );
  const lessons = data.lessons.filter(
    (l) =>
      l.subject === subject &&
      (className === "all" || l.className === className),
  );
  const stats = lessonStats(lessons);
  const assessed = students.filter(
    (s) => assessmentOf(s, subject).after,
  ).length;
  const filtered = students.filter(
    (s) =>
      normalize(`${s.name} ${s.id} ${s.address}`).includes(normalize(query)) &&
      (status === "all" ||
        (status === "missing" && !isComplete(s, subject)) ||
        (status === "support" &&
          assessmentOf(s, subject).after === "Cần hỗ trợ")),
  );
  const studentScope = [
    ethnicity === "all" ? "Tất cả dân tộc" : `Dân tộc ${ethnicity}`,
    gender === "all" ? "Tất cả giới tính" : gender,
  ].join(" · ");
  function navigate(next: View) {
    setView(next);
    setMobile(false);
  }
  function reset() {
    setQuery("");
    setStatus("all");
    setSelection([]);
  }
  function openClass(name: string) {
    setClassName(name);
    reset();
    setStudentTab("pupils");
    navigate("students");
  }
  function addStudent(name = className) {
    const s = newStudent();
    s.className = name === "all" ? data.classes[0]?.name || "10/1" : name;
    setEditor({ student: s, isNew: true });
  }
  async function commit(
    update: (current: Workspace) => Workspace,
    text: string,
  ) {
    try {
      await saveWorkspace(update);
      message.success(text);
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  async function exportXlsx(rows = students) {
    setExportBusy(true);
    try {
      await exportExcel({
        students: rows,
        talentTags: data.talentTags,
        academicTags: data.academicTags,
        classes,
        lessons,
        subject,
        studentScope,
        teacherName: user.name,
        schoolYear: data.settings.schoolYear,
      });
      message.success(`Đã xuất Excel ${rows.length} học sinh.`);
    } catch {
      message.error("Chưa xuất được Excel. Vui lòng thử lại.");
    } finally {
      setExportBusy(false);
    }
  }
  function addLesson() {
    if (className === "all") {
      message.info("Chọn một lớp trước khi ghi nhận tiết dạy.");
      return;
    }
    setLessonEditor({
      isNew: true,
      lesson: {
        id: crypto.randomUUID(),
        className,
        subject,
        title: "",
        date: today(),
        periods: 1,
        note: "",
      },
    });
  }
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      message.error("Chưa đăng xuất được. Vui lòng thử lại.");
    }
  }
  const nav = [
    { key: "overview", icon: <HomeOutlined aria-hidden /> },
    { key: "students", icon: <TeamOutlined aria-hidden /> },
    { key: "assessments", icon: <CheckCircleOutlined aria-hidden /> },
    { key: "talents", icon: <StarOutlined aria-hidden /> },
    { key: "lessons", icon: <BookOutlined aria-hidden /> },
    { key: "reports", icon: <BarChartOutlined aria-hidden /> },
    ...(admin
      ? [{ key: "settings", icon: <SettingOutlined aria-hidden /> }]
      : []),
  ];
  return (
    <div className="workspace refined-workspace">
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng menu"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar no-print ${mobile ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <Image
            className="school-logo"
            src="/school-logo.png"
            alt="Logo Phân hiệu 1 Trường Thiếu sinh quân miền Trung"
            width={46}
            height={46}
            priority
          />
          <span>
            Mầm Xanh<small>KHOA TIN HỌC & NGOẠI NGỮ</small>
          </span>
        </a>
        <div className="workspace-label">QUẢN LÝ HỌC SINH</div>
        <nav aria-label="Điều hướng chính">
          {nav.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? "active" : ""}`}
              aria-current={view === item.key ? "page" : undefined}
              onClick={() => navigate(item.key as View)}
            >
              {item.icon}
              <span>{labels[item.key as View]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="teacher-profile">
            <Avatar
              shape="square"
              style={{ background: "#e6eddf", color: "#315b35" }}
            >
              {user.name
                .split(" ")
                .slice(-2)
                .map((n) => n[0])
                .join("")}
            </Avatar>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabel(user.role)}</small>
            </div>
          </div>
          <button className="nav-item" onClick={() => void logout()}>
            <LogoutOutlined aria-hidden />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar no-print">
          <div className="breadcrumbs">
            <Button
              type="text"
              className="mobile-menu"
              icon={<MenuOutlined aria-hidden />}
              aria-label="Mở menu"
              onClick={() => setMobile(true)}
            />
            <span>Khoa Tin học và Ngoại ngữ</span>
            <span>/</span>
            <strong>{labels[view]}</strong>
          </div>
          <Space>
            <span className="school-year">{data.settings.schoolYear}</span>
            <Select
              aria-label="Môn học"
              value={subject}
              onChange={(value) => {
                setSubject(value);
                reset();
              }}
              options={subjects.map((s) => ({ value: s, label: `Môn ${s}` }))}
              style={{ minWidth: 135 }}
            />
            <Tooltip title="Tải dữ liệu mới nhất">
              <Button
                type="text"
                icon={<ReloadOutlined aria-hidden />}
                aria-label="Làm mới dữ liệu"
                onClick={() => void refreshWorkspace()}
              />
            </Tooltip>
          </Space>
        </header>
        <main
          className={`main-content ${view === "reports" ? "report-page" : ""}`}
        >
          <section className="page-heading no-print">
            <div>
              <span className="eyebrow">
                PHÂN HIỆU 1 · TRƯỜNG THIẾU SINH QUÂN MIỀN TRUNG
              </span>
              <h1>
                {labels[view]}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {view === "overview"
                  ? `${data.classes.length} lớp · ${data.students.length} hồ sơ học sinh · Một không gian quản lý chung`
                  : view === "assessments"
                    ? "Theo dõi học lực đầu vào, tiến bộ và tương tác theo môn học."
                    : view === "talents"
                      ? "Gắn thẻ năng khiếu và ghi nhận hướng bồi dưỡng cho từng học sinh."
                      : view === "reports"
                        ? "Chọn phạm vi, xem trước và xuất báo cáo để chia sẻ."
                        : view === "settings"
                          ? "Tài khoản, năm học và sao lưu dữ liệu dùng chung."
                          : view === "students"
                            ? "Quản lý lớp và hồ sơ trong cùng một bảng làm việc."
                            : "Ghi nhận bài học và số tiết đã dạy theo lớp, theo môn."}
              </p>
            </div>
            <Space wrap>
              {view === "students" && manage && (
                <>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: "class",
                          label: "Thêm lớp học",
                          icon: <PlusOutlined aria-hidden />,
                        },
                        {
                          key: "import",
                          label: "Import học sinh",
                          icon: <ImportOutlined aria-hidden />,
                        },
                      ],
                      onClick: ({ key }) =>
                        key === "import"
                          ? setImporting(true)
                          : setClassEditor({
                              isNew: true,
                              schoolClass: {
                                id: crypto.randomUUID(),
                                name: "",
                                track: "",
                                note: "",
                              },
                            }),
                    }}
                  >
                    <Button icon={<MoreOutlined aria-hidden />}>
                      Thao tác
                    </Button>
                  </Dropdown>
                  <Button
                    type="primary"
                    icon={<PlusOutlined aria-hidden />}
                    onClick={() => addStudent()}
                  >
                    Thêm học sinh
                  </Button>
                </>
              )}
              {view === "lessons" && (
                <Button
                  type="primary"
                  icon={<PlusOutlined aria-hidden />}
                  onClick={addLesson}
                >
                  Ghi nhận tiết dạy
                </Button>
              )}
            </Space>
          </section>
          {error && (
            <Alert
              type="error"
              showIcon
              title="Chưa tải được dữ liệu chung"
              description={error}
              action={
                <Button onClick={() => void refreshWorkspace()}>Thử lại</Button>
              }
            />
          )}
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <>
              {view !== "settings" && (
                <div className="scope-row no-print">
                  <Space wrap>
                    <Select
                      aria-label="Lớp học"
                      value={className}
                      onChange={(value) => {
                        setClassName(value);
                        setEthnicity("all");
                        reset();
                      }}
                      style={{ minWidth: 130 }}
                      options={[
                        { value: "all", label: "Tất cả lớp" },
                        ...data.classes.map((c) => ({
                          value: c.name,
                          label: `Lớp ${c.name}`,
                        })),
                      ]}
                    />
                    <Select
                      aria-label="Lọc dân tộc"
                      value={ethnicity}
                      onChange={(value) => {
                        setEthnicity(value);
                        reset();
                      }}
                      showSearch
                      optionFilterProp="label"
                      style={{ minWidth: 200 }}
                      options={[
                        {
                          value: "all",
                          label: `Tất cả dân tộc (${classStudents.length})`,
                        },
                        ...ethnicitySummary(classStudents).map((g) => ({
                          value: g.ethnicity,
                          label: `${g.ethnicity} (${g.count})`,
                        })),
                      ]}
                    />
                    <Select
                      aria-label="Lọc giới tính"
                      value={gender}
                      onChange={(value) => {
                        setGender(value);
                        reset();
                      }}
                      style={{ minWidth: 170 }}
                      options={[
                        { value: "all", label: "Tất cả giới tính" },
                        ...genderSummary(ethnicStudents).map((g) => ({
                          value: g.name,
                          label: `${g.name} (${g.count})`,
                        })),
                      ]}
                    />
                  </Space>
                  <span className="scope-caption">
                    {students.length} học sinh trong phạm vi lọc
                  </span>
                </div>
              )}
              {view === "overview" && (
                <>
                  <div className="stats-grid no-print">
                    {[
                      {
                        label: "Học sinh",
                        tone: "green",
                        value: students.length,
                        detail: genderSummary(students)
                          .filter((g) => g.count)
                          .map(
                            (g) =>
                              `${g.count} ${g.name.toLocaleLowerCase("vi")}`,
                          )
                          .join(" · "),
                        icon: <TeamOutlined aria-hidden />,
                      },
                      {
                        label: "Giảng dạy",
                        tone: "blue",
                        value: stats.periods,
                        detail: `${stats.topics} bài · ${lessons.length} lượt dạy`,
                        icon: <BookOutlined aria-hidden />,
                      },
                      {
                        label: "Đã đánh giá học lực",
                        tone: "gold",
                        value: `${assessed}/${students.length}`,
                        detail: `Môn ${subject}`,
                        icon: <CheckCircleOutlined aria-hidden />,
                      },
                      {
                        label: "Đã ghi nhận năng khiếu",
                        tone: "red",
                        value: students.filter(
                          (s) => s.talents?.length || s.talentTagIds?.length,
                        ).length,
                        detail: "Học sinh có thẻ hoặc đánh giá năng khiếu",
                        icon: <StarOutlined aria-hidden />,
                      },
                    ].map((stat) => (
                      <div
                        className="stat-card"
                        data-tone={stat.tone}
                        key={stat.label}
                      >
                        <span className="stat-icon">{stat.icon}</span>
                        <div className="stat-top">{stat.label}</div>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-detail">{stat.detail}</div>
                      </div>
                    ))}
                  </div>
                  <DashboardCharts
                    students={students}
                    subject={subject}
                    academicTags={data.academicTags}
                  />
                  {students.some((s) => studentDataIssues(s).length > 0) && (
                    <Alert
                      className="data-quality-notice"
                      type="warning"
                      showIcon
                      title={`${students.filter((s) => studentDataIssues(s).length > 0).length} hồ sơ cần đối chiếu dữ liệu`}
                      description="Có thông tin còn thiếu hoặc chưa xác minh trong tài liệu nguồn."
                      action={
                        <Button
                          onClick={() => {
                            setReviewOpen(true);
                            setStudentTab("pupils");
                            navigate("students");
                            requestAnimationFrame(() =>
                              document
                                .querySelector(".source-review-collapse")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                }),
                            );
                          }}
                        >
                          Kiểm tra hồ sơ
                        </Button>
                      }
                    />
                  )}
                  <Collapse
                    className="overview-details"
                    items={[
                      {
                        key: "ethnicities",
                        label: "Chi tiết dân tộc theo lớp",
                        children: (
                          <EthnicityTable
                            students={classStudents}
                            classes={classes}
                            selected={ethnicity}
                            onSelect={(value) => {
                              setEthnicity(value);
                              reset();
                              setStudentTab("pupils");
                              navigate("students");
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                  <div className="overview-shortcuts">
                    <Button
                      icon={<TeamOutlined aria-hidden />}
                      onClick={() => navigate("students")}
                    >
                      Mở lớp & học sinh
                    </Button>
                    <Button
                      icon={<CheckCircleOutlined aria-hidden />}
                      onClick={() => navigate("assessments")}
                    >
                      Cập nhật đánh giá
                    </Button>
                    <Button
                      icon={<FileTextOutlined aria-hidden />}
                      onClick={() => navigate("reports")}
                    >
                      Xuất báo cáo
                    </Button>
                  </div>
                </>
              )}
              {view === "students" && (
                <>
                  <Tabs
                    activeKey={studentTab}
                    onChange={(value) => {
                      setStudentTab(value);
                      reset();
                    }}
                    items={[
                      {
                        key: "classes",
                        label: `Lớp học (${data.classes.length})`,
                      },
                      {
                        key: "pupils",
                        label: `Danh sách học sinh (${students.length})`,
                      },
                    ]}
                  />
                  {studentTab === "classes" ? (
                    <ClassTable
                      data={data}
                      subject={subject}
                      className={className}
                      ethnicity={ethnicity}
                      gender={gender}
                      canEdit={manage}
                      onOpenClass={openClass}
                      onEditClass={(c) =>
                        setClassEditor({ schoolClass: c, isNew: false })
                      }
                      onAddStudent={addStudent}
                      onClassDeleted={(name) => {
                        if (className === name) {
                          setClassName("all");
                          setEthnicity("all");
                        }
                      }}
                      onPendingEnrollment={() => setPending(true)}
                    />
                  ) : (
                    <section className="list-panel">
                      <div className="panel-heading">
                        <h2>
                          Danh sách học sinh{" "}
                          <span className="count-pill">{filtered.length}</span>
                        </h2>
                        <Button
                          icon={<FileExcelOutlined aria-hidden />}
                          loading={exportBusy}
                          onClick={() =>
                            void exportXlsx(
                              selection.length
                                ? filtered.filter((s) =>
                                    selection.includes(s.id),
                                  )
                                : filtered,
                            )
                          }
                        >
                          Xuất Excel
                        </Button>
                      </div>
                      <div className="table-toolbar">
                        <Input
                          aria-label="Tìm kiếm học sinh"
                          prefix={<SearchOutlined aria-hidden />}
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setSelection([]);
                          }}
                          placeholder="Tìm tên, mã hoặc địa chỉ…"
                          allowClear
                          style={{ maxWidth: 310 }}
                        />
                        <Select
                          aria-label="Lọc hồ sơ"
                          value={status}
                          onChange={(value) => {
                            setStatus(value);
                            setSelection([]);
                          }}
                          style={{ minWidth: 170 }}
                          options={[
                            { value: "all", label: "Tất cả hồ sơ" },
                            { value: "missing", label: "Thiếu thông tin" },
                            { value: "support", label: "Cần hỗ trợ học tập" },
                          ]}
                        />
                      </div>
                      <Table<Student>
                        rowKey="id"
                        size="small"
                        dataSource={filtered}
                        rowSelection={{
                          selectedRowKeys: selection,
                          onChange: setSelection,
                        }}
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total) => `${total} học sinh`,
                        }}
                        scroll={{ x: 1120 }}
                        columns={[
                          {
                            title: "HỌC SINH",
                            width: 235,
                            sorter: (a, b) =>
                              a.name.localeCompare(b.name, "vi"),
                            render: (_, s) => (
                              <button
                                className="student-cell"
                                onClick={() =>
                                  setEditor({ student: s, isNew: false })
                                }
                              >
                                <Avatar
                                  shape="square"
                                  size={32}
                                  style={{
                                    background: "#edf2e7",
                                    color: "#315b35",
                                  }}
                                >
                                  {s.name
                                    .split(" ")
                                    .slice(-2)
                                    .map((n) => n[0])
                                    .join("")}
                                </Avatar>
                                <span>
                                  <strong>{s.name}</strong>
                                  <small>
                                    {s.id.startsWith("HS")
                                      ? s.id
                                      : s.id.slice(0, 8)}
                                  </small>
                                </span>
                              </button>
                            ),
                          },
                          {
                            title: "LỚP",
                            dataIndex: "className",
                            width: 80,
                            render: (name) => <Tag>{name}</Tag>,
                          },
                          {
                            title: "GIỚI TÍNH",
                            width: 115,
                            render: (_, s) => genderOf(s),
                          },
                          {
                            title: "NGÀY SINH",
                            dataIndex: "birthDate",
                            width: 115,
                          },
                          {
                            title: "DÂN TỘC",
                            width: 115,
                            render: (_, s) => (
                              <Tooltip title={s.ethnicity}>
                                {ethnicityOf(s)}
                              </Tooltip>
                            ),
                          },
                          {
                            title: "ĐẦU VÀO",
                            width: 95,
                            render: (_, s) => (
                              <StatusBadge
                                color={
                                  academicTag(
                                    assessmentOf(s, subject).before,
                                    data.academicTags,
                                  )?.color ?? "#97671d"
                                }
                              >
                                {academicLabel(
                                  assessmentOf(s, subject).before,
                                  data.academicTags,
                                ) || "Chưa cập nhật"}
                              </StatusBadge>
                            ),
                          },
                          {
                            title: "HIỆN TẠI",
                            width: 130,
                            render: (_, s) => (
                              <Tag
                                color={
                                  assessmentOf(s, subject).after ===
                                  "Cần hỗ trợ"
                                    ? "orange"
                                    : "green"
                                }
                              >
                                {academicLabel(
                                  assessmentOf(s, subject).after,
                                  data.academicTags,
                                ) || "Chưa đánh giá"}
                              </Tag>
                            ),
                          },
                          {
                            title: "TƯƠNG TÁC",
                            width: 140,
                            render: (_, s) =>
                              assessmentOf(s, subject).interaction ||
                              "Chưa cập nhật",
                          },
                          {
                            title: "",
                            width: 80,
                            fixed: "right",
                            render: (_, s) => (
                              <Space size={0}>
                                <Button
                                  type="text"
                                  size="small"
                                  aria-label={`Sửa ${s.name}`}
                                  icon={<EditOutlined aria-hidden />}
                                  onClick={() =>
                                    setEditor({ student: s, isNew: false })
                                  }
                                />
                                {manage && (
                                  <Popconfirm
                                    title={`Xóa học sinh ${s.name}?`}
                                    okText="Xóa học sinh"
                                    cancelText="Hủy"
                                    onConfirm={() =>
                                      commit(
                                        (current) => ({
                                          ...current,
                                          students: current.students.filter(
                                            (p) => p.id !== s.id,
                                          ),
                                        }),
                                        "Đã xóa học sinh.",
                                      )
                                    }
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      aria-label={`Xóa ${s.name}`}
                                      icon={<DeleteOutlined aria-hidden />}
                                    />
                                  </Popconfirm>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </section>
                  )}
                  <Collapse
                    activeKey={reviewOpen ? ["review"] : []}
                    onChange={(keys) => setReviewOpen(keys.includes("review"))}
                    className="source-review-collapse"
                    items={[
                      {
                        key: "review",
                        label: `Đối chiếu dữ liệu (${students.filter((s) => studentDataIssues(s).length > 0).length} hồ sơ)`,
                        children: (
                          <SourceReviewTable
                            students={students}
                            onOpen={(s) =>
                              setEditor({ student: s, isNew: false })
                            }
                          />
                        ),
                      },
                    ]}
                  />
                </>
              )}
              {view === "assessments" && (
                <EvaluationTable
                  key={`${className}-${ethnicity}-${subject}`}
                  students={students}
                  subject={subject}
                  onOpenStudent={(s) =>
                    setEditor({
                      student: s,
                      isNew: false,
                      initialTab: "study",
                    })
                  }
                  onExport={(rows) => void exportXlsx(rows)}
                  exportBusy={exportBusy}
                />
              )}
              {view === "talents" && (
                <TalentTable students={students} tags={data.talentTags} />
              )}
              {view === "lessons" && (
                <section className="list-panel">
                  <div className="panel-heading">
                    <h2>Nhật ký giảng dạy</h2>
                    <Tag>
                      {stats.periods} tiết / {stats.topics} bài
                    </Tag>
                  </div>
                  <Table<Lesson>
                    rowKey="id"
                    size="small"
                    dataSource={[...lessons].sort((a, b) =>
                      b.date.localeCompare(a.date),
                    )}
                    scroll={{ x: 800 }}
                    pagination={{ pageSize: 10 }}
                    locale={{
                      emptyText: <Empty description="Chưa ghi nhận tiết dạy" />,
                    }}
                    columns={[
                      {
                        title: "NGÀY DẠY",
                        dataIndex: "date",
                        render: (date) => date.split("-").reverse().join("/"),
                        width: 120,
                      },
                      { title: "LỚP", dataIndex: "className", width: 80 },
                      { title: "BÀI HỌC", dataIndex: "title" },
                      { title: "SỐ TIẾT", dataIndex: "periods", width: 90 },
                      { title: "GHI CHÚ", dataIndex: "note", ellipsis: true },
                      {
                        title: "",
                        width: 85,
                        fixed: "right",
                        render: (_, l) => (
                          <Space size={0}>
                            <Button
                              type="text"
                              size="small"
                              aria-label={`Sửa bài ${l.title}`}
                              icon={<EditOutlined aria-hidden />}
                              onClick={() =>
                                setLessonEditor({ lesson: l, isNew: false })
                              }
                            />
                            <Popconfirm
                              title="Xóa lượt dạy này?"
                              okText="Xóa"
                              cancelText="Hủy"
                              onConfirm={() =>
                                commit(
                                  (current) => ({
                                    ...current,
                                    lessons: current.lessons.filter(
                                      (p) => p.id !== l.id,
                                    ),
                                  }),
                                  "Đã xóa lượt dạy.",
                                )
                              }
                            >
                              <Button
                                type="text"
                                size="small"
                                danger
                                aria-label={`Xóa bài ${l.title}`}
                                icon={<DeleteOutlined aria-hidden />}
                              />
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </section>
              )}
              {view === "reports" && (
                <ReportView
                  academicTags={data.academicTags}
                  talentTags={data.talentTags}
                  key={`${className}-${ethnicity}-${subject}`}
                  students={students}
                  lessons={lessons}
                  classes={classes}
                  subject={subject}
                  className={className}
                  studentScope={studentScope}
                  teacherName={user.name}
                  schoolYear={data.settings.schoolYear}
                />
              )}
              {view === "settings" && admin && <AdminPanel data={data} />}
            </>
          )}
          <footer className="page-footer no-print">
            <span>Phân hiệu 1 · Khoa Tin học và Ngoại ngữ</span>
            <span>
              {updatedAt
                ? `Supabase · Cập nhật ${new Date(updatedAt).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`
                : "Đang kết nối Supabase"}
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <StudentEditor
          key={`${editor.student.id}-${subject}`}
          {...editor}
          subject={subject}
          onClose={() => setEditor(null)}
        />
      )}
      {classEditor && manage && (
        <ClassEditor
          {...classEditor}
          onClose={() => setClassEditor(null)}
          onSaved={() => {
            setClassName("all");
            setEthnicity("all");
          }}
        />
      )}
      {lessonEditor && (
        <LessonEditor {...lessonEditor} onClose={() => setLessonEditor(null)} />
      )}
      {importing && manage && (
        <ImportModal
          open
          students={data.students}
          className={className}
          onClose={() => setImporting(false)}
        />
      )}
      {pending && manage && (
        <PendingEnrollment data={data} onClose={() => setPending(false)} />
      )}
    </div>
  );
}
