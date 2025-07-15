import React from 'react';

export const metadata = {
  title: 'Dashboard | Learnology AI',
  description: 'Your personalized learning dashboard on Learnology AI. Track progress, access courses, and manage your AI-powered education.',
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