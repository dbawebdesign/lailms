import { ReactNode } from "react";
import { UIContextProvider } from "@/context/UIContextProvider";

interface UIContextRegistrationProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the application with the UIContextProvider
 * This should be placed near the root of the component tree
 */
export function UIContextRegistration({ children }: UIContextRegistrationProps) {
  return (
    <UIContextProvider>
      {children}
    </UIContextProvider>
  );
} 