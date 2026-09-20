import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import ErrorBoundary from '../src/components/common/ErrorBoundary';

let shouldThrow = true;
const Bomb = () => {
  if (shouldThrow) throw new Error('boom');
  return <Text>All good</Text>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows a recoverable message instead of crashing', () => {
    const onError = jest.fn();
    const { getByText, queryByText } = render(
      <ErrorBoundary onError={onError}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(queryByText('All good')).toBeNull();
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(onError).toHaveBeenCalled();

    shouldThrow = false;
    fireEvent.press(getByText('Try again'));
    expect(getByText('All good')).toBeTruthy();
  });

  it('renders children when nothing fails', () => {
    shouldThrow = false;
    const { getByText } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(getByText('All good')).toBeTruthy();
  });
});
