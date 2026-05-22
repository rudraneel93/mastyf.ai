-- Remove paid subscription / payment tables (free OSS control plane)

DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS subscriptions;
