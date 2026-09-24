import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../components/Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when toast is null', () => {
    const { container } = render(<Toast toast={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the message for a success toast', () => {
    render(<Toast toast={{ message: 'Campaign created', type: 'success' }} />);
    expect(screen.getByText('Campaign created')).toBeInTheDocument();
  });

  it('renders the message for an error toast', () => {
    render(<Toast toast={{ message: 'Something failed', type: 'error' }} />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('renders the message for an info toast', () => {
    render(<Toast toast={{ message: 'Heads up', type: 'info' }} />);
    expect(screen.getByText('Heads up')).toBeInTheDocument();
  });
});
