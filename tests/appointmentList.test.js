jest.mock('../src/models/appointmentModel', () => ({
  listAppointments: jest.fn()
}));

const request = require('supertest');
const app = require('../src/app');
const appointmentModel = require('../src/models/appointmentModel');

describe('GET /api/appointments', () => {
  test('returns appointment records with patient and doctor names', async () => {
    const appointments = [{
      id: 21,
      patient_id: 3,
      patient_name: 'Test Patient',
      doctor_id: 1,
      doctor_name: 'Dr. Example',
      appointment_datetime: '2026-12-01T09:00:00.000Z',
      status: 'scheduled'
    }];
    appointmentModel.listAppointments.mockResolvedValue(appointments);

    const response = await request(app).get('/api/appointments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(appointments);
    expect(appointmentModel.listAppointments).toHaveBeenCalledTimes(1);
  });
});
