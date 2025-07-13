import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata = {
  title: "Authentication - Learnology AI",
  description: "Sign in or sign up to Learnology AI",
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // AuthLayout should not render <html> or <body> tags.
  // These are handled by the root layout.
  // We apply styling to a wrapper div instead.
  return (
    <ThemeProvider attribute="class" forcedTheme="dark">
      {/* This div will ensure Tailwind dark variants activate for children */}
      <div className="dark min-h-screen flex flex-col bg-background text-foreground">
        {/* bg-background and text-foreground should respect the dark theme via CSS variables */}
        {/* We can remove bg-black if the global dark theme handles it */}
        {/* For now, let's assume the theme itself sets the background */}
        {children}
      </div>
    </ThemeProvider>
  );
} 