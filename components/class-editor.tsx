"use client";
import { useState } from "react";

import { App, Form, Input, Modal } from "antd";
import { normalizeClass, validClassName, type SchoolClass } from "@/lib/model";
import { saveWorkspace } from "@/lib/store";

export default function ClassEditor({
  schoolClass,
  isNew,
  onClose,
  onSaved,
}: {
  schoolClass: SchoolClass;
  isNew: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<SchoolClass>();
  const { message, modal } = App.useApp();
  function close() {
    if (form.isFieldsTouched())
      modal.confirm({
        title: "Đóng thông tin lớp chưa lưu?",
        okText: "Đóng",
        cancelText: "Tiếp tục nhập",
        onOk: onClose,
      });
    else onClose();
  }
  async function save(values: SchoolClass) {
    if (busy) return;
    setBusy(true);
    try {
      const next = {
        ...schoolClass,
        ...values,
        name: normalizeClass(values.name),
      };
      await saveWorkspace((current) => {
        if (
          current.classes.some(
            (c) => c.id !== schoolClass.id && c.name === next.name,
          )
        )
          throw new Error("Tên lớp đã tồn tại. Vui lòng chọn tên khác.");
        if (!isNew && !current.classes.some((c) => c.id === schoolClass.id))
          throw new Error("Lớp đã bị xóa ở cửa sổ khác.");
        return {
          ...current,
          classes: isNew
            ? [...current.classes, next]
            : current.classes.map((c) => (c.id === schoolClass.id ? next : c)),
          students: current.students.map((s) =>
            s.className === schoolClass.name
              ? { ...s, className: next.name }
              : s,
          ),
          lessons: current.lessons.map((l) =>
            l.className === schoolClass.name
              ? { ...l, className: next.name }
              : l,
          ),
        };
      });
      message.success(
        isNew ? `Đã tạo lớp ${next.name}.` : `Đã cập nhật lớp ${next.name}.`,
      );
      onSaved(next.name);
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      confirmLoading={busy}
      title={isNew ? "Thêm lớp học" : "Chỉnh sửa lớp học"}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Lưu lớp học"
      cancelText="Hủy"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={schoolClass}
        onFinish={save}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="name"
          label="Tên lớp"
          rules={[
            { required: true, message: "Nhập tên lớp." },
            {
              validator: (_, value) =>
                !value || validClassName(normalizeClass(value))
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error("Khối từ 1 đến 12, số lớp từ 1 đến 99."),
                    ),
            },
            {
              pattern: /^\d{1,2}[./]\d{1,2}$/,
              message: "Ví dụ: 10/1 hoặc 10.1",
            },
          ]}
        >
          <Input placeholder="10/1" maxLength={5} />
        </Form.Item>
        <Form.Item name="track" label="Khối / phân ban">
          <Input placeholder="Ví dụ: Khối tự nhiên" maxLength={150} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={3} maxLength={5000} />
        </Form.Item>
      </Form>
      <p className="small muted">
        Đổi tên lớp sẽ cập nhật lớp của tất cả học sinh và các lượt dạy liên
        quan.
      </p>
    </Modal>
  );
}
