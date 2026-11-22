CREATE DATABASE IF NOT EXISTS medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

CREATE TABLE patients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_email (email),
  CONSTRAINT chk_patients_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_patients_email CHECK (email LIKE '%_@__%.__%')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE doctors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_doctors_name CHECK (CHAR_LENGTH(TRIM(name)) > 0),
  CONSTRAINT chk_doctors_specialty CHECK (CHAR_LENGTH(TRIM(specialty)) > 0),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee >= 0),
  CONSTRAINT chk_doctors_room CHECK (CHAR_LENGTH(TRIM(room)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL,
  appointment_datetime DATETIME NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  booked_on DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('scheduled', 'cancelled') NOT NULL DEFAULT 'scheduled',
  cancelled_at DATETIME NULL,
  refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cancellation_reason VARCHAR(255) NULL,
  slot_active TINYINT(1) GENERATED ALWAYS AS (CASE WHEN status = 'scheduled' THEN 1 ELSE NULL END) STORED,
  PRIMARY KEY (id),
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_appointments_amount CHECK (amount_paid >= 0),
  CONSTRAINT chk_appointments_refund CHECK (refund_amount >= 0),
  CONSTRAINT chk_appointments_datetime CHECK (appointment_datetime >= '2020-01-01 00:00:00'),
  UNIQUE KEY uq_doctor_slot_active (doctor_id, appointment_datetime, slot_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
