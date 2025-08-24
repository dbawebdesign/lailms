'use client';

import { useEffect, useState } from 'react';
import QuickGuideModal from './QuickGuideModal';
import { useQuickGuide } from '@/hooks/use-quick-guide';

export function QuickGuideProvider() {
  const { isOpen, closeQuickGuide } = useQuickGuide();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render on client side to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return <QuickGuideModal isOpen={isOpen} onClose={closeQuickGuide} />;
}
