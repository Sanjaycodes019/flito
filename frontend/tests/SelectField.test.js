import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SelectField from '../src/components/common/SelectField';

const DISTRICTS = [
  'Achham', 'Arghakhanchi', 'Baglung', 'Baitadi', 'Bajhang', 'Bajura',
  'Banke', 'Bara', 'Bardiya', 'Bhaktapur', 'Bhojpur', 'Chitwan',
].map((name) => ({ value: name, label: name, keywords: name === 'Chitwan' ? ['Chitawan'] : [] }));

// The parent re-renders on every change, as a real form does, which is what
// used to disturb the open dialog.
const Harness = ({ onChange }) => {
  const [value, setValue] = useState(null);
  return (
    <SelectField
      label="District"
      value={value}
      options={DISTRICTS}
      onChange={(next) => { setValue(next); onChange(next); }}
    />
  );
};

describe('SelectField', () => {
  it('searches a long list by name or alias while the dialog stays open', () => {
    const onChange = jest.fn();
    const screen = render(<Harness onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('District'));
    const search = screen.getByPlaceholderText('Search district');

    fireEvent.changeText(search, 'baj');
    expect(screen.getByLabelText('Bajhang')).toBeTruthy();
    expect(screen.getByLabelText('Bajura')).toBeTruthy();
    expect(screen.queryByLabelText('Achham')).toBeNull();

    // Another spelling finds the same place, and the search box is still there.
    fireEvent.changeText(screen.getByPlaceholderText('Search district'), 'chitawan');
    fireEvent.press(screen.getByLabelText('Chitwan'));

    expect(onChange).toHaveBeenCalledWith('Chitwan');
    expect(screen.getByLabelText('District, Chitwan')).toBeTruthy();
  });

  it('says when nothing matches', () => {
    const screen = render(<Harness onChange={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('District'));
    fireEvent.changeText(screen.getByPlaceholderText('Search district'), 'zzz');

    expect(screen.getByText('No matches. Try a different spelling.')).toBeTruthy();
  });
});
