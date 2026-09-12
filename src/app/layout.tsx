import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Germany Job Mission',
  description: 'A private command center for helping specific people find a real German job legally.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
