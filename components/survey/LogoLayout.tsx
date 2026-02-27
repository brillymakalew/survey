'use client';

import { usePathname } from 'next/navigation';

export default function LogoOverlay() {
    const pathname = usePathname();

    // Hide global floating logos on admin dashboard
    if (pathname?.startsWith('/admin')) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="w-full pt-4 md:pt-6 pl-4 md:pl-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/british_council.png"
                    alt="British Council"
                    className="h-8 md:h-12 w-auto object-contain drop-shadow-lg"
                />
            </header>

            <main className="flex-grow">
                <div id="survey-content-slot" />
            </main>

            <footer className="w-full py-6 mt-auto flex justify-center items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/logo-rtt-2.png"
                    alt="Binus Research"
                    className="h-5 md:h-8 w-auto object-contain drop-shadow-lg"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/binus_heal.png"
                    alt="Heal"
                    className="h-7 md:h-10 w-auto object-contain drop-shadow-lg"
                />
            </footer>
        </div>
    );
}
