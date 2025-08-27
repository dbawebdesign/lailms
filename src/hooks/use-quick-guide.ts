import { create } from 'zustand';

interface QuickGuideStore {
  isOpen: boolean;
  openQuickGuide: () => void;
  closeQuickGuide: () => void;
  toggleQuickGuide: () => void;
}

export const useQuickGuide = create<QuickGuideStore>((set) => ({
  isOpen: false,
  openQuickGuide: () => set({ isOpen: true }),
  closeQuickGuide: () => set({ isOpen: false }),
  toggleQuickGuide: () => set((state) => ({ isOpen: !state.isOpen })),
}));

