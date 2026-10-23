"use client";
import { useEffect, useSyncExternalStore } from "react";
import {
  EMPTY_WORKSPACE,
  ensureClasses,
  parseWorkspace,
  validateWorkspace,
  type Workspace,
} from "./model";
type Snapshot = {
  data: Workspace;
  error: string;
  loading: boolean;
  revision: number;
  updatedAt: string;
  updatedBy: string;
};
const empty: Snapshot = {
  data: EMPTY_WORKSPACE,
  error: "",
  loading: true,
  revision: 0,
  updatedAt: "",
  updatedBy: "",
};
let snapshot = empty;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let fetching: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function refreshWorkspace() {
  if (fetching) return fetching;
  fetching = (async () => {
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) {
        window.location.assign(new URL("/login", window.location.origin).href);
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }
      if (!response.ok)
        throw new Error(result.error || "Không tải được dữ liệu.");
      const data = parseWorkspace(result.data);
      if (!data) throw new Error("Dữ liệu máy chủ chưa hợp lệ.");
      if (Number(result.revision) >= snapshot.revision)
        snapshot = { ...result, data, error: "", loading: false };
      emit();
    } catch (e) {
      snapshot = { ...snapshot, loading: false, error: (e as Error).message };
      emit();
    } finally {
      fetching = null;
    }
  })();
  return fetching;
}
export function useWorkspace() {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
  useEffect(() => {
    void refreshWorkspace();
    const refresh = () => {
      if (!document.hidden) void refreshWorkspace();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return value;
}
export function saveWorkspace(
  update: (current: Workspace) => Workspace,
  allowRecovery = false,
) {
  const operation = queue.then(async () => {
    if (snapshot.loading || fetching) await refreshWorkspace();
    if (snapshot.error && !allowRecovery) throw new Error(snapshot.error);
    const data = ensureClasses(update(snapshot.data));
    if (!validateWorkspace(data))
      throw new Error("Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.");
    const response = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, revision: snapshot.revision }),
    });
    const result = await response.json();
    if (response.status === 401)
      window.location.assign(new URL("/login", window.location.origin).href);
    if (!response.ok) {
      if (response.status === 409) await refreshWorkspace();
      throw new Error(result.error || "Chưa lưu được dữ liệu.");
    }
    if (Number(result.revision) >= snapshot.revision)
      snapshot = { ...result, loading: false, error: "" };
    emit();
  });
  queue = operation.catch(() => {});
  return operation;
}
export function rawBackup() {
  return JSON.stringify(snapshot.data, null, 2);
}
export async function migrateLegacyWorkspace() {
  const raw = localStorage.getItem("so-hoc-tro.workspace.v1");
  if (
    !raw ||
    snapshot.revision > 1 ||
    localStorage.getItem("mam-xanh-migrated")
  )
    return;
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      legacy: true,
      revision: snapshot.revision,
      data: JSON.parse(raw),
    }),
  });
  if (!response.ok)
    throw new Error(
      "Chưa chuyển được dữ liệu cũ. Bản cũ vẫn được giữ trên trình duyệt.",
    );
  localStorage.setItem("mam-xanh-migrated", "yes");
  await refreshWorkspace();
}
