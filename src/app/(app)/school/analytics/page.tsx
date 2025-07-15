'use client';
import Image from 'next/image';
export default function SchoolAnalyticsComingSoon() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Image
        src="/Horizontal white text.png"
        alt="Learnology AI"
        width={240}
        height={60}
        className="h-16 w-auto mb-8"
      />
      <h1 className="text-3xl font-bold text-center text-foreground mb-4">School Analytics Coming Soon</h1>
      <p className="text-lg text-muted-foreground text-center max-w-md">
        We’re working hard to bring you powerful analytics and insights. Stay tuned for updates!
      </p>
    </div>
  );
} 