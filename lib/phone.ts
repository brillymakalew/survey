/**
 * Phone Number Normalization Utility
 * PRD §5.3 — supports 0xxx, 62xxx, +62xxx variants with spaces/dashes.
 * Canonical format: 62xxxxxxxxxx
 */
export function normalizePhone(raw: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = raw.trim().replace(/[\s\-().]/g, '');

    // Remove leading +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    // Convert leading 08 → 628 (Indonesian mobile) for backward compatibility with existing users
    if (cleaned.startsWith('08')) {
        cleaned = '62' + cleaned.substring(1);
    }

    return cleaned;
}

/**
 * Validates a normalized phone number.
 * Must be at least 8 digits, ≤ 16 digits.
 */
export function isValidNormalizedPhone(normalized: string): boolean {
    if (!/^\d+$/.test(normalized)) return false;
    return normalized.length >= 8 && normalized.length <= 16;
}

export function validatePhone(raw: string): { valid: boolean; normalized: string; error?: string } {
    if (!raw || raw.trim() === '') {
        return { valid: false, normalized: '', error: 'Phone number is required.' };
    }
    const normalized = normalizePhone(raw);
    if (!isValidNormalizedPhone(normalized)) {
        return {
            valid: false,
            normalized,
            error: 'Please enter a valid phone number (min 8 digits, e.g. +44 7123 456789 or 0812 3456).',
        };
    }
    return { valid: true, normalized };
}
