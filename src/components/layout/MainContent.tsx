"use client";

import React from 'react';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  return (
    <main className="flex-1 p-6 overflow-y-auto" role="main">
      {children}
    </main>
  );
};

export default MainContent; 