-- Remove stale push_tokens keeping only the most recent token per user.
-- Duplicate tokens arise when SecureStore is wiped (e.g. app reinstall),
-- generating a new device_id for the same physical device.
-- Dead tokens are also cleaned automatically by the Edge Function via
-- DeviceNotRegistered receipts, but this removes existing orphans now.

DELETE FROM public.push_tokens
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.push_tokens
  ORDER BY user_id, created_at DESC
);
