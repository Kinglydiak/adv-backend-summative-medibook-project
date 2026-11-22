USE medibook;

ALTER TABLE appointments
  ADD COLUMN confirmation_queued_at DATETIME NULL,
  ADD COLUMN waitlist_processed_at DATETIME NULL;

UPDATE appointments
SET confirmation_queued_at = booked_on
WHERE confirmation_queued_at IS NULL;

UPDATE appointments
SET waitlist_processed_at = cancelled_at
WHERE status = 'cancelled'
  AND waitlist_processed_at IS NULL;
