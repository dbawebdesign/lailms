"use client";

import React from 'react';
import { usePathname } from 'next/navigation';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const pathname = usePathname();
  
  // Pages that should have no top padding (flush with header)
  const noTopPaddingPages = ['/teach/gradebook', '/teach/base-classes'];
  const shouldRemoveTopPadding = noTopPaddingPages.some(page => pathname?.startsWith(page));
  
  return (
    <main 
      className={`flex-1 overflow-y-auto ${
        shouldRemoveTopPadding 
          ? 'px-2 pb-2 sm:px-4 sm:pb-4 md:px-6 md:pb-6' 
          : 'p-2 sm:p-4 md:p-6'
      }`} 
      role="main"
    >
      {children}
    </main>
  );
};

export default MainContent; 