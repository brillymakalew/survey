import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Indonesia-UK Research Translation Forum | Questionnaire',
    description:
        'Multi-phase questionnaire on research translation pathways for the Indonesia-UK Research Translation Forum.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={`${inter.className} relative min-h-screen`}>
                <div className="relative z-10">
                    {children}
                </div>
            </body>
        </html>
    );
}
