import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'The Secret Weapon', description: 'Capture your thoughts. Choose your next action. A private workspace for Getting Things Done.', manifest: '/manifest.webmanifest', icons: { icon: '/favicon.svg', apple: '/icon-192.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
