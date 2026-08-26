'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/query-client';
import { ThemeProvider } from '../../components/providers/theme-provider';
import { AuthProvider } from '../../components/providers/auth-provider';
import { AppShell } from '../../components/layout/app-shell';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
