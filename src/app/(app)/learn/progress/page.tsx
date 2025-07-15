'use client';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
export default function ProgressComingSoon() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const logoSrc = mounted && resolvedTheme === 'dark'
    ? '/Horizontal white text.png'
    : '/Horizontal black text.png';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Image
        src={logoSrc}
        alt="Learnology AI"
        width={240}
        height={60}
        className="h-16 w-auto mb-8"
      />
      <h1 className="text-3xl font-bold text-center text-foreground mb-4">Progress Coming Soon</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        We’re working hard to bring you detailed progress tracking and insights. Stay tuned for updates!
      </p>
    </div>
  );
} 