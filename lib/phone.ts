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

    // Convert leading 0 → 62
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }

    // Ensure it starts with 62 if just digits entered without prefix
    if (!cleaned.startsWith('62') && cleaned.length >= 9) {
        cleaned = '62' + cleaned;
    }

    return cleaned;
}

/**
 * Validates a normalized Indonesian phone number.
 * Must be: 62 + at least 8 digits (total ≥ 10, ≤ 15 per PRD §5.3.3)
 */
export function isValidNormalizedPhone(normalized: string): boolean {
    if (!/^\d+$/.test(normalized)) return false;
    return normalized.startsWith('62') && normalized.length >= 10 && normalized.length <= 15;
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
            error: 'Please enter a valid Indonesian phone number (e.g. 0812 3456 7890).',
        };
    }
    return { valid: true, normalized };
}
