import { describe, it, expect } from 'vitest';
import { parsePriceValue, parseExpiryDate, normalizeUnitAndPack } from '../controllers/invoiceController.js';

describe('Purchase Invoice Excel Parser Helpers', () => {

    describe('parsePriceValue', () => {
        it('coerces "Free", "free", "FREE" strings to 0.00 decimal', () => {
            expect(parsePriceValue('Free')).toBe(0);
            expect(parsePriceValue('free')).toBe(0);
            expect(parsePriceValue('FREE')).toBe(0);
        });

        it('parses valid numeric prices and currencies correctly', () => {
            expect(parsePriceValue('12.50')).toBe(12.5);
            expect(parsePriceValue('OMR 4.250')).toBe(4.25);
            expect(parsePriceValue(15.75)).toBe(15.75);
        });

        it('defaults missing or invalid values to 0', () => {
            expect(parsePriceValue(null)).toBe(0);
            expect(parsePriceValue(undefined)).toBe(0);
            expect(parsePriceValue('N/A')).toBe(0);
        });
    });

    describe('parseExpiryDate', () => {
        it('formats string dates to DD-MM-YYYY', () => {
            const result = parseExpiryDate('25-12-2026');
            expect(result.formatted).toBe('25-12-2026');
            expect(result.date).toBeInstanceOf(Date);
        });

        it('parses slash date strings DD/MM/YYYY to DD-MM-YYYY', () => {
            const result = parseExpiryDate('15/08/2027');
            expect(result.formatted).toBe('15-08-2027');
        });

        it('parses Excel date serial numbers correctly', () => {
            // Excel serial date 46000 corresponds to approx 2025-12-10
            const result = parseExpiryDate(46000);
            expect(result.formatted).toMatch(/^\d{2}-\d{2}-\d{4}$/);
        });
    });

    describe('normalizeUnitAndPack', () => {
        it('normalizes hyphenated box descriptors (box - 8, BOX -8, box-8) to BOX-8 with multiplier 8', () => {
            const res1 = normalizeUnitAndPack('box - 8', 1);
            expect(res1.normalizedUnit).toBe('BOX-8');
            expect(res1.parsedMultiplier).toBe(8);

            const res2 = normalizeUnitAndPack('BOX -8', 10);
            expect(res2.normalizedUnit).toBe('BOX-8');
            expect(res2.parsedMultiplier).toBe(8);

            const res3 = normalizeUnitAndPack('box  -  24', 1);
            expect(res3.normalizedUnit).toBe('BOX-24');
            expect(res3.parsedMultiplier).toBe(24);
        });

        it('parses NOS variations case-insensitively with correct multipliers', () => {
            const nos1 = normalizeUnitAndPack('NOS', 1);
            expect(nos1.normalizedUnit).toBe('NOS');
            expect(nos1.parsedMultiplier).toBe(1);

            const nos10 = normalizeUnitAndPack('nos0', 1);
            expect(nos10.normalizedUnit).toBe('NOS0');
            expect(nos10.parsedMultiplier).toBe(10);

            const nos100 = normalizeUnitAndPack('NOS00', 1);
            expect(nos100.normalizedUnit).toBe('NOS00');
            expect(nos100.parsedMultiplier).toBe(100);
        });

        it('falls back to pack quantity multiplier if pack > 1', () => {
            const res = normalizeUnitAndPack('Box', 12);
            expect(res.normalizedUnit).toBe('Box');
            expect(res.parsedMultiplier).toBe(12);
        });
    });

});
