import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import { Footer, Nav } from '@/components/Nav';
import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { TournamentProvider } from '@/lib/data';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Smash Cup — Table Tennis & Badminton', template: '%s · Smash Cup' },
  description: 'Live draws, results and schedules for the Table Tennis and Badminton tournaments.',
};

export const viewport: Viewport = {
  themeColor: '#0f1d36',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col">
        <TournamentProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Nav />
              <main className="flex-1">{children}</main>
              <Footer />
            </ConfirmProvider>
          </ToastProvider>
        </TournamentProvider>
      </body>
    </html>
  );
}
