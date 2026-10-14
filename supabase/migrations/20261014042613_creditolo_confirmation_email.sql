alter table public.creditolo_deliveries
  add column confirmation_email_claimed_at timestamptz,
  add column confirmation_email_sent_at timestamptz,
  add column confirmation_email_error text;
