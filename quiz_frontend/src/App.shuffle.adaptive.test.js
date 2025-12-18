import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Ensure deterministic RNG for all tests in this file
beforeEach(() => {
  // Provide a fixed seed for deterministic randomness
  window.__TEST_RANDOM_SEED__ = 12345;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  delete window.__TEST_RANDOM_SEED__;
});

test('shuffle produces deterministic option order with seeded RNG', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  // Keep shuffle ON (default), start quiz
  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  // Capture the first question options order
  const radios = await screen.findAllByRole('radio');
  const optionLabels = radios.map((r) => r.textContent);

  // Expect a stable, specific order for the seeded run
  // We don't know the exact shuffled order upfront, but we can assert it remains consistent
  // by rendering a fresh instance with the same seed and comparing.
  // Render a second instance of <App /> without user interaction beyond starting.
  render(<App />);
  await user.click(screen.getAllByRole('button', { name: /Start Quiz/i })[1]);
  const radios2 = await screen.findAllByRole('radio');
  const optionLabels2 = radios2.map((r) => r.textContent);

  expect(optionLabels2).toEqual(optionLabels);
});

test('adaptive mode toggles label and shows recent accuracy ribbon', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  // Enable Adaptive Mode
  await user.click(screen.getByLabelText(/Adaptive Mode/i));
  expect(screen.getByLabelText(/Adaptive Mode/i)).toBeChecked();

  // Difficulty label becomes "Initial difficulty"
  expect(screen.getByLabelText(/Initial difficulty/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  // Ribbon shows accuracy section in adaptive mode
  expect(screen.getByLabelText(/Recent accuracy/i)).toBeInTheDocument();

  // Select an answer to update correctness window
  const radios = await screen.findAllByRole('radio');
  await user.click(radios[0]);
  await user.click(screen.getByRole('button', { name: /Next|Finish/i }));

  // Accuracy should appear as a percentage number or dash when insufficient data
  const accuracyNode = screen.getByLabelText(/Recent accuracy/i);
  expect(accuracyNode.textContent).toMatch(/Accuracy.*\d+%|—/);
});

// Validate auto-advance still works deterministically with seeded RNG in adaptive mode
test('adaptive + timer expiry still auto-advances deterministically', async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<App />);

  await user.click(screen.getByLabelText(/Adaptive Mode/i));
  await user.selectOptions(screen.getByLabelText(/Time per question/i), ['15']);
  await user.click(screen.getByRole('button', { name: /Start Quiz/i }));

  expect(screen.getByText(/Question 1 of/i)).toBeInTheDocument();

  // Let timer expire for Q1
  act(() => {
    jest.advanceTimersByTime(15000);
  });

  // Should be on Question 2
  expect(await screen.findByText(/Question 2 of/i)).toBeInTheDocument();
});
