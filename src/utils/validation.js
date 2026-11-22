const {
  WORKING_HOURS_START,
  WORKING_HOURS_END,
  SLOT_MINUTES
} = require('../config/businessRules');

function isValidDateString(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function toMySqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Appointment datetime must be a valid ISO date/time.');
  }

  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function isFutureSlot(value) {
  if (!isValidDateString(value)) return false;
  return new Date(value).getTime() > Date.now();
}

function is30MinuteBoundary(value) {
  if (!isValidDateString(value)) return false;
  const time = new Date(value);
  return time.getUTCMinutes() % SLOT_MINUTES === 0
    && time.getUTCSeconds() === 0
    && time.getUTCMilliseconds() === 0;
}

function isWithinWorkingHours(value) {
  if (!isValidDateString(value)) return false;
  const date = new Date(value);
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();

  const startTotal = WORKING_HOURS_START * 60;
  const endTotal = WORKING_HOURS_END * 60;
  const slotTotal = hour * 60 + minute;

  return slotTotal >= startTotal && slotTotal < endTotal;
}

function validateAppointmentDateTime(value) {
  if (!isValidDateString(value)) {
    return 'Appointment datetime must be a valid ISO date/time.';
  }

  if (!isFutureSlot(value)) {
    return 'Appointments can only be booked in the future.';
  }

  if (!isWithinWorkingHours(value)) {
    return 'Appointments must be booked within working hours: 09:00 to 17:00.';
  }

  if (!is30MinuteBoundary(value)) {
    return 'Appointments must use 30-minute time slots.';
  }

  const date = new Date(value);
  if (date.getUTCHours() === 17 && date.getUTCMinutes() === 0) {
    return 'Appointments must end before 17:00.';
  }

  return null;
}

function validatePatientPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Patient details are required.'];
  }

  if (typeof payload.name !== 'string' || payload.name.trim().length < 2) {
    errors.push('Patient name is required and must be at least 2 characters.');
  }

  if (typeof payload.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (typeof payload.phone !== 'string' || payload.phone.trim().length < 7) {
    errors.push('Phone number is required and must be at least 7 characters.');
  }

  return errors;
}

function validateDoctorPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Doctor details are required.'];
  }

  if (typeof payload.name !== 'string' || payload.name.trim().length < 2) {
    errors.push('Doctor name is required and must be at least 2 characters.');
  }

  if (typeof payload.specialty !== 'string' || payload.specialty.trim().length < 2) {
    errors.push('Doctor specialty is required.');
  }

  if (
    payload.consultationFee === undefined ||
    payload.consultationFee === null ||
    (typeof payload.consultationFee === 'string' && payload.consultationFee.trim() === '') ||
    !Number.isFinite(Number(payload.consultationFee)) ||
    Number(payload.consultationFee) < 0
  ) {
    errors.push('Consultation fee must be a number greater than or equal to zero.');
  }

  if (typeof payload.room !== 'string' || payload.room.trim().length < 1) {
    errors.push('Doctor room is required.');
  }

  return errors;
}

function calculateRefundPercent(cancelledAt, appointmentDateTime) {
  const cancelTime = new Date(cancelledAt).getTime();
  const appointmentTime = new Date(appointmentDateTime).getTime();
  const diffHours = (appointmentTime - cancelTime) / 3600000;

  if (diffHours < 0) return 0;
  if (diffHours > 48) return 1;
  if (diffHours >= 24) return 0.5;
  return 0;
}

function calculateRefundAmount(amountPaid, cancelledAt, appointmentDateTime) {
  const percent = calculateRefundPercent(cancelledAt, appointmentDateTime);
  return Number((Number(amountPaid) * percent).toFixed(2));
}

function validateId(value, label = 'id') {
  if (!/^[1-9]\d*$/.test(String(value))) {
    return `${label} must be a positive integer.`;
  }

  return null;
}

module.exports = {
  WORKING_HOURS_START,
  WORKING_HOURS_END,
  SLOT_MINUTES,
  validateAppointmentDateTime,
  calculateRefundPercent,
  calculateRefundAmount,
  validatePatientPayload,
  validateDoctorPayload,
  validateId,
  isFutureSlot,
  isValidDateString,
  toMySqlDateTime,
  is30MinuteBoundary,
  isWithinWorkingHours
};
