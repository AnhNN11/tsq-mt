"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { roleLabel, type AppUser } from "@/lib/access";
import { validateAccount, type AccountInput } from "@/lib/account-validation";
import { normalize, SUBJECTS } from "@/lib/model";
import { useUser } from "./auth-context";
type Account = AppUser & { active: boolean };
export default function AccountManager() {
  const user = useUser();
  const { message } = App.useApp();
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Account> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUsers(result.users);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function submit(method: string, values: unknown) {
    const response = await fetch("/api/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Chưa cập nhật được tài khoản.");
    await load();
  }
  async function save(values: AccountInput) {
    setBusy(true);
    try {
      const input = validateAccount(values, !editing?.username);
      await submit(editing?.username ? "PATCH" : "POST", input);
      setEditing(null);
      message.success("Đã lưu tài khoản.");
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function disable(username: string) {
    try {
      await submit("DELETE", { username });
      message.success("Đã ngừng sử dụng tài khoản.");
    } catch (e) {
      message.error((e as Error).message);
    }
  }
  return (
    <>
      <p className="section-description">
        Admin quản lý toàn bộ; phó khoa quản lý cả hai môn; giáo viên đánh giá
        môn được giao. Ngừng sử dụng tài khoản giữ lại lịch sử đánh giá và có
        thể kích hoạt lại.
      </p>
      {error && <Alert type="error" title={error} showIcon />}
      <div className="table-toolbar">
        <Input
          aria-label="Tìm tài khoản"
          placeholder="Tìm tên hoặc tài khoản…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 330 }}
        />
        <Space>
          <Button
            icon={<ReloadOutlined aria-hidden />}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined aria-hidden />}
            onClick={() =>
              setEditing({
                role: "teacher",
                active: true,
                subjects: ["Tin học"],
              })
            }
          >
            Tạo tài khoản
          </Button>
        </Space>
      </div>
      <Table<Account>
        rowKey="username"
        size="small"
        loading={loading}
        dataSource={users.filter((u) =>
          normalize(`${u.name} ${u.username}`).includes(normalize(query)),
        )}
        pagination={{ pageSize: 12, showTotal: (n) => `${n} tài khoản` }}
        scroll={{ x: 880 }}
        columns={[
          {
            title: "HỌ TÊN",
            dataIndex: "name",
            render: (name) => <strong>{name}</strong>,
          },
          { title: "TÀI KHOẢN", dataIndex: "username" },
          {
            title: "VAI TRÒ",
            dataIndex: "role",
            filters: ["admin", "manager", "teacher"].map((role) => ({
              text: roleLabel(role as AppUser["role"]),
              value: role,
            })),
            onFilter: (value, row) => row.role === value,
            render: (role: AppUser["role"]) => (
              <Tag
                color={
                  role === "admin"
                    ? "red"
                    : role === "manager"
                      ? "gold"
                      : "green"
                }
              >
                {roleLabel(role)}
              </Tag>
            ),
          },
          {
            title: "MÔN PHỤ TRÁCH",
            render: (_, u) =>
              u.role === "teacher" ? u.subjects.join(", ") : "Cả hai môn",
          },
          {
            title: "TRẠNG THÁI",
            dataIndex: "active",
            filters: [
              { text: "Hoạt động", value: true },
              { text: "Ngừng sử dụng", value: false },
            ],
            onFilter: (value, row) => row.active === value,
            render: (active) => (
              <Tag color={active ? "green" : "default"}>
                {active ? "Hoạt động" : "Ngừng sử dụng"}
              </Tag>
            ),
          },
          {
            title: "",
            width: 88,
            fixed: "right",
            render: (_, u) => (
              <Space size={0}>
                <Button
                  type="text"
                  icon={<EditOutlined aria-hidden />}
                  aria-label={`Sửa tài khoản ${u.username}`}
                  onClick={() => setEditing(u)}
                />
                <Popconfirm
                  title={`Ngừng sử dụng ${u.username}?`}
                  description="Tài khoản không thể đăng nhập; các đánh giá vẫn được giữ lại."
                  onConfirm={() => disable(u.username)}
                  okText="Ngừng sử dụng"
                  cancelText="Hủy"
                >
                  <Button
                    type="text"
                    danger
                    disabled={!u.active || u.username === user.username}
                    icon={<DeleteOutlined aria-hidden />}
                    aria-label={`Ngừng sử dụng tài khoản ${u.username}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      {editing && (
        <AccountEditor
          account={editing}
          self={editing.username === user.username}
          busy={busy}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function AccountEditor({
  account,
  self,
  busy,
  onSave,
  onClose,
}: {
  account: Partial<Account>;
  self: boolean;
  busy: boolean;
  onSave: (values: AccountInput) => Promise<void>;
  onClose: () => void;
}) {
  const [form] = Form.useForm<AccountInput>();
  const role = Form.useWatch("role", form) ?? account.role;
  return (
    <Modal
      open
      title={account.username ? "Sửa tài khoản" : "Tạo tài khoản"}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Lưu tài khoản"
      cancelText="Hủy"
      confirmLoading={busy}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={account}
        onFinish={onSave}
      >
        <Form.Item
          name="name"
          label="Họ và tên giáo viên"
          rules={[
            { required: true, whitespace: true },
            { min: 2, max: 150 },
          ]}
        >
          <Input maxLength={150} />
        </Form.Item>
        <Form.Item
          name="username"
          label="Tên tài khoản"
          rules={[
            { required: true },
            {
              pattern: /^[a-z][a-z0-9._-]{2,49}$/,
              message:
                "3–50 ký tự không dấu, bắt đầu bằng chữ; chỉ gồm chữ, số, dấu . _ -",
            },
          ]}
        >
          <Input
            disabled={Boolean(account.username)}
            maxLength={50}
            autoComplete="off"
          />
        </Form.Item>
        {!account.username && (
          <Form.Item
            name="password"
            label="Mật khẩu ban đầu"
            rules={[
              { required: true },
              { min: 12, max: 128, message: "Cần 12–128 ký tự." },
              {
                pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
                message: "Mật khẩu cần có chữ và số.",
              },
            ]}
            extra="Chuyển mật khẩu cho giáo viên sau khi tạo; danh sách không hiển thị lại mật khẩu."
          >
            <Input.Password maxLength={128} autoComplete="new-password" />
          </Form.Item>
        )}
        <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
          <Select
            aria-label="Vai trò tài khoản"
            disabled={self}
            options={[
              { value: "admin", label: "Quản trị viên (admin)" },
              { value: "manager", label: "Phó khoa" },
              { value: "teacher", label: "Giáo viên" },
            ]}
          />
        </Form.Item>
        {role === "teacher" && (
          <Form.Item
            name="subjects"
            label="Môn phụ trách"
            rules={[
              {
                required: true,
                type: "array",
                min: 1,
                message: "Chọn ít nhất một môn.",
              },
            ]}
          >
            <Select
              mode="multiple"
              aria-label="Môn phụ trách"
              options={SUBJECTS.map((value) => ({ value, label: value }))}
            />
          </Form.Item>
        )}
        <Form.Item
          name="active"
          label="Cho phép sử dụng"
          valuePropName="checked"
        >
          <Switch disabled={self} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
