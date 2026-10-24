import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the orbit simulation controls', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: /run simulation/i })).toBeInTheDocument();
});
