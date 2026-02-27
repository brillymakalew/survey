export default function LogoOverlay() {

    // Logos are now globally visible as requested, even on /admin

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo/british_council.png"
                alt="British Council"
                className="absolute top-4 left-4 md:top-6 md:left-8 h-8 md:h-12 w-auto object-contain drop-shadow-lg"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-6 flex items-center justify-center gap-4 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/logo-rtt-2.png"
                    alt="Binus Research"
                    className="h-7 md:h-10 w-auto object-contain drop-shadow-lg"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo/binus_heal.png"
                    alt="Heal"
                    className="h-7 md:h-10 w-auto object-contain drop-shadow-lg"
                />
            </div>
        </div>
    );
}
