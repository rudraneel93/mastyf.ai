-- Legacy: rename Stripe columns when upgrading old databases (no-op on fresh installs)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
    ) THEN
      ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO billing_customer_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
    ) THEN
      ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO billing_subscription_id;
    END IF;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'razorpay';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stripe_events'
  ) THEN
    ALTER TABLE stripe_events RENAME TO payment_events;
  END IF;
END $$;
