const {
  validateAppointmentDateTime,
  calculateRefundAmount,
  validateDoctorPayload,
  validateId,
  toMySqlDateTime
} = require('../src/utils/validation');

describe('calculateRefundAmount', () => {
  test('returns full refund for cancellations more than 48 hours before the booking', () => {
    const bookedAt = '2026-08-10T09:00:00Z';
    const cancelledAt = '2026-08-08T07:00:00Z';
    expect(calculateRefundAmount(150, cancelledAt, bookedAt)).toBe(150);
  });

  test('returns 50% refund at exactly 48 hours before booking', () => {
    const bookedAt = '2026-08-10T09:00:00Z';
    const cancelledAt = '2026-08-08T09:00:00Z';
    expect(calculateRefundAmount(200, cancelledAt, bookedAt)).toBe(100);
  });

  test('returns 50% refund at exactly 24 hours before booking', () => {
    const bookedAt = '2026-08-10T09:00:00Z';
    const cancelledAt = '2026-08-09T09:00:00Z';
    expect(calculateRefundAmount(200, cancelledAt, bookedAt)).toBe(100);
  });

  test('returns zero refund for cancellations within 24 hours', () => {
    const bookedAt = '2026-08-10T09:00:00Z';
    const cancelledAt = '2026-08-09T20:00:00Z';
    expect(calculateRefundAmount(200, cancelledAt, bookedAt)).toBe(0);
  });

  test('returns 50% refund for cancellations between 24 and 48 hours', () => {
    const bookedAt = '2026-08-10T09:00:00Z';
    const cancelledAt = '2026-08-08T12:00:00Z';
    expect(calculateRefundAmount(180, cancelledAt, bookedAt)).toBe(90);
  });
});

describe('validateAppointmentDateTime', () => {
  test('accepts a valid future slot on a 30-minute boundary', () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    future.setUTCMinutes(0, 0, 0);
    future.setUTCHours(10);
    expect(validateAppointmentDateTime(future.toISOString())).toBeNull();
  });

  test('rejects a slot exactly at 17:00', () => {
    const invalid = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invalid.setUTCHours(17, 0, 0, 0);
    expect(validateAppointmentDateTime(invalid.toISOString())).toBe('Appointments must be booked within working hours: 09:00 to 17:00.');
  });

  test('rejects a slot that is not aligned to 30 minutes', () => {
    const invalid = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invalid.setUTCHours(9, 15, 0, 0);
    expect(validateAppointmentDateTime(invalid.toISOString())).toBe('Appointments must use 30-minute time slots.');
  });

  test('rejects malformed datetime strings', () => {
    expect(validateAppointmentDateTime('not-a-date')).toBe('Appointment datetime must be a valid ISO date/time.');
  });

  test('rejects a past appointment', () => {
    expect(validateAppointmentDateTime('2020-01-01T10:00:00Z')).toBe('Appointments can only be booked in the future.');
  });

  test('rejects nonzero seconds on an otherwise aligned slot', () => {
    const invalid = new Date(Date.now() + 24 * 60 * 60 * 1000);
    invalid.setUTCHours(9, 0, 30, 0);
    expect(validateAppointmentDateTime(invalid.toISOString())).toBe('Appointments must use 30-minute time slots.');
  });
});

describe('request payload validation', () => {
  test('rejects a nonnumeric consultation fee', () => {
    expect(validateDoctorPayload({
      name: 'Dr. Example',
      specialty: 'General',
      consultationFee: 'not-a-number',
      room: 'R-1'
    })).toContain('Consultation fee must be a number greater than or equal to zero.');
  });

  test('rejects non-positive or malformed resource ids', () => {
    expect(validateId('0', 'patientId')).toBe('patientId must be a positive integer.');
    expect(validateId('1; DROP TABLE patients', 'patientId')).toBe('patientId must be a positive integer.');
  });

  test('normalizes appointment instants to a MySQL UTC datetime', () => {
    expect(toMySqlDateTime('2026-12-01T09:30:00.000Z')).toBe('2026-12-01 09:30:00');
  });
});

describe('feedback page localization', () => {
  const request = require('supertest');
  const app = require('../src/app');

  test('renders exactly five essay textareas', async () => {
    const response = await request(app).get('/feedback');
    expect(response.status).toBe(200);
    expect((response.text.match(/<textarea\b/g) || [])).toHaveLength(5);
  });

  test('uses the supported French locale and falls back safely for unsupported locale input', async () => {
    const french = await request(app).get('/feedback?lang=fr');
    expect(french.text).toContain('<html lang="fr">');
    expect(french.text).toContain("Retour d'expérience MediBook");

    const unsupported = await request(app).get('/feedback?lang=%22%3E%3Cscript%3E');
    expect(unsupported.text).toContain('<html lang="en">');
    expect(unsupported.text).not.toContain('<html lang=""><script>');
    expect(unsupported.text).toContain('MediBook Feedback');
  });
});
