"use client";
import { useRef, useState } from "react";
import { Alert, App, Button, Collapse, Form, Input, Space, Tabs } from "antd";
import { DownloadOutlined, ImportOutlined } from "@ant-design/icons";
import AccountManager from "./account-manager";
import { parseWorkspace, validSchoolYear, type Workspace } from "@/lib/model";
import { rawBackup, saveWorkspace } from "@/lib/store";
import { download } from "@/lib/download";
import PendingEnrollment from "./pending-enrollment";
import { today } from "./lesson-editor";

export default function AdminPanel({ data }: { data: Workspace }) {
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { message, modal } = App.useApp();
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("File sao lưu phải nhỏ hơn 20 MB.");
      const data = parseWorkspace(JSON.parse(await file.text()));
      if (!data) throw new Error("Bản sao lưu chưa đúng định dạng.");
      modal.confirm({
        title: "Thay thế dữ liệu chung bằng bản sao lưu?",
        content: `Gồm ${data.students.length} học sinh. Thao tác ảnh hưởng tất cả tài khoản; hãy tải bản hiện tại trước khi khôi phục.`,
        okText: "Khôi phục dữ liệu chung",
        cancelText: "Hủy",
        onOk: async () => {
          await saveWorkspace(() => data, true);
          message.success("Đã khôi phục dữ liệu chung.");
        },
      });
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <section className="list-panel admin-panel">
      <Tabs
        items={[
          {
            key: "users",
            label: "Tài khoản & phân quyền",
            children: <AccountManager />,
          },
          {
            key: "settings",
            label: "Năm học",
            children: (
              <Form
                layout="vertical"
                initialValues={data.settings}
                onFinish={async (values) => {
                  try {
                    await saveWorkspace((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        schoolYear: values.schoolYear.trim(),
                      },
                    }));
                    message.success("Đã lưu năm học.");
                  } catch (e) {
                    message.error((e as Error).message);
                  }
                }}
                style={{ maxWidth: 400, padding: 24 }}
              >
                <Form.Item
                  name="schoolYear"
                  label="Năm học"
                  rules={[
                    { required: true },
                    {
                      validator: (_, value) =>
                        !value || validSchoolYear(value)
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                "Năm kết thúc phải liền sau năm bắt đầu, ví dụ 2026 - 2027.",
                              ),
                            ),
                    },
                    {
                      pattern: /^\d{4}\s*[–-]\s*\d{4}$/,
                      message: "Ví dụ: 2026 - 2027",
                    },
                  ]}
                >
                  <Input maxLength={20} />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  Lưu năm học
                </Button>
              </Form>
            ),
          },
          {
            key: "data",
            label: "Dữ liệu & sao lưu",
            children: (
              <div className="admin-data">
                <Alert
                  type="success"
                  showIcon
                  title="Dữ liệu dùng chung trên Supabase"
                  description="Học sinh, đánh giá, năng khiếu và tài khoản được quản lý tập trung trên Supabase. Tải bản sao lưu định kỳ để lưu giữ hồ sơ và đánh giá."
                />
                <Space wrap>
                  <Button
                    icon={<DownloadOutlined aria-hidden />}
                    onClick={() => {
                      download(
                        rawBackup(),
                        `mam-xanh-${today()}.json`,
                        "application/json",
                      );
                      message.success("Đã tải bản sao lưu.");
                    }}
                  >
                    Tải bản sao lưu JSON
                  </Button>
                  <Button
                    icon={<ImportOutlined aria-hidden />}
                    onClick={() => input.current?.click()}
                  >
                    Khôi phục bản sao lưu
                  </Button>
                  <Button onClick={() => setPending(true)}>
                    Hồ sơ chờ đối chiếu ({data.pendingStudents.length})
                  </Button>
                </Space>
                <Collapse
                  items={[
                    {
                      key: "scope",
                      label: "Dữ liệu hiện có",
                      children: (
                        <p>
                          {data.classes.length} lớp · {data.students.length} học
                          sinh · {data.lessons.length} lượt dạy ·{" "}
                          {data.pendingStudents.length} hồ sơ cũ chờ đối chiếu.
                        </p>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
      <input
        ref={input}
        type="file"
        accept=".json"
        hidden
        aria-label="Chọn bản sao lưu JSON"
        onChange={(e) => {
          void restore(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {pending && (
        <PendingEnrollment data={data} onClose={() => setPending(false)} />
      )}
    </section>
  );
}
