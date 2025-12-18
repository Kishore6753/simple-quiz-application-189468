/* eslint-disable no-underscore-dangle */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Provide a default RNG seed for deterministic tests.
// Individual test files can override window.__TEST_RANDOM_SEED__ in beforeEach if needed.
if (typeof window !== 'undefined' && typeof window.__TEST_RANDOM_SEED__ !== 'number') {
  window.__TEST_RANDOM_SEED__ = 20251218; // default deterministic seed for CI
}
