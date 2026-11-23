jest.mock('../src/config/redis', () => ({
  client: { isOpen: false, quit: jest.fn() }
}));

jest.mock('../src/models/appointmentModel', () => ({
  getPendingConfirmationAppointments: jest.fn(),
  markConfirmationQueued: jest.fn(),
  getNextPendingWaitlistPromotion: jest.fn(),
  markWaitlistPromotionProcessed: jest.fn(),
  promoteWaitlistedAppointment: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  appendAuditLog: jest.fn()
}));

jest.mock('../src/utils/redisQueues', () => ({
  QUEUES: { notifications: 'medibook:notifications' },
  waitlistQueueKey: jest.fn(() => 'medibook:waitlist:1:2026-12-01'),
  enqueueConfirmation: jest.fn(),
  claim: jest.fn(),
  acknowledge: jest.fn(),
  retry: jest.fn(),
  restoreProcessingQueues: jest.fn()
}));

const appointmentModel = require('../src/models/appointmentModel');
const { appendAuditLog } = require('../src/utils/logger');
const redisQueues = require('../src/utils/redisQueues');
const {
  dispatchPendingConfirmations,
  processWaitlistPromotion,
  processNotification
} = require('../src/workers/appointmentWorker');

describe('appointment worker queue reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('dispatches pending confirmations before marking their outbox rows queued', async () => {
    const appointment = { id: 21, patient_id: 3, doctor_id: 1, appointment_datetime: '2026-12-01T09:00:00.000Z' };
    appointmentModel.getPendingConfirmationAppointments.mockResolvedValue([appointment]);
    redisQueues.enqueueConfirmation.mockResolvedValue(1);
    appointmentModel.markConfirmationQueued.mockResolvedValue();

    await expect(dispatchPendingConfirmations()).resolves.toBe(true);

    expect(redisQueues.enqueueConfirmation).toHaveBeenCalledWith(appointment);
    expect(appointmentModel.markConfirmationQueued).toHaveBeenCalledWith(appointment.id);
    expect(redisQueues.enqueueConfirmation.mock.invocationCallOrder[0])
      .toBeLessThan(appointmentModel.markConfirmationQueued.mock.invocationCallOrder[0]);
  });

  test('marks cancellation work processed only after a promoted patient is acknowledged', async () => {
    const cancellation = {
      id: 8,
      doctor_id: 1,
      appointment_datetime: '2026-12-01T09:00:00.000Z'
    };
    const payload = JSON.stringify({ patientId: 3 });
    appointmentModel.getNextPendingWaitlistPromotion.mockResolvedValue(cancellation);
    redisQueues.claim.mockResolvedValue(payload);
    appointmentModel.promoteWaitlistedAppointment.mockResolvedValue({ id: 22 });
    appendAuditLog.mockResolvedValue(true);
    redisQueues.acknowledge.mockResolvedValue();
    appointmentModel.markWaitlistPromotionProcessed.mockResolvedValue();

    await expect(processWaitlistPromotion()).resolves.toBe(true);

    expect(redisQueues.acknowledge).toHaveBeenCalledWith(
      'medibook:waitlist:1:2026-12-01',
      payload
    );
    expect(appointmentModel.markWaitlistPromotionProcessed).toHaveBeenCalledWith(cancellation.id);
    expect(redisQueues.acknowledge.mock.invocationCallOrder[0])
      .toBeLessThan(appointmentModel.markWaitlistPromotionProcessed.mock.invocationCallOrder[0]);
  });

  test('retains a waitlisted patient and leaves the cancellation pending after a transient promotion failure', async () => {
    appointmentModel.getNextPendingWaitlistPromotion.mockResolvedValue({
      id: 8,
      doctor_id: 1,
      appointment_datetime: '2026-12-01T09:00:00.000Z'
    });
    const payload = JSON.stringify({ patientId: 3 });
    redisQueues.claim.mockResolvedValue(payload);
    appointmentModel.promoteWaitlistedAppointment.mockRejectedValue(new Error('database unavailable'));
    redisQueues.retry.mockResolvedValue();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(processWaitlistPromotion()).resolves.toBe(false);
      expect(redisQueues.retry).toHaveBeenCalledWith('medibook:waitlist:1:2026-12-01', payload);
      expect(appointmentModel.markWaitlistPromotionProcessed).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  test('requeues a notification when its audit log cannot be persisted', async () => {
    const payload = JSON.stringify({ id: 'appointment-21', appointmentId: 21 });
    redisQueues.claim.mockResolvedValue(payload);
    appendAuditLog.mockResolvedValue(false);
    redisQueues.retry.mockResolvedValue();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(processNotification()).resolves.toBe(false);
      expect(redisQueues.retry).toHaveBeenCalledWith('medibook:notifications', payload);
      expect(redisQueues.acknowledge).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });
});
