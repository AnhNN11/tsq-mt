"use client";

import { useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from "antd";
import {
  DownloadOutlined,
  FileTextOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { csvContent, type Student } from "@/lib/model";
import {
  readStudentFile,
  previewImport,
  mergeStudents,
  type ImportedStudent,
} from "@/lib/import-students";
import { saveWorkspace } from "@/lib/store";
import { download } from "@/lib/download";

export default function ImportModal({
  open,
  onClose,
  students,
  className,
}: {
  open: boolean;
  onClose: () => void;
  students: Student[];
  className: string;
}) {
  const { message } = App.useApp();
  const [incoming, setIncoming] = useState<ImportedStudent[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [importClass, setImportClass] = useState(
    className === "all" ? "10/1" : className,
  );
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const preview = previewImport(
    incoming.filter((s) => s.className === importClass),
    students,
  );
  const valid = preview.filter(
    (r) => r.status === "new" || r.status === "update",
  );
  const classes = Array.from(new Set(incoming.map((s) => s.className))).sort();
  async function read(file: File) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setIncoming([]);
    setFilename(file.name);
    try {
      const rows = await readStudentFile(file, importClass, students);
      if (id !== requestId.current) return;
      setIncoming(rows);
      if (!rows.some((s) => s.className === importClass))
        setImportClass(rows[0].className);
      message.success(
        `Đã đọc ${rows.length} dòng. Hãy kiểm tra trước khi import.`,
      );
    } catch (e) {
      if (id === requestId.current) {
        const text = e instanceof Error ? e.message : "Không đọc được file.";
        setError(text);
        message.error(text);
      }
    } finally {
      if (id === requestId.current) setBusy(false);
    }
    return false;
  }
  function close() {
    requestId.current++;
    setBusy(false);
    onClose();
  }
  async function confirm() {
    try {
      await saveWorkspace((current) => ({
        ...current,
        students: mergeStudents(
          current.students,
          valid.map((r) => r.student),
          overwrite,
        ),
      }));
      message.success(`Đã import ${valid.length} hồ sơ lớp ${importClass}.`);
      close();
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <Modal
      title="Import danh sách học sinh"
      open={open}
      onCancel={close}
      width={860}
      footer={
        <Space>
          <Button onClick={close}>Hủy</Button>
          <Button
            type="primary"
            disabled={!valid.length || busy}
            onClick={confirm}
          >
            Import {valid.length || ""} hồ sơ
          </Button>
        </Space>
      }
    >
      <p className="muted">
        Nhập danh sách lớp hoặc bổ sung trích ngang. Học sinh được đối chiếu
        theo họ tên và lớp. Trích ngang Đại đội 2 không ghi rõ lớp chỉ được ghép
        với học sinh khớp duy nhất trong danh sách hiện có.
      </p>
      <Upload.Dragger
        accept=".docx,.xlsx,.csv"
        showUploadList={false}
        disabled={busy}
        beforeUpload={(file) => {
          void read(file);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined aria-hidden />
        </p>
        <p className="ant-upload-text">
          {busy
            ? "Đang đọc dữ liệu…"
            : "Kéo thả file vào đây hoặc nhấn để chọn"}
        </p>
        <p className="ant-upload-hint">
          Word (.docx), Excel (.xlsx), CSV · Tối đa 10 MB
        </p>
      </Upload.Dragger>
      <Button
        type="link"
        icon={<DownloadOutlined aria-hidden />}
        onClick={() =>
          download(
            csvContent([
              [
                "Họ và tên",
                "Lớp",
                "Phòng",
                "Dãy",
                "Hoàn cảnh gia đình",
                "Tính cách",
                "Ghi chú",
              ],
              ["", importClass, "", "", "", "", ""],
            ]),
            "mau-import-hoc-sinh.csv",
          )
        }
      >
        Tải file CSV mẫu
      </Button>
      {error && <Alert type="error" title={error} showIcon />}
      {incoming.length > 0 && (
        <>
          <div className="import-summary">
            <Space>
              <FileTextOutlined aria-hidden />
              <strong>{filename}</strong>
            </Space>
            <Select
              aria-label="Lớp cần import"
              value={importClass}
              onChange={setImportClass}
              options={classes.map((c) => ({ value: c, label: `Lớp ${c}` }))}
            />
          </div>
          <Alert
            type="info"
            showIcon
            title={`Chỉ import lớp ${importClass}: ${preview.filter((r) => r.status === "new").length} mới, ${preview.filter((r) => r.status === "update").length} đã có, ${preview.filter((r) => r.status === "invalid" || r.status === "duplicate").length} bỏ qua.`}
            description="Các lớp khác và cán bộ không được nhập vào lớp đang chọn. Đánh giá môn học hiện có được giữ nguyên."
          />
          <Table
            size="small"
            rowKey="index"
            dataSource={preview}
            pagination={{ pageSize: 5 }}
            scroll={{ x: 600 }}
            columns={[
              { title: "Dòng", dataIndex: "index", width: 65 },
              {
                title: "Họ và tên",
                render: (_, r) => r.student.name || "Thiếu họ tên",
              },
              {
                title: "Lớp",
                render: (_, r) => r.student.className,
                width: 80,
              },
              {
                title: "Xử lý",
                render: (_, r) => (
                  <Tag
                    color={
                      r.status === "new"
                        ? "green"
                        : r.status === "update"
                          ? "blue"
                          : "orange"
                    }
                  >
                    {r.status === "new"
                      ? "Thêm mới"
                      : r.status === "update"
                        ? "Bổ sung"
                        : "Bỏ qua"}
                  </Tag>
                ),
                width: 100,
              },
              {
                title: "Thông tin",
                render: (_, r) =>
                  r.status === "invalid" || r.status === "duplicate"
                    ? r.reason
                    : r.student.family || r.student.block || "—",
              },
            ]}
          />
          <Checkbox
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          >
            Ghi đè các trường có dữ liệu bằng thông tin không rỗng từ file
          </Checkbox>
          <p className="small muted">
            Mặc định chỉ điền thông tin còn trống; tên và mã học sinh hiện tại
            được giữ nguyên. Dữ liệu nhận xét theo môn được nhập trong hồ sơ học
            sinh.
          </p>
        </>
      )}
    </Modal>
  );
}
