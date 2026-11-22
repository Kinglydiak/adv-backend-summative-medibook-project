CREATE DATABASE IF NOT EXISTS medibook;
USE medibook;

INSERT INTO patients (id, name, email, phone) VALUES
  (1, 'Ana Mcheko', 'ana@mail.com', '0244-111-222'),
  (2, 'Kojo Owusu', 'kojo@mail.com', '0555-333-444'),
  (3, 'bimbona bimbo', 'bib@mail.com', '0200-555-111');

INSERT INTO doctors (id, name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng', 'Dermatology', 150.00, 'R-12'),
  (2, 'Dr. Adjei', 'Paediatrics', 100.00, 'R-03'),
  (3, 'Dr. Owusu', 'General Medicine', 180.00, 'R-07');

INSERT INTO appointments (id, patient_id, doctor_id, appointment_datetime, amount_paid, booked_on, status, cancelled_at, refund_amount, cancellation_reason, confirmation_queued_at, waitlist_processed_at) VALUES
  (1, 1, 1, '2026-12-01 09:00:00', 150.00, '2026-11-17 09:00:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (2, 2, 1, '2026-12-01 09:30:00', 150.00, '2026-11-17 09:15:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (3, 3, 1, '2026-12-01 10:00:00', 150.00, '2026-11-17 09:30:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (4, 1, 1, '2026-12-01 10:30:00', 150.00, '2026-11-17 09:45:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (5, 2, 1, '2026-12-01 11:00:00', 150.00, '2026-11-17 10:00:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (6, 3, 1, '2026-12-01 11:30:00', 150.00, '2026-11-17 10:15:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (7, 1, 1, '2026-12-01 12:00:00', 150.00, '2026-11-17 10:30:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (8, 2, 1, '2026-12-01 12:30:00', 150.00, '2026-11-17 10:45:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (9, 3, 1, '2026-12-01 13:00:00', 150.00, '2026-11-17 11:00:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (10, 1, 1, '2026-12-01 13:30:00', 150.00, '2026-11-17 11:15:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (11, 2, 2, '2026-12-02 10:00:00', 100.00, '2026-11-17 11:30:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL),
  (12, 3, 2, '2026-12-02 10:30:00', 100.00, '2026-11-17 11:45:00', 'scheduled', NULL, 0.00, NULL, NOW(), NULL);
