'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  React.useEffect(() => {
    const token = localStorage.getItem('ironloom_jwt');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground font-mono">Loading IRONLOOM Workspace...</p>
      </div>
    </div>
  );
}
