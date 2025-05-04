"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface UIContextProps {
  isNavCollapsed: boolean;
  toggleNavCollapsed: () => void;
  isPanelVisible: boolean;
  togglePanelVisible: () => void;
  setPanelVisible: (isVisible: boolean) => void;
}

const UIContext = createContext<UIContextProps | undefined>(undefined);

export const UIContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false); // Default to hidden

  const toggleNavCollapsed = () => {
    setIsNavCollapsed(!isNavCollapsed);
  };

  const togglePanelVisible = () => {
    setIsPanelVisible(!isPanelVisible);
  };

  const setPanelVisible = (isVisible: boolean) => {
    setIsPanelVisible(isVisible);
  };

  return (
    <UIContext.Provider
      value={{
        isNavCollapsed,
        toggleNavCollapsed,
        isPanelVisible,
        togglePanelVisible,
        setPanelVisible,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUIContext must be used within a UIContextProvider");
  }
  return context;
}; 