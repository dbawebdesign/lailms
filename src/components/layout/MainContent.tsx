"use client";

import React from 'react';
import { usePathname } from 'next/navigation';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  // const pathname = usePathname();
  
  // Pages that should have no top padding (flush with header)
  // const noTopPaddingPages = ['/teach/gradebook', '/teach/base-classes'];
  // const shouldRemoveTopPadding = noTopPaddingPages.some(page => pathname?.startsWith(page));
  
  return (
    <main 
      id="main-content"
      className="h-full overflow-y-auto"
      role="main"
    >
      {children}
    </main>
  );
};

export default MainContent; 