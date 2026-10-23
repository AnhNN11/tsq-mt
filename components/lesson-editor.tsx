"use client";
import { useState } from "react";

import { App, Col, Form, Input, InputNumber, Modal, Row } from "antd";
import { saveWorkspace } from "@/lib/store";
import { validLessonDate, type Lesson } from "@/lib/model";

export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export default function LessonEditor({
  lesson,
  isNew,
  onClose,
}: {
  lesson: Lesson;
  isNew: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<Lesson>();
  const { message, modal } = App.useApp();
  function close() {
    if (form.isFieldsTouched())
      modal.confirm({
        title: "Đóng tiết dạy chưa lưu?",
        content: "Các thay đổi vừa nhập sẽ không được lưu.",
        okText: "Đóng",
        cancelText: "Tiếp tục nhập",
        onOk: onClose,
      });
    else onClose();
  }
  async function save(values: Lesson) {
    if (busy) return;
    setBusy(true);
    try {
      await saveWorkspace((current) => {
        if (!isNew && !current.lessons.some((l) => l.id === lesson.id))
          throw new Error("Tiết dạy đã bị xóa ở cửa sổ khác.");
        const next = { ...lesson, ...values, title: values.title.trim() };
        return {
          ...current,
          lessons: isNew
            ? [...current.lessons, next]
            : current.lessons.map((l) => (l.id === lesson.id ? next : l)),
        };
      });
      message.success("Đã lưu tiết dạy và cập nhật số liệu báo cáo.");
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
      title={isNew ? "Ghi nhận tiết dạy" : "Chỉnh sửa tiết dạy"}
      onCancel={close}
      onOk={() => form.submit()}
      okText="Lưu tiết dạy"
      cancelText="Hủy"
    >
      <p className="muted">
        Lớp {lesson.className} · Môn {lesson.subject}
      </p>
      <Form
        form={form}
        layout="vertical"
        initialValues={lesson}
        onFinish={save}
      >
        <Form.Item
          name="title"
          label="Tên bài học"
          rules={[
            {
              required: true,
              whitespace: true,
              message: "Vui lòng nhập tên bài học.",
            },
          ]}
        >
          <Input placeholder="Ví dụ: Bài 1. Mệnh đề" maxLength={300} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={15}>
            <Form.Item
              name="date"
              label="Ngày dạy"
              rules={[
                { required: true, message: "Chọn ngày dạy." },
                {
                  validator: (_, value) =>
                    !value || validLessonDate(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error("Ngày dạy không hợp lệ.")),
                },
              ]}
            >
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col span={9}>
            <Form.Item
              name="periods"
              label="Số tiết"
              rules={[{ required: true, message: "Nhập số tiết." }]}
            >
              <InputNumber
                aria-label="Số tiết"
                min={1}
                max={20}
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="note" label="Nội dung / ghi chú">
          <Input.TextArea
            rows={4}
            maxLength={5000}
            placeholder="Nội dung đã dạy, tình hình tiếp thu của lớp…"
          />
        </Form.Item>
      </Form>
      <p className="small muted">
        Các lần dạy có cùng tên bài được tính chung một bài; số tiết được cộng
        dồn.
      </p>
    </Modal>
  );
}
