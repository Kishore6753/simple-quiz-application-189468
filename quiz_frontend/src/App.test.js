import { render, screen } from '@testing-library/react';
import App from './App';

test('renders quiz progress indicator', () => {
  render(<App />);
  expect(screen.getByText(/Question/i)).toBeInTheDocument();
});
