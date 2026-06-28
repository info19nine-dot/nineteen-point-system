/** High-res canvas — keep crisp when scaled down for display */
export const QR_CANVAS_SIZE = 512;

/** Store earn QR on-screen size (CSS px) */
export const QR_EARN_DISPLAY_PX = 280;

/** Member use QR — same on-screen size as earn (no upscale) */
export const QR_USE_DISPLAY_PX = 280;

export function qrCanvasStyle(displayPx: number) {
    return {
        width: displayPx,
        height: displayPx,
        display: 'block' as const,
        imageRendering: 'pixelated' as const,
    };
}

export const QR_EARN_CANVAS_STYLE = qrCanvasStyle(QR_EARN_DISPLAY_PX);
export const QR_USE_CANVAS_STYLE = qrCanvasStyle(QR_USE_DISPLAY_PX);

/** @deprecated use QR_EARN_CANVAS_STYLE */
export const QR_CANVAS_STYLE = QR_EARN_CANVAS_STYLE;
