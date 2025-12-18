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

test('renders start screen with settings including Shuffle and Adaptive Mode toggles', () => {
  render(<App />);

  expect(screen.getByText(/Start a new run/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Quiz settings/i)).toBeInTheDocument();

  // Difficulty label exists (may be "Difficulty" or "Initial difficulty" depending on Adaptive toggle)
  expect(screen.getByLabelText(/Difficulty|Initial difficulty/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Time per question/i)).toBeInTheDocument();

  expect(screen.getByLabelText(/Shuffle/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Adaptive Mode/i)).toBeInTheDocument();

  // Defaults
  expect(screen.getByLabelText(/Shuffle/i)).toBeChecked();
  expect(screen.getByLabelText(/Adaptive Mode/i)).not.toBeChecked();

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

test('tracks streak and awards 5-in-a-row badge (deterministic with shuffle off)', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  // Turn off shuffle for deterministic question order + options order.
  await user.click(screen.getByLabelText(/Shuffle/i));
  expect(screen.getByLabelText(/Shuffle/i)).not.toBeChecked();

  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  // Answer all 5 questions correctly (based on the fixed seed data in App.js).
  // Q1: correct is "<script>" (index 2)
  await user.click(screen.getByRole('radio', { name: '<script>' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  // Q2: correct is "useState"
  await user.click(screen.getByRole('radio', { name: 'useState' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  // Q3: correct is "font-size"
  await user.click(screen.getByRole('radio', { name: 'font-size' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  // Q4: correct is "JavaScript Object Notation"
  await user.click(screen.getByRole('radio', { name: 'JavaScript Object Notation' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  // Q5: correct is "An architectural style for web services"
  await user.click(screen.getByRole('radio', { name: 'An architectural style for web services' }));
  await user.click(screen.getByRole('button', { name: /Finish/i }));

  expect(await screen.findByText(/Quiz Complete/i)).toBeInTheDocument();

  // Badge should appear (earned at streak >= 5).
  expect(screen.getByText(/5-in-a-row/i)).toBeInTheDocument();

  // Best streak should be 5 in summary.
  expect(screen.getByText('Best streak')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('awards Perfect Score badge on a perfect run (deterministic with shuffle off)', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  // Turn off shuffle for deterministic order.
  await user.click(screen.getByLabelText(/Shuffle/i));

  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  await user.click(screen.getByRole('radio', { name: '<script>' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  await user.click(screen.getByRole('radio', { name: 'useState' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  await user.click(screen.getByRole('radio', { name: 'font-size' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  await user.click(screen.getByRole('radio', { name: 'JavaScript Object Notation' }));
  await user.click(screen.getByRole('button', { name: /Next/i }));

  await user.click(screen.getByRole('radio', { name: 'An architectural style for web services' }));
  await user.click(screen.getByRole('button', { name: /Finish/i }));

  expect(await screen.findByText(/Quiz Complete/i)).toBeInTheDocument();
  expect(screen.getByText(/Perfect Score/i)).toBeInTheDocument();
});
