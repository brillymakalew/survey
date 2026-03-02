export default function LogoOverlay() {
    return (
        <div className="mt-10 mb-4 flex items-center justify-center gap-4 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo/logo-rtt-2.png"
                alt="Binus Research"
                className="h-6 md:h-8 w-auto object-contain opacity-80"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/logo/binus_heal.png"
                alt="Heal"
                className="h-6 md:h-8 w-auto object-contain opacity-80"
            />
        </div>
    );
}
