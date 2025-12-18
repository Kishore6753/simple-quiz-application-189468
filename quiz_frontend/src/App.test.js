import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('renders start screen with difficulty and time selectors', () => {
  render(<App />);

  expect(screen.getByText(/Start a new run/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Quiz settings/i)).toBeInTheDocument();

  expect(screen.getByLabelText(/Difficulty/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Time per question/i)).toBeInTheDocument();

  expect(screen.getByRole('button', { name: /Start Quiz/i })).toBeInTheDocument();
});

test('starts quiz and shows timer prominently on question card', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  // Quiz progress indicator + timer
  expect(screen.getByText(/Question/i)).toBeInTheDocument();
  expect(screen.getByText(/s$/i)).toBeInTheDocument(); // e.g. "20s" in ring
  expect(screen.getByLabelText(/Time remaining/i)).toBeInTheDocument();
});

test('auto-advances when timer expires without an answer', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  // Select 15s to make test faster.
  await user.selectOptions(screen.getByLabelText(/Time per question/i), ['15']);
  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  // On question 1...
  expect(screen.getByText(/Question 1 of/i)).toBeInTheDocument();

  // Let timer expire.
  act(() => {
    jest.advanceTimersByTime(15000);
  });

  // Should move to question 2.
  expect(await screen.findByText(/Question 2 of/i)).toBeInTheDocument();
});
