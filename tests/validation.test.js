const {
  validateAppointmentDateTime,
  calculateRefundAmount
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

});

describe('validateAppointmentDateTime', () => {
  test('accepts a future slot and rejects invalid time and date edge cases', () => {
    const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
    future.setUTCHours(10, 0, 0, 0);
    expect(validateAppointmentDateTime(future.toISOString())).toBeNull();

    const afterHours = new Date(future);
    afterHours.setUTCHours(17, 0, 0, 0);
    expect(validateAppointmentDateTime(afterHours.toISOString()))
      .toBe('Appointments must be booked within working hours: 09:00 to 17:00.');

    const offBoundary = new Date(future);
    offBoundary.setUTCHours(9, 15, 0, 0);
    expect(validateAppointmentDateTime(offBoundary.toISOString()))
      .toBe('Appointments must use 30-minute time slots.');
    expect(validateAppointmentDateTime('not-a-date'))
      .toBe('Appointment datetime must be a valid ISO date/time.');
    expect(validateAppointmentDateTime('2020-01-01T10:00:00Z'))
      .toBe('Appointments can only be booked in the future.');
  });
});

describe('feedback page localization', () => {
  const request = require('supertest');
  const app = require('../src/app');

  test('renders the five-answer feedback page, localized content, and safe fallback', async () => {
    const response = await request(app).get('/feedback');
    const today = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date());
    expect(response.status).toBe(200);
    expect((response.text.match(/<textarea\b/g) || [])).toHaveLength(5);
    expect(response.text).toContain('I found appointment booking rules the most challenging');
    expect(response.text).toContain('I’ll consider business rules before I start typing any code.');
    expect(response.text).toContain('Thank you for taking a moment to reflect on this course.');
    expect(response.text).toContain(`<div class="meta">${today}</div>`);

    const french = await request(app).get('/feedback?lang=fr');
    expect(french.text).toContain('<html lang="fr">');
    expect(french.text).toContain("Retour d'expérience MediBook");
    expect(french.text).toContain('Le fonctionnement du worker est devenu plus clair');
    expect(french.text).toContain('Veuillez consulter les questions et vos réponses ci-dessous.');
    const frenchDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());
    expect(french.text).toContain(`<div class="meta">${frenchDate}</div>`);

    const unsupported = await request(app).get('/feedback?lang=%22%3E%3Cscript%3E');
    expect(unsupported.text).toContain('<html lang="en">');
    expect(unsupported.text).not.toContain('<html lang=""><script>');
    expect(unsupported.text).toContain('MediBook Feedback');
  });
});
