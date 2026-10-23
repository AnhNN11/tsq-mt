"use client";
import { Badge, Tag, type TagProps } from "antd";
import type { CSSProperties, ReactNode } from "react";
import {
  CodeOutlined,
  TranslationOutlined,
  SoundOutlined,
  TrophyOutlined,
  BgColorsOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { roleLabel, type Role } from "@/lib/access";
import type { TalentTag } from "@/lib/model";
const colors = {
  green: "#315b35",
  blue: "#265c9a",
  gold: "#97671d",
  red: "#ad343b",
  purple: "#755299",
  gray: "#637067",
};
type Props = {
  children: ReactNode;
  tone?: keyof typeof colors;
  color?: string;
  icon?: ReactNode;
  count?: number;
  variant?: "soft" | "outline" | "solid";
} & Pick<TagProps, "closable" | "onClose" | "onMouseDown">;
export default function StatusBadge({
  children,
  tone = "green",
  color,
  icon,
  count,
  variant = "soft",
  ...props
}: Props) {
  return (
    <Tag
      {...props}
      icon={icon}
      className={`app-badge app-badge-${variant}`}
      style={{ "--badge-color": color ?? colors[tone] } as CSSProperties}
    >
      <span>{children}</span>
      {count !== undefined && (
        <Badge
          count={count}
          showZero
          overflowCount={9999}
          color={color ?? colors[tone]}
        />
      )}
    </Tag>
  );
}
export function TalentBadge({
  tag,
  ...props
}: { tag: TalentTag } & Pick<
  TagProps,
  "closable" | "onClose" | "onMouseDown"
>) {
  const icons: Record<string, ReactNode> = {
    "Tin học": <CodeOutlined aria-hidden />,
    "Ngoại ngữ": <TranslationOutlined aria-hidden />,
    "Văn nghệ": <SoundOutlined aria-hidden />,
    "Thể thao": <TrophyOutlined aria-hidden />,
    "Mỹ thuật": <BgColorsOutlined aria-hidden />,
  };
  return (
    <StatusBadge
      {...props}
      color={tag.color}
      icon={icons[tag.category] ?? <StarOutlined aria-hidden />}
      variant={tag.category === "Tin học" ? "outline" : "soft"}
    >
      {tag.name}
    </StatusBadge>
  );
}
export function RoleBadge({ role }: { role: Role }) {
  return (
    <StatusBadge
      tone={role === "admin" ? "red" : role === "manager" ? "gold" : "green"}
      variant={role === "admin" ? "solid" : "soft"}
      icon={
        role === "admin" ? (
          <SafetyCertificateOutlined aria-hidden />
        ) : role === "manager" ? (
          <AuditOutlined aria-hidden />
        ) : (
          <UserOutlined aria-hidden />
        )
      }
    >
      {roleLabel(role)}
    </StatusBadge>
  );
}
