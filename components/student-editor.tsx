"use client";
import { useState } from "react";

import {
  App,
  Button,
  Col,
  ConfigProvider,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
} from "antd";
import {
  SaveOutlined,
  UserOutlined,
  ReadOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import {
  assessmentOf,
  INTERACTIONS,
  normalizeClass,
  genderOf,
  studentKey,
  type Assessment,
  type Student,
} from "@/lib/model";
import { saveWorkspace } from "@/lib/store";
import { useWorkspace } from "@/lib/store";
import { validBirthDate } from "@/lib/validation";
import { useUser } from "./auth-context";
import { canManage } from "@/lib/access";
import AcademicLevelSelect from "./academic-level-select";
import { applyStudentEdit } from "@/lib/student-update";

type StudentForm = Omit<Student, "assessments"> & { assessment: Assessment };
const options = (items: string[]) =>
  items.map((value) => ({ value, label: value }));

export default function StudentEditor({
  student,
  subject,
  isNew,
  initialTab = "personal",
  onClose,
}: {
  student: Student;
  subject: string;
  isNew: boolean;
  initialTab?: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<StudentForm>();
  const { data } = useWorkspace();
  const manage = canManage(useUser());
  const { message, modal } = App.useApp();
  function close() {
    if (form.isFieldsTouched())
      modal.confirm({
        title: "Đóng hồ sơ chưa lưu?",
        content: "Các thay đổi vừa nhập sẽ không được lưu.",
        okText: "Đóng hồ sơ",
        cancelText: "Tiếp tục chỉnh sửa",
        onOk: onClose,
      });
    else onClose();
  }
  async function save(values: StudentForm) {
    if (busy) return;
    setBusy(true);
    const { assessment, ...fields } = values;
    const next: Student = {
      ...student,
      ...fields,
      gender: fields.gender ?? student.gender,
      name: (fields.name ?? student.name).trim().replace(/\s+/g, " "),
      className: normalizeClass(fields.className ?? student.className),
      assessments: {
        ...student.assessments,
        [subject]: {
          before: assessment.before ?? "",
          after: assessment.after ?? "",
          interaction: assessment.interaction ?? "",
          note: assessment.note?.trim() || "",
        },
      },
    };
    try {
      await saveWorkspace((current) => {
        if (!isNew && !current.students.some((s) => s.id === student.id))
          throw new Error(
            "Hồ sơ đã bị xóa ở cửa sổ khác. Hãy tải lại danh sách.",
          );
        if (
          current.students.some(
            (s) => s.id !== student.id && studentKey(s) === studentKey(next),
          )
        )
          throw new Error(
            "Lớp này đã có học sinh trùng họ tên. Vui lòng kiểm tra lại.",
          );
        return {
          ...current,
          students: isNew
            ? [...current.students, next]
            : current.students.map((s) =>
                s.id === student.id
                  ? applyStudentEdit(s, next, subject, manage)
                  : s,
              ),
        };
      });
      message.success(
        isNew ? "Đã thêm học sinh mới." : `Đã lưu hồ sơ ${next.name}.`,
      );
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title={isNew ? "Thêm học sinh" : "Hồ sơ học sinh"}
      open
      onClose={close}
      size="large"
      extra={
        <Button
          loading={busy}
          type="primary"
          icon={<SaveOutlined aria-hidden />}
          onClick={() => form.submit()}
        >
          Lưu hồ sơ
        </Button>
      }
    >
      <div className="profile-heading">
        <div className="profile-avatar">
          <UserOutlined aria-hidden />
        </div>
        <div>
          <h2>{student.name || "Học sinh mới"}</h2>
          <Space>
            <Tag>Lớp {student.className}</Tag>
            <span className="muted">
              {isNew
                ? "Tạo hồ sơ mới"
                : student.id.startsWith("HS")
                  ? student.id
                  : "Hồ sơ cá nhân"}
            </span>
          </Space>
        </div>
      </div>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ...student,
          assessment: assessmentOf(student, subject),
        }}
        onFinish={save}
        onFinishFailed={() =>
          message.warning("Vui lòng kiểm tra các trường bắt buộc trong hồ sơ.")
        }
      >
        <Tabs
          defaultActiveKey={manage ? initialTab : "study"}
          items={[
            {
              key: "personal",
              label: (
                <>
                  <UserOutlined aria-hidden /> Thông tin chung
                </>
              ),
              forceRender: true,
              children: (
                <ConfigProvider componentDisabled={!manage}>
                  {!manage && (
                    <p className="editor-note">
                      Thông tin hồ sơ do quản trị viên hoặc phó khoa cập nhật.
                      Giáo viên chỉnh sửa tại phần đánh giá môn học.
                    </p>
                  )}
                  <Row gutter={16}>
                    <Col span={16}>
                      <Form.Item
                        name="name"
                        label="Họ và tên"
                        rules={[
                          {
                            required: true,
                            whitespace: true,
                            message: "Vui lòng nhập họ và tên.",
                          },
                          { max: 150 },
                        ]}
                      >
                        <Input
                          placeholder="Nhập họ và tên học sinh"
                          maxLength={150}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="className"
                        label="Lớp"
                        rules={[
                          { required: true },
                          {
                            pattern: /^\d{1,2}[./]\d{1,2}$/,
                            message: "Ví dụ: 10/1",
                          },
                        ]}
                      >
                        <Select
                          aria-label="Lớp của học sinh"
                          options={data.classes.map((c) => ({
                            value: c.name,
                            label: `Lớp ${c.name}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="gender"
                        label="Giới tính"
                        rules={[
                          {
                            validator: (_, value) =>
                              !value ||
                              value === student.gender ||
                              genderOf({ gender: value }) !== "Chưa cập nhật"
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error("Chọn Nam, Nữ hoặc Khác."),
                                  ),
                          },
                        ]}
                      >
                        <Select
                          allowClear
                          placeholder="Chưa cập nhật"
                          aria-label="Giới tính học sinh"
                          options={options(["Nam", "Nữ", "Khác"])}
                          onClear={() => form.setFieldValue("gender", "")}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="birthDate"
                        label="Ngày sinh"
                        rules={[
                          {
                            validator: (_, value) =>
                              !value ||
                              value === student.birthDate ||
                              validBirthDate(value)
                                ? Promise.resolve()
                                : Promise.reject(
                                    new Error(
                                      "Nhập ngày có thật theo dd/mm/yyyy, không ở tương lai.",
                                    ),
                                  ),
                          },
                        ]}
                      >
                        <Input placeholder="dd/mm/yyyy" maxLength={30} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="block" label="Dãy">
                        <Input placeholder="s1, s4…" maxLength={30} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="room" label="Phòng">
                        <Input maxLength={30} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="ethnicity" label="Dân tộc / tôn giáo">
                        <Input maxLength={150} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="address" label="Nơi ở hiện nay">
                    <Input.TextArea rows={2} maxLength={2000} />
                  </Form.Item>
                  <Form.Item
                    name="personality"
                    label="Tính cách"
                    extra="Ghi nhận từ quan sát thực tế của giáo viên."
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Ví dụ: hòa đồng, cẩn thận, còn ngại phát biểu…"
                      maxLength={5000}
                      showCount
                    />
                  </Form.Item>
                  <Form.Item name="notes" label="Ghi chú chung">
                    <Input.TextArea rows={2} maxLength={5000} />
                  </Form.Item>
                </ConfigProvider>
              ),
            },
            {
              key: "family",
              label: (
                <>
                  <HomeOutlined aria-hidden /> Gia đình & trích ngang
                </>
              ),
              forceRender: true,
              children: (
                <ConfigProvider componentDisabled={!manage}>
                  <Form.Item
                    name="parents"
                    label="Phụ huynh và thông tin liên hệ"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="Họ tên cha, mẹ; số điện thoại liên hệ…"
                      maxLength={5000}
                    />
                  </Form.Item>
                  <Form.Item name="family" label="Hoàn cảnh gia đình">
                    <Input.TextArea
                      rows={3}
                      placeholder="Điều kiện gia đình và những điều giáo viên cần lưu ý…"
                      maxLength={5000}
                    />
                  </Form.Item>
                  <Form.Item
                    name="priorEducation"
                    label="Kết quả giáo dục / phẩm chất từ trích ngang"
                    extra="Giữ nguyên thông tin nguồn; đây không phải đánh giá đầu vào của môn học."
                  >
                    <Input.TextArea rows={2} maxLength={5000} />
                  </Form.Item>
                  <Form.Item
                    name="strengths"
                    label="Sở trường / sức khỏe từ trích ngang"
                  >
                    <Input.TextArea rows={3} maxLength={5000} />
                  </Form.Item>
                </ConfigProvider>
              ),
            },
            {
              key: "study",
              label: (
                <>
                  <ReadOutlined aria-hidden /> Đánh giá môn {subject}
                </>
              ),
              forceRender: true,
              children: (
                <>
                  <div className="editor-note">
                    Đánh giá được lưu riêng cho môn <strong>{subject}</strong>.
                    Chọn môn khác ở thanh trên để cập nhật môn đó.
                  </div>
                  <Form.Item
                    name={["assessment", "before"]}
                    label="Trình độ trước khi vào trường"
                    extra="Điền sẵn từ kết quả giáo dục trong trích ngang; có thể điều chỉnh cho môn đang chọn."
                  >
                    <AcademicLevelSelect
                      stage="before"
                      placeholder="Chọn mức đánh giá đầu vào"
                    />
                  </Form.Item>
                  <Form.Item
                    name={["assessment", "after"]}
                    label="Trình độ sau khi học tại trường"
                  >
                    <AcademicLevelSelect
                      stage="after"
                      allowClear
                      placeholder="Chọn mức đánh giá hiện tại"
                      onClear={() =>
                        form.setFieldValue(["assessment", "after"], "")
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["assessment", "interaction"]}
                    label="Mức độ tương tác trong lớp"
                  >
                    <Select
                      allowClear
                      placeholder="Chọn mức độ tương tác"
                      options={options(INTERACTIONS)}
                      onClear={() =>
                        form.setFieldValue(["assessment", "interaction"], "")
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name={["assessment", "note"]}
                    label="Nhận xét và hướng hỗ trợ"
                  >
                    <Input.TextArea
                      rows={6}
                      placeholder="Nêu sự tiến bộ, khó khăn và biện pháp hỗ trợ cụ thể…"
                      maxLength={10000}
                      showCount
                    />
                  </Form.Item>
                </>
              ),
            },
          ].filter((item) => manage || item.key === "study")}
        />
        <div className="source-note">
          <strong>Nguồn hồ sơ</strong>
          <br />
          {student.source}
        </div>
      </Form>
    </Drawer>
  );
}
