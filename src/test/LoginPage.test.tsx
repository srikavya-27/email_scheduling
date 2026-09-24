import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginPage } from '../pages/LoginPage';

const noop = async () => {};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title and Google sign-in button', () => {
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    expect(screen.getByText('Email Outreach Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('shows email and password fields and sign-in button', () => {
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('calls onGoogleLogin when the Google button is clicked', () => {
    const onGoogleLogin = vi.fn(async () => {});
    render(
      <LoginPage
        onGoogleLogin={onGoogleLogin}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    fireEvent.click(screen.getByText('Continue with Google'));
    expect(onGoogleLogin).toHaveBeenCalledTimes(1);
  });

  it('shows an error when Google sign-in throws', async () => {
    const onGoogleLogin = vi.fn(async () => {
      throw new Error('Google sign-in is not enabled. Use email/password sign-in below.');
    });
    render(
      <LoginPage
        onGoogleLogin={onGoogleLogin}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    fireEvent.click(screen.getByText('Continue with Google'));
    await waitFor(() => {
      expect(screen.getByText(/Google sign-in is not enabled/)).toBeInTheDocument();
    });
  });

  it('toggles to sign-up mode when the toggle link is clicked', () => {
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    expect(screen.getByText('Create account')).toBeInTheDocument();
  });

  it('shows validation error when email/password are empty', () => {
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
  });

  it('shows validation error when password is too short', () => {
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={noop}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Password must be at least 6 characters.')).toBeInTheDocument();
  });

  it('calls onEmailSignIn when the form is submitted with valid input', () => {
    const onEmailSignIn = vi.fn(async () => {});
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={onEmailSignIn}
        onEmailSignUp={noop}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(onEmailSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('calls onEmailSignUp when in signup mode with valid input', () => {
    const onEmailSignUp = vi.fn(async () => {});
    render(
      <LoginPage
        onGoogleLogin={noop}
        onEmailSignIn={noop}
        onEmailSignUp={onEmailSignUp}
      />
    );

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('At least 6 characters'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Create account'));
    expect(onEmailSignUp).toHaveBeenCalledWith('new@example.com', 'password123');
  });
});
