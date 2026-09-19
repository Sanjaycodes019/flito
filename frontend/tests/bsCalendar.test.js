import { adToBs, bsToAd, daysInBsMonth, localizeDigits, BS_MAX_YEAR } from '../src/utils/bsCalendar';
import { formatDayKey } from '../src/utils/nepalDate';

describe('Bikram Sambat conversion', () => {
  it('converts known dates both ways', () => {
    expect(adToBs('2026-04-14')).toEqual({ year: 2083, month: 1, day: 1 });
    expect(adToBs('2026-09-19')).toEqual({ year: 2083, month: 6, day: 3 });
    expect(adToBs('2024-04-13')).toEqual({ year: 2081, month: 1, day: 1 });
    expect(adToBs('1943-04-14')).toEqual({ year: 2000, month: 1, day: 1 });
    expect(bsToAd(2083, 1, 1)).toBe('2026-04-14');
  });

  it('round-trips every day across several years', () => {
    for (let ms = Date.UTC(2024, 0, 1); ms < Date.UTC(2030, 0, 1); ms += 86400000) {
      const key = new Date(ms).toISOString().slice(0, 10);
      const bs = adToBs(key);
      expect(bsToAd(bs.year, bs.month, bs.day)).toBe(key);
    }
  });

  it('knows month lengths and rejects days that do not exist', () => {
    expect(daysInBsMonth(2083, 2)).toBeGreaterThanOrEqual(29);
    expect(bsToAd(2083, 1, 33)).toBeNull();
    expect(bsToAd(2083, 13, 1)).toBeNull();
    expect(bsToAd(1999, 1, 1)).toBeNull();
  });

  it('returns null outside the supported years', () => {
    expect(adToBs('1943-04-13')).toBeNull();
    expect(adToBs(`${BS_MAX_YEAR - 56 + 5}-01-01`)).toBeNull();
  });

  it('writes digits in Devanagari for Nepali', () => {
    expect(localizeDigits(2083, 'ne')).toBe('२०८३');
    expect(localizeDigits(2083, 'en')).toBe('2083');
  });
});

describe('formatDayKey', () => {
  it('shows a day in the chosen calendar', () => {
    expect(formatDayKey('2026-09-19', { calendar: 'ad' })).toBe('19 Sep 2026');
    expect(formatDayKey('2026-09-19', { calendar: 'bs' })).toBe('3 Ashwin 2083');
    expect(formatDayKey('2026-09-19', { calendar: 'bs', withYear: false })).toBe('3 Ashwin');
  });

  it('falls back to AD outside the BS range', () => {
    expect(formatDayKey('2100-01-01', { calendar: 'bs' })).toBe('1 Jan 2100');
  });
});
