import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IRONLOOM | AI Software Engineering OS',
  description: 'Collaborating specialized AI agents with human-in-the-loop governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
