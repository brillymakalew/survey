import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import LogoOverlay from '@/components/survey/LogoOverlay';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'UK-Indonesia Research Translation Forum | Questionnaire',
    description:
        'Multi-phase questionnaire on research translation pathways for the UK-Indonesia Research Translation Forum.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <LogoOverlay />
                <div className="relative z-10">
                    {children}
                </div>
            </body>
        </html>
    );
}
