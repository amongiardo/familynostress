import type { Metadata } from 'next';
import localFont from 'next/font/local';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import { QueryProvider } from '@/lib/QueryProvider';

const nunito = localFont({
  src: [
    {
      path: './fonts/nunito/nunito-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/nunito/nunito-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/nunito/nunito-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/nunito/nunito-latin-800-normal.woff2',
      weight: '800',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Family Planner',
  description: 'Piano pasti familiare con suggerimenti intelligenti',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className={nunito.variable}>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
