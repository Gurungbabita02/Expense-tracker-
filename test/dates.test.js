import { describe, it, expect } from 'vitest';
import { occurrence, firstIndexAfter, isISODate, shiftMonth, localISO, addDays, daysBetween } from '../lib/dates';

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-99-99')).toBe(false);
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate(20260101)).toBe(false);
  });
  it('localISO uses the local calendar day, not UTC', () => {
    expect(localISO(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(localISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
  });
  it('monthly occurrences keep the anchor day and clamp to month end', () => {
    const got = [0, 1, 2, 3, 4].map((n) => occurrence('2026-01-31', 'monthly', n));
    expect(got).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(occurrence('2026-01-15', 'monthly', 12)).toBe('2027-01-15');
  });
  it('weekly and yearly occurrences', () => {
    expect(occurrence('2026-10-14', 'weekly', 3)).toBe('2026-11-04');
    expect(occurrence('2024-02-29', 'yearly', 1)).toBe('2025-02-28');
    expect(occurrence('2024-02-29', 'yearly', 4)).toBe('2028-02-29');
  });
  it('firstIndexAfter finds the next occurrence', () => {
    expect(firstIndexAfter('2026-01-10', 'monthly', '2026-03-10')).toBe(3);
    expect(firstIndexAfter('2026-01-10', 'monthly', '2026-03-10', true)).toBe(2);
    expect(firstIndexAfter('2026-05-01', 'weekly', '2026-01-01')).toBe(0);
  });
  it('addDays / daysBetween', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
  });
});
