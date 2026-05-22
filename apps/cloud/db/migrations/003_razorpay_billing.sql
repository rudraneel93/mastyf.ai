-- Migrate Stripe billing columns to provider-agnostic Razorpay billing

ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO billing_customer_id;
ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO billing_subscription_id;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'razorpay';

ALTER TABLE stripe_events RENAME TO payment_events;
