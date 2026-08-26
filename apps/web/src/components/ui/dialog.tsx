'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

export function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a Dialog');
  }
  return context;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
}: DialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  // If title was passed directly, render legacy self-contained dialog layout
  if (title) {
    return (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
            onClick={() => onOpenChange(false)}
          />
          <div
            className={cn(
              'relative z-50 w-full rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150',
              maxWidth,
            )}
          >
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <X className="h-4 w-4 text-slate-400" />
              <span className="sr-only">Close</span>
            </button>

            <div className="flex flex-col space-y-1.5 text-left mb-5">
              <h2 className="text-lg font-semibold leading-none tracking-tight text-white">{title}</h2>
              {description && <p className="text-sm text-slate-400">{description}</p>}
            </div>

            {children}
          </div>
        </div>
      </DialogContext.Provider>
    );
  }

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    </DialogContext.Provider>
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { onOpenChange } = useDialog();

  return (
    <div
      className={cn(
        'relative z-50 w-full rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150 text-slate-100',
        className,
      )}
    >
      <button
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none text-slate-400 hover:text-white"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-left mb-4', className)}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight text-white', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn('text-sm text-slate-400', className)}>
      {children}
    </p>
  );
}
