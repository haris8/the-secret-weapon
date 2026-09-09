import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Secret Weapon', description: 'Manage tasks and notes with priority tags, context filters, and weekly reviews.', icons: { icon: '/favicon.svg', apple: '/icon-192.png' } };
export const viewport = { width:'device-width', initialScale:1, themeColor:'#152b26' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" /></head><body>{children}</body></html>; }
