import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication - Learnology AI",
  description: "Sign in or sign up to Learnology AI",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // AuthLayout should not render <html> or <body> tags.
  // These are handled by the root layout.
  // We apply styling to a wrapper div instead.
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {children}
    </div>
  );
} 