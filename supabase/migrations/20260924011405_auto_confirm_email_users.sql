/*
# Auto-confirm email users on signup

When a new user signs up via email/password, Supabase creates the row in auth.users
but leaves email_confirmed_at NULL until the user clicks a confirmation link.
This project uses email/password auth without an email service, so confirmation
links can't be sent. This trigger auto-confirms the user at signup time so they
can sign in immediately.

## Changes
- Creates/updates trigger `auto_confirm_email_user` on `auth.users` AFTER INSERT
- Sets `email_confirmed_at = now()` and `confirmed_at = now()` on new rows where
  the user has an encrypted_password (i.e. email/password signup, not OAuth)
*/

CREATE OR REPLACE FUNCTION auto_confirm_email_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-confirm email/password signups (have encrypted_password, no SSO)
  IF NEW.encrypted_password IS NOT NULL AND NEW.is_sso_user IS NOT TRUE THEN
    NEW.email_confirmed_at = now();
    NEW.confirmed_at = now();
    NEW.confirmation_token = '';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_confirm_email_user_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_confirm_email_user();
