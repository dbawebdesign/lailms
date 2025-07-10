"use client";

import { ReactNode } from "react";
import { LunaContextProvider } from "@/context/LunaContextProvider";
import dynamic from "next/dynamic";

// Dynamically import the action listener with no SSR
// This is needed because it uses BroadcastChannel which is only available in browsers
const LunaActionListener = dynamic(
  () => import("@/components/luna/LunaActionListener"),
  { ssr: false }
);

interface LunaContextRegistrationProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the application with the LunaContextProvider
 * This should be placed near the root of the component tree
 */
export function LunaContextRegistration({ children }: LunaContextRegistrationProps) {
  return (
    <LunaContextProvider>
      {/* The action listener is included but doesn't render any visible UI */}
      <LunaActionListener />
      {children}
    </LunaContextProvider>
  );
} 