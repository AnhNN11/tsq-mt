"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from "antd";
import { useUser } from "./auth-context";
import { gradingFetch, compressPaper } from "@/lib/grading-client";
import {
  checkedLayout,
  COMMON_LAYOUT,
  gridBlock,
  type PaperTemplate,
} from "@/lib/paper-template-model";
import {
  homography,
  project,
  UNIT_CORNERS,
  convexHull,
  polygonArea,
} from "@/lib/omr-geometry";
import { sheetSvg } from "@/lib/sheet-template";
import type { BubbleGroup } from "@/lib/omr-reference";
import type { Point } from "@/lib/grading-model";
function groupLabel(key: string) {
  const [p, i, j] = key.split(":");
  return p === "multipleChoice"
    ? `Chọn đáp án · Câu ${Number(i) + 1}`
    : p === "trueFalse"
      ? `Đúng/Sai · Câu ${Number(i) + 1}, ý ${"abcd"[Number(j)]}`
      : p === "shortAnswer"
        ? `Trả lời ngắn · Câu ${Number(i) + 1}, ô ${Number(j) + 1}`
        : p === "candidate"
          ? `Số báo danh · Cột ${Number(i) + 1}`
          : `Mã đề · Cột ${Number(i) + 1}`;
}
export default function TemplateManager({
  subject,
  templates,
  onClose,
  onChanged,
}: {
  subject: string;
  templates: PaperTemplate[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const user = useUser(),
    { message } = App.useApp(),
    [editing, setEditing] = useState<{
      template?: PaperTemplate;
      copy?: boolean;
      view?: boolean;
    } | null>(null);
  return (
    <Modal
      open
      width={1050}
      title={`Mẫu phiếu ô tô · ${subject}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng danh mục mẫu</Button>}
    >
      <Alert
        type="info"
        showIcon
        title="Chọn một bố cục phiếu, cấu hình số câu và đáp án riêng trong bài thi."
        description="Mẫu chung theo phiếu đã cung cấp có ba phần. Mẫu nội bộ hoặc bố cục khác cần căn chỉnh ô tô, thử ảnh thực tế trước khi chấm. Ảnh dùng để căn chỉnh chỉ mở trên trình duyệt, không lưu lên hệ thống."
      />
      <Space wrap style={{ margin: "16px 0" }}>
        <Button type="primary" onClick={() => setEditing({ copy: true })}>
          Tạo mẫu phiếu
        </Button>
      </Space>
      <Table<PaperTemplate>
        rowKey="id"
        size="small"
        dataSource={templates}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 750 }}
        columns={[
          { title: "Tên mẫu", dataIndex: "name" },
          {
            title: "Phạm vi",
            render: (_, t) => <Tag>{t.subject ?? "Dùng chung hai môn"}</Tag>,
          },
          {
            title: "Các phần hỗ trợ",
            width: 230,
            render: (_, t) =>
              [
                ["multipleChoice", "câu chọn đáp án"],
                ["trueFalse", "câu đúng hoặc sai"],
                ["shortAnswer", "câu trả lời ngắn"],
              ]
                .map(([part, label]) => {
                  const count = new Set(
                    t.groups
                      .filter((g) => g.key.startsWith(`${part}:`))
                      .map((g) => g.key.split(":")[1]),
                  ).size;
                  return count ? `${count} ${label}` : "";
                })
                .filter(Boolean)
                .join(" · "),
          },
          {
            title: "Thao tác",
            width: 330,
            render: (_, t) => (
              <Space wrap>
                <Button
                  size="small"
                  onClick={() => setEditing({ template: t, view: true })}
                >
                  Xem mẫu
                </Button>
                <Button
                  size="small"
                  onClick={() => setEditing({ template: t, copy: true })}
                >
                  Tạo từ mẫu
                </Button>
                <Button
                  size="small"
                  disabled={t.subject === null && user.role === "teacher"}
                  onClick={() => setEditing({ template: t })}
                >
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa mẫu khỏi danh mục?"
                  description="Các bài thi đã tạo vẫn giữ bố cục mẫu riêng."
                  okText="Xóa mẫu"
                  cancelText="Hủy"
                  onConfirm={async () => {
                    try {
                      await gradingFetch("/api/grading/templates", "DELETE", {
                        id: t.id,
                        version: t.version,
                      });
                      onChanged();
                      message.success("Đã xóa mẫu khỏi danh mục.");
                    } catch (e) {
                      message.error((e as Error).message);
                    }
                  }}
                >
                  <Button
                    danger
                    size="small"
                    disabled={t.subject === null && user.role === "teacher"}
                  >
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      {editing && (
        <TemplateEditor
          key={`${editing.template?.id ?? "new"}-${editing.copy}-${editing.view}`}
          {...editing}
          subject={subject}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </Modal>
  );
}
function TemplateEditor({
  template,
  copy,
  view,
  subject,
  onClose,
  onSaved,
}: {
  template?: PaperTemplate;
  copy?: boolean;
  view?: boolean;
  subject: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message, modal } = App.useApp(),
    [name, setName] = useState(
      copy && template
        ? `${template.name.slice(0, 105)} (bản sao)`
        : (template?.name ?? ""),
    ),
    [groups, setGroups] = useState<BubbleGroup[]>(
      structuredClone(template?.groups ?? COMMON_LAYOUT),
    ),
    [photo, setPhoto] = useState(""),
    [corners, setCorners] = useState<Point[]>([]),
    [picks, setPicks] = useState<Point[]>([]),
    [mode, setMode] = useState<"corners" | "block" | "none">("none"),
    [part, setPart] = useState<"multipleChoice" | "trueFalse" | "shortAnswer">(
      "multipleChoice",
    ),
    [start, setStart] = useState(1),
    [count, setCount] = useState(10),
    [radius, setRadius] = useState(0.8),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [tab, setTab] = useState("preview");
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo);
    },
    [photo],
  );
  const readOnly = Boolean(view);
  function close() {
    if (dirty)
      modal.confirm({
        title: "Đóng mẫu phiếu chưa lưu?",
        content: "Các vị trí ô tô vừa căn chỉnh sẽ không được lưu.",
        okText: "Đóng",
        cancelText: "Tiếp tục chỉnh",
        onOk: onClose,
      });
    else onClose();
  }
  async function save() {
    try {
      if (photo && corners.length !== 4)
        throw new Error("Chọn đủ bốn dấu định vị của phiếu trước khi lưu.");
      if (
        photo &&
        (convexHull(corners).length !== 4 ||
          polygonArea(corners) < 0.1 ||
          Math.abs(polygonArea(convexHull(corners)) - polygonArea(corners)) >
            0.000001)
      )
        throw new Error(
          "Bốn dấu định vị chưa đúng thứ tự hoặc quá gần nhau. Chọn lại trước khi lưu mẫu.",
        );
      const values = checkedLayout(groups);
      if (name.trim().length < 2 || name.trim().length > 120)
        throw new Error("Tên mẫu từ 2 đến 120 ký tự.");
      setBusy(true);
      await gradingFetch("/api/grading/templates", "POST", {
        id: copy ? undefined : template?.id,
        version: template?.version,
        name,
        subject: !copy && template ? template.subject : subject,
        groups: values,
      });
      message.success("Đã lưu mẫu phiếu. Có thể chọn mẫu khi tạo bài thi.");
      onSaved();
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let overlay: { group: BubbleGroup; points: Point[] }[] = [];
  try {
    const h = homography(
      UNIT_CORNERS,
      corners.length === 4 ? corners : UNIT_CORNERS,
    );
    overlay = groups.map((group) => ({
      group,
      points: group.points.map((p) => project(h, p)),
    }));
  } catch {
    /* Show the reference image until four valid corners are chosen. */
  }
  return (
    <Modal
      open
      width={1250}
      title={
        view
          ? "Xem bố cục mẫu phiếu"
          : copy
            ? "Tạo mẫu phiếu mới"
            : "Sửa mẫu phiếu"
      }
      onCancel={close}
      footer={
        <Space>
          <Button onClick={close}>{view ? "Đóng" : "Hủy"}</Button>
          {!view && (
            <Button type="primary" loading={busy} onClick={() => void save()}>
              Lưu mẫu phiếu
            </Button>
          )}
        </Space>
      }
      style={{ top: 20 }}
      destroyOnHidden
    >
      <label className="grading-field">
        Tên mẫu phiếu
        <Input
          aria-label="Tên mẫu phiếu"
          maxLength={120}
          disabled={readOnly}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
        />
      </label>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "preview",
            label: "Xem trước phiếu",
            children: (
              <div
                className="template-generated"
                dangerouslySetInnerHTML={{
                  __html: sheetSvg({
                    title: name || "Mẫu phiếu",
                    subject,
                    groups,
                  }),
                }}
              />
            ),
          },
          {
            key: "calibrate",
            label: "Căn chỉnh ô tô",
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="Dùng ảnh phiếu trống, có bốn dấu vuông ở góc."
                  description="Bước 1: chọn tâm bốn dấu vuông theo thứ tự trên trái → trên phải → dưới phải → dưới trái của phiếu. Bước 2: thêm từng vùng ô tô. Bốn điểm vùng là tâm ô đầu/trên trái, cuối/trên phải, cuối/dưới phải, đầu/dưới trái. Với một dòng, chọn khung mỏng bao dòng đó."
                />
                {!view && (
                  <>
                    <label className="grading-field">
                      Chọn ảnh phiếu để căn chỉnh (chỉ mở tạm trên máy)
                      <input
                        type="file"
                        accept="image/*"
                        aria-label="Ảnh phiếu căn chỉnh"
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const image = await compressPaper(file);
                            setPhoto(URL.createObjectURL(image));
                            setCorners([]);
                            setPicks([]);
                            setMode("corners");
                            setDirty(true);
                          } catch (err) {
                            message.error((err as Error).message);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <Space wrap style={{ margin: "12px 0" }}>
                      <Button
                        disabled={!photo}
                        onClick={() => {
                          setCorners([]);
                          setPicks([]);
                          setMode("corners");
                        }}
                      >
                        Chọn lại bốn dấu định vị
                      </Button>
                      <Select
                        aria-label="Dạng câu hỏi trong vùng"
                        value={part}
                        onChange={(v) => {
                          setPart(v);
                          setCount(v === "multipleChoice" ? 10 : 1);
                        }}
                        options={[
                          {
                            value: "multipleChoice",
                            label: "Chọn một đáp án A–D",
                          },
                          {
                            value: "trueFalse",
                            label: "Đúng hoặc sai (bốn ý/câu)",
                          },
                          {
                            value: "shortAnswer",
                            label: "Trả lời ngắn (bốn cột chữ số)",
                          },
                        ]}
                      />
                      <label>
                        Câu bắt đầu{" "}
                        <InputNumber
                          aria-label="Câu bắt đầu vùng"
                          min={1}
                          max={40}
                          value={start}
                          onChange={(v) => setStart(v ?? 1)}
                        />
                      </label>
                      <label>
                        Số câu trong vùng{" "}
                        <InputNumber
                          aria-label="Số câu trong vùng"
                          min={1}
                          max={
                            part === "shortAnswer"
                              ? 1
                              : part === "trueFalse"
                                ? 8
                                : 40
                          }
                          value={count}
                          onChange={(v) => setCount(v ?? 1)}
                        />
                      </label>
                      <label>
                        Bán kính ô (%){" "}
                        <InputNumber
                          aria-label="Bán kính ô"
                          min={0.1}
                          max={3.5}
                          step={0.1}
                          value={radius}
                          onChange={(v) => setRadius(v ?? 0.8)}
                        />
                      </label>
                      <Button
                        disabled={!photo || corners.length !== 4}
                        onClick={() => {
                          setPicks([]);
                          setMode("block");
                        }}
                      >
                        Chọn bốn góc vùng ô tô
                      </Button>
                      <Button
                        type="primary"
                        disabled={picks.length !== 4 || corners.length !== 4}
                        onClick={() => {
                          try {
                            const inverse = homography(corners, UNIT_CORNERS),
                              block = gridBlock(
                                part,
                                start,
                                count,
                                picks.map((p) => project(inverse, p)),
                                radius / 100,
                                radius / 145,
                              );
                            setGroups((old) => [
                              ...old.filter(
                                (g) => !block.some((b) => b.key === g.key),
                              ),
                              ...block,
                            ]);
                            setDirty(true);
                            setMode("none");
                            setPicks([]);
                            message.success(
                              "Đã thêm vùng ô tô và thay vị trí các câu tương ứng.",
                            );
                          } catch (e) {
                            message.error((e as Error).message);
                          }
                        }}
                      >
                        Thêm vùng ô tô
                      </Button>
                      <Popconfirm
                        title="Xóa toàn bộ vị trí ô để tạo mẫu trống?"
                        okText="Tạo mẫu trống"
                        cancelText="Hủy"
                        onConfirm={() => {
                          setGroups([]);
                          setDirty(true);
                        }}
                      >
                        <Button danger>Tạo từ bố cục trống</Button>
                      </Popconfirm>
                    </Space>
                  </>
                )}
                {photo ? (
                  <>
                    <p>
                      <strong>
                        {mode === "corners"
                          ? `Đang chọn dấu định vị: ${corners.length}/4`
                          : mode === "block"
                            ? `Đang chọn góc vùng ô tô: ${picks.length}/4`
                            : "Đã căn chỉnh. Kiểm tra các vòng xanh có trùng ô trên ảnh."}
                      </strong>
                    </p>
                    <div
                      className="template-reference"
                      onClick={(e) => {
                        if (view || mode === "none") return;
                        const rect = e.currentTarget.getBoundingClientRect(),
                          p = {
                            x: (e.clientX - rect.left) / rect.width,
                            y: (e.clientY - rect.top) / rect.height,
                          };
                        if (mode === "corners")
                          setCorners((old) =>
                            old.length < 4 ? [...old, p] : old,
                          );
                        else
                          setPicks((old) =>
                            old.length < 4 ? [...old, p] : old,
                          );
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="Phiếu tham chiếu đang căn chỉnh" />
                      <svg
                        viewBox="0 0 1000 1000"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {corners.length === 4 &&
                          overlay.map(({ group, points }) =>
                            points.map((p, i) => (
                              <ellipse
                                key={`${group.key}:${i}`}
                                cx={p.x * 1000}
                                cy={p.y * 1000}
                                rx={
                                  group.rx *
                                  1000 *
                                  Math.abs(corners[1].x - corners[0].x)
                                }
                                ry={
                                  group.ry *
                                  1000 *
                                  Math.abs(corners[3].y - corners[0].y)
                                }
                                fill="none"
                                stroke="#078c46"
                                strokeWidth="1.4"
                              />
                            )),
                          )}
                        {[...corners, ...picks].map((p, i) => (
                          <g key={i}>
                            <circle
                              cx={p.x * 1000}
                              cy={p.y * 1000}
                              r={5}
                              fill={i < 4 ? "#d62c2c" : "#ffb000"}
                            />
                            <text
                              x={p.x * 1000 + 8}
                              y={p.y * 1000}
                              fill="#d62c2c"
                              fontSize="18"
                            >
                              {i < 4 ? i + 1 : i - 3}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </>
                ) : (
                  <p className="muted">
                    Mở ảnh phiếu trống để căn chỉnh một bố cục khác. Ảnh này sẽ
                    được bỏ khi đóng cửa sổ.
                  </p>
                )}
              </>
            ),
          },
          {
            key: "groups",
            label: `Vị trí câu hỏi (${groups.length})`,
            children: (
              <Table<BubbleGroup>
                rowKey="key"
                size="small"
                dataSource={groups}
                pagination={{ pageSize: 15 }}
                columns={[
                  { title: "Câu hỏi", render: (_, g) => groupLabel(g.key) },
                  { title: "Các ô", render: (_, g) => g.labels.join(" · ") },
                  {
                    title: "Thao tác",
                    render: (_, g) =>
                      !readOnly && (
                        <Button
                          danger
                          size="small"
                          onClick={() => {
                            setGroups((old) =>
                              old.filter((p) => p.key !== g.key),
                            );
                            setDirty(true);
                          }}
                        >
                          Xóa dòng ô
                        </Button>
                      ),
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </Modal>
  );
}
