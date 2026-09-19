import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import DateField from '../src/components/common/DateField';
import { setCalendar } from '../src/services/calendarPreference';
import { mergeDetectedPlace } from '../src/components/address/NepalAddressFields';

const Harness = ({ onChange, initial = null }) => {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      label="Valid until"
      value={value}
      onChange={(next) => { setValue(next); onChange(next); }}
      years={[2026, 2027, 2028]}
    />
  );
};

const choose = (screen, field, option) => {
  fireEvent.press(screen.getByLabelText(`Valid until, ${field}`));
  fireEvent.press(screen.getByLabelText(option));
};

afterEach(async () => { await act(() => setCalendar('ad')); });

describe('DateField', () => {
  it('picks an AD date and reports it as YYYY-MM-DD', () => {
    const onChange = jest.fn();
    const screen = render(<Harness onChange={onChange} />);

    choose(screen, 'year', '2027');
    choose(screen, 'month', 'Feb');
    choose(screen, 'day', '9');

    expect(onChange).toHaveBeenLastCalledWith('2027-02-09');
  });

  it('picks in the Nepali calendar but still reports the AD day', async () => {
    await act(() => setCalendar('bs'));
    const onChange = jest.fn();
    const screen = render(<Harness onChange={onChange} />);

    choose(screen, 'year', '2083');
    choose(screen, 'month', 'Baisakh');
    choose(screen, 'day', '1');

    // 1 Baisakh 2083 is 14 April 2026.
    expect(onChange).toHaveBeenLastCalledWith('2026-04-14');
  });

  it('shows an existing AD value in the chosen calendar', async () => {
    await act(() => setCalendar('bs'));
    const screen = render(<Harness onChange={jest.fn()} initial="2026-09-19" />);

    expect(screen.getByText('2083')).toBeTruthy();
    expect(screen.getByText('Ashwin')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('switches calendar from the toggle without changing the date', async () => {
    const onChange = jest.fn();
    const screen = render(<Harness onChange={onChange} initial="2026-09-19" />);
    expect(screen.getByText('Sep')).toBeTruthy();

    await act(async () => { fireEvent.press(screen.getByLabelText('Nepali calendar (BS)')); });

    expect(screen.getByText('Ashwin')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('mergeDetectedPlace', () => {
  const current = { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101', ward: 4, tole: 'Old' };
  const detected = { place: { provinceId: 'NP03', districtId: 'NP0327', localLevelId: 'NP0327101' }, ward: null, areaName: null };

  it('uses the ward found from the location', () => {
    expect(mergeDetectedPlace(current, { ...detected, ward: 26, areaName: 'Basantapur' })).toMatchObject({ ward: 26, tole: 'Basantapur' });
  });

  it('keeps the chosen ward in the same municipality when none was found, and drops it in another', () => {
    expect(mergeDetectedPlace(current, detected).ward).toBe(4);
    expect(mergeDetectedPlace({ ...current, localLevelId: 'other' }, detected).ward).toBeNull();
  });
});
