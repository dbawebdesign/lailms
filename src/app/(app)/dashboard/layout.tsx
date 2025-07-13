import React from 'react';

export const metadata = {
  title: 'Dashboard | Learnology AI',
  description: 'Your learning dashboard and overview',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
} 