import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../components/Header';
import type { AuthedUser } from '../types';

const mockUser: AuthedUser = {
  id: '123',
  google_id: 'g123',
  email: 'test@example.com',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.png',
};

describe('Header', () => {
  it('renders the app name and user info', () => {
    render(
      <Header
        user={mockUser}
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Outreach Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders all nav items', () => {
    render(
      <Header
        user={mockUser}
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Compose')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onNavigate with the correct page when a nav item is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <Header
        user={mockUser}
        currentPage="dashboard"
        onNavigate={onNavigate}
        onLogout={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Compose'));
    expect(onNavigate).toHaveBeenCalledWith('compose');
  });

  it('calls onLogout when the logout button is clicked', () => {
    const onLogout = vi.fn();
    render(
      <Header
        user={mockUser}
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onLogout={onLogout}
      />
    );

    fireEvent.click(screen.getByTitle('Logout'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('highlights the current page in the nav', () => {
    render(
      <Header
        user={mockUser}
        currentPage="settings"
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const settingsButton = screen.getByText('Settings');
    expect(settingsButton.className).toContain('text-blue-700');
  });
});
