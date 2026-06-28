type ScanFrameOverlayProps = {
    accent?: 'teal' | 'gold';
};

/** Original scan guide — dimmed edges + centered frame */
export function ScanFrameOverlay({ accent = 'teal' }: ScanFrameOverlayProps) {
    const frameClass =
        accent === 'gold'
            ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]'
            : 'border-teal-400';
    const scanLineClass = accent === 'gold' ? 'bg-yellow-200' : 'bg-red-500';

    return (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-[40px] border-black/50">
            <div className={`relative h-64 w-64 rounded-xl border-4 ${frameClass}`}>
                <div className="absolute inset-0 animate-pulse border-2 border-white/20" />
                <div className={`absolute top-1/2 h-0.5 w-full animate-ping ${scanLineClass}`} />
            </div>
        </div>
    );
}
