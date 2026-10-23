"use client";
import { createContext, useContext } from "react";
import type { AppUser } from "@/lib/access";
const Context = createContext<AppUser | null>(null);
export function AuthProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return <Context.Provider value={user}>{children}</Context.Provider>;
}
export function useUser() {
  const user = useContext(Context);
  if (!user) throw new Error("Bạn chưa đăng nhập.");
  return user;
}
