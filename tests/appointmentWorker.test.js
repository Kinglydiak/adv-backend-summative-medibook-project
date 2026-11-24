jest.mock('../src/config/redis', () => ({
  client: { isOpen: false, quit: jest.fn() }
}));

jest.mock('../src/models/appointmentModel', () => ({
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
  claim: jest.fn(),
  retry: jest.fn()
}));

const appointmentModel = require('../src/models/appointmentModel');
const redisQueues = require('../src/utils/redisQueues');
const { processWaitlistPromotion } = require('../src/workers/appointmentWorker');

describe('appointment worker queue reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
