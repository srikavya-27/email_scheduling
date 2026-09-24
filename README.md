# Email Outreach Scheduler

A web application for scheduling and managing email outreach campaigns with rate limiting, delivery tracking, and analytics.

## Features

- **Google & Email Authentication** — Sign in with Google OAuth or email/password via Supabase Auth.
- **Compose Campaigns** — Upload a CSV/TXT of recipients, set subject, body, start time, minimum delay between sends, and hourly rate limit.
- **Scheduled Emails** — View all upcoming email deliveries in a paginated table with status badges.
- **Sent Emails** — Track sent and failed deliveries with error details and preview links.
- **Dashboard** — Aggregate stats: total campaigns, emails sent, failed, scheduled, in-progress, and success rate.
- **Settings** — Manage sender rate limits (hourly limit, minimum delay) and Slack integration.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL database, Auth, Row Level Security)
- **Icons**: Lucide React
- **Testing**: Vitest + Testing Library

## Getting Started

The app runs automatically — no manual server setup needed. Supabase credentials are pre-configured.

### Running Tests

```bash
npm run test
```

### Building for Production

```bash
npm run build
```

## Architecture

### Database (Supabase / PostgreSQL)

All data lives in Supabase with Row Level Security (RLS) enabled on every table. Users can only access their own data.

| Table | Purpose |
|-------|---------|
| `profiles` | Extends `auth.users` with display name and avatar |
| `sender_configs` | Per-user email sender settings (rate limits, from-name/email) |
| `campaigns` | Email campaign records (subject, body, schedule, status) |
| `recipients` | Recipient email addresses per campaign |
| `email_deliveries` | Individual email delivery records with status tracking |
| `slack_integrations` | Slack connection info per user |

A database trigger (`handle_new_user`) automatically creates a profile and a default sender config when a new user signs up.

### Authentication

Authentication is handled by Supabase Auth:
- **Google OAuth** — `supabase.auth.signInWithOAuth({ provider: 'google' })` redirects to Google's consent screen.
- **Email/Password** — `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()` for email-based auth.

If Google OAuth is not yet enabled in your Supabase project, the login page shows a clear error and falls back to email/password sign-in.

### Frontend Structure

```
src/
  lib/supabase.ts        — Supabase client singleton
  hooks/useAuth.ts       — Auth state management (session, login, logout)
  hooks/useToast.ts      — Toast notification state
  services/api.ts        — Data access layer (wraps Supabase queries)
  components/            — Shared UI (Header, Pagination, States, Toast)
  pages/                 — Page components (Login, Dashboard, Compose, Scheduled, Sent, Settings)
  test/                  — Test files (Vitest + Testing Library)
  types/index.ts         — TypeScript interfaces
```

### Tests

Tests use Vitest with jsdom environment and Testing Library:

- `LoginPage.test.tsx` — Google sign-in, email/password form, validation, mode toggle
- `Header.test.tsx` — Navigation, user info, logout, active page highlighting
- `Pagination.test.tsx` — Page navigation, disabled states, page count display
- `States.test.tsx` — Loading spinner, empty state, error state with retry
- `Toast.test.tsx` — Success/error/info toast rendering
