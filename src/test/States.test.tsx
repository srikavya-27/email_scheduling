import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, EmptyState, ErrorState } from '../components/States';

describe('Loading', () => {
  it('renders the default loading message', () => {
    render(<Loading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders a custom loading message', () => {
    render(<Loading message="Loading dashboard..." />);
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the title and message', () => {
    render(<EmptyState title="No emails" message="Your sent emails will appear here." />);
    expect(screen.getByText('No emails')).toBeInTheDocument();
    expect(screen.getByText('Your sent emails will appear here.')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Something broke" onRetry={onRetry} />);
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('does not render a retry button when onRetry is not provided', () => {
    render(<ErrorState message="Something broke" />);
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });
});
