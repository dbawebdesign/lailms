import { ReactNode } from "react";
import { LunaContextProvider } from "@/context/LunaContextProvider";

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
      {children}
    </LunaContextProvider>
  );
} 