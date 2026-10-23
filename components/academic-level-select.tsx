"use client";
import { Select, type SelectProps } from "antd";
import {
  academicLabel,
  academicOptions,
  academicTag,
  academicValue,
} from "@/lib/academic-tags";
import { useWorkspace } from "@/lib/store";
import StatusBadge from "./status-badge";

export default function AcademicLevelSelect({
  stage,
  value,
  onChange,
  ...props
}: Omit<SelectProps<string>, "options"> & { stage: "before" | "after" }) {
  const { data } = useWorkspace();
  const selected = value
    ? (academicTag(value, data.academicTags)?.id ?? academicValue(value))
    : undefined;
  const options = academicOptions(data.academicTags, stage, value ?? "");
  return (
    <Select<string>
      {...props}
      showSearch
      optionFilterProp="label"
      value={selected}
      onChange={onChange}
      options={options}
      labelRender={({ value: raw }) => {
        const tag = academicTag(String(raw), data.academicTags);
        return (
          <StatusBadge color={tag?.color ?? "#97671d"}>
            {academicLabel(String(raw), data.academicTags)}
          </StatusBadge>
        );
      }}
      optionRender={({ data: option }) => (
        <StatusBadge color={String(option.color)}>{option.label}</StatusBadge>
      )}
    />
  );
}
