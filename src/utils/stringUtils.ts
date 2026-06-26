/**
 * Converts full-width ASCII characters to half-width.
 * Useful for normalizing user input for IDs, emails, etc.
 */
export const toHalfWidth = (str: string): string => {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
};
