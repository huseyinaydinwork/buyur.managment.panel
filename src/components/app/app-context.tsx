"use client";

import { createContext, useContext } from "react";
import type { Module } from "@/lib/permissions";

export type Option = { id: string; name: string };
export type AppData = {
  user: { id: string; name: string; email: string; role: string };
  users: { id: string; name: string; role: string }[];
  sources: Option[];
  campaigns: Option[];
  projects: { id: string; name: string; status: string }[];
  can: Record<Module, boolean>;
};

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}

/** Users that can own leads (sales + admins). */
export function useSellers() {
  const { users } = useAppData();
  return users.filter((u) => u.role === "SALES" || u.role === "ADMIN");
}
