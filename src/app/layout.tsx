import type { Metadata, Viewport } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

// ─── Fonts ──────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

// ─── Metadata ───────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Easy Audio Generator',
  description:
    'Transform your documents into engaging Urdu audio conversations. Upload PDFs, DOCX, or text files and generate professional audio content powered by AI. Developed by Mr. Ali Athar — Accessible Life Interface.',
  keywords: ['audio generator', 'PDF to audio', 'Urdu audio', 'AI audio', 'text to speech'],
  authors: [{ name: 'Ali Athar' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Easy Audio Generator',
    description: 'Transform your documents into engaging Urdu audio conversations.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0a1e',
  width: 'device-width',
  initialScale: 1,
};

// ─── Root Layout ────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body
        className={`${inter.className} bg-[#0f0a1e] text-white antialiased min-h-screen`}
      >
        <AuthProvider>
          <main className="relative min-h-screen">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
