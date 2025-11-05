import { create } from 'zustand';
import { useMemo } from 'react';

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, ...toast }]
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },
}));

export function useToast() {
  const { addToast } = useToastStore();

  return useMemo(() => ({
    success: (message, duration = 3000) => addToast({ type: 'success', message, duration }),
    error: (message, duration = 3000) => addToast({ type: 'error', message, duration }),
    warning: (message, duration = 3000) => addToast({ type: 'warning', message, duration }),
    info: (message, duration = 3000) => addToast({ type: 'info', message, duration }),
  }), [addToast]);
}

export { useToastStore };
