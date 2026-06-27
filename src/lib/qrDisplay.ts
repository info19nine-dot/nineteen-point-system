/** Shared QR render size — store earn & member use must match for scanning distance */
export const QR_CANVAS_SIZE = 512;
export const QR_DISPLAY_PX = 240;

export const QR_CANVAS_STYLE = {
    width: QR_DISPLAY_PX,
    height: QR_DISPLAY_PX,
    display: 'block' as const,
    imageRendering: 'pixelated' as const,
};
