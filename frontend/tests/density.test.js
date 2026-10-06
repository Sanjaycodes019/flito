import { spacing, type, iconSize, sizeOf, getDensity, applyDensity } from '../src/theme/tokens';
import { fitColumns } from '../src/components/common/ChoiceTile';

// Phones get a tighter set of spacing, type and icon sizes. The shared scale
// objects are changed in place, so every style that reads them picks it up.
describe('density', () => {
  afterEach(() => {
    applyDensity('regular');
  });

  it('starts regular and swaps the shared scales in place when it goes compact', () => {
    const sameSpacing = spacing;
    const sameBody = type.body;
    const regular = { lg: spacing.lg, body: type.body.fontSize, icon: iconSize.md };

    expect(getDensity()).toBe('regular');
    expect(applyDensity('compact')).toBe(true);

    expect(getDensity()).toBe('compact');
    // The same objects, new values.
    expect(spacing).toBe(sameSpacing);
    expect(type.body).toBe(sameBody);
    expect(spacing.lg).toBeLessThan(regular.lg);
    expect(type.body.fontSize).toBeLessThan(regular.body);
    expect(iconSize.md).toBeLessThan(regular.icon);
  });

  it('keeps text a user must read at 13px or more, and body text at 15px', () => {
    applyDensity('compact');
    expect(type.body.fontSize).toBeGreaterThanOrEqual(15);
    expect(type.small.fontSize).toBeGreaterThanOrEqual(13);
    expect(type.smallMedium.fontSize).toBeGreaterThanOrEqual(13);
  });

  it('shrinks buttons and inputs but keeps them tappable', () => {
    const regular = { ...sizeOf() };
    applyDensity('compact');
    const compact = sizeOf();

    expect(compact.buttonMd).toBeLessThan(regular.buttonMd);
    expect(compact.input).toBeLessThan(regular.input);
    // 36px plus the 8px hit slop on each side is still a 44px+ target.
    expect(compact.buttonSm + 16).toBeGreaterThanOrEqual(44);
  });

  it('returns to the regular values and reports no change when asked for the same density', () => {
    const regular = { lg: spacing.lg, h1: type.h1.fontSize };
    applyDensity('compact');

    expect(applyDensity('compact')).toBe(false);
    expect(applyDensity('regular')).toBe(true);
    expect(spacing.lg).toBe(regular.lg);
    expect(type.h1.fontSize).toBe(regular.h1);
    expect(applyDensity('nonsense')).toBe(false);
  });
});

describe('fitColumns', () => {
  it('shows the asked-for columns when there is room', () => {
    expect(fitColumns(4, 1280)).toBe(4);
    expect(fitColumns(3, 768)).toBe(3);
  });

  it('shows fewer on a narrow screen so labels are not split across lines', () => {
    expect(fitColumns(4, 375)).toBe(3);
    expect(fitColumns(4, 320)).toBe(2);
  });

  it('never goes below two across', () => {
    expect(fitColumns(3, 240)).toBe(2);
  });
});
