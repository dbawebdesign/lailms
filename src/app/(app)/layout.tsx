import React from 'react';
import AppShell from "@/components/layout/AppShell";
import { UIContextProvider } from "@/context/UIContext";
import { LunaContextRegistration } from "@/components/providers/LunaContextRegistration";

export default function AppPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UIContextProvider>
      <LunaContextRegistration>
        <AppShell>{children}</AppShell>
      </LunaContextRegistration>
    </UIContextProvider>
  );
} 