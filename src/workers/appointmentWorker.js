require('dotenv').config();
const { client } = require('../config/redis');
const appointmentModel = require('../models/appointmentModel');
const { appendAuditLog } = require('../utils/logger');
const {
  QUEUES,
  waitlistQueueKey,
  enqueueConfirmation,
  claim,
  acknowledge,
  retry,
  restoreProcessingQueues
} = require('../utils/redisQueues');

let stopping = false;

async function dispatchPendingConfirmations() {
  const appointments = await appointmentModel.getPendingConfirmationAppointments();

  for (const appointment of appointments) {
    await enqueueConfirmation(appointment);
    await appointmentModel.markConfirmationQueued(appointment.id);
  }

  return appointments.length > 0;
}

async function processWaitlistPromotion() {
  const cancellation = await appointmentModel.getNextPendingWaitlistPromotion();
  if (!cancellation) {
    return false;
  }

  const queue = waitlistQueueKey(cancellation.doctor_id, cancellation.appointment_datetime);
  const payload = await claim(queue);
  if (!payload) {
    await appointmentModel.markWaitlistPromotionProcessed(cancellation.id);
    return true;
  }

  try {
    const waitlistedPatient = JSON.parse(payload);
    const appointment = await appointmentModel.promoteWaitlistedAppointment({
      patientId: waitlistedPatient.patientId,
      doctorId: cancellation.doctor_id,
      appointmentDatetime: cancellation.appointment_datetime
    });

    const logged = await appendAuditLog({
      action: 'waitlist-promotion',
      appointmentId: appointment.id,
      patientId: waitlistedPatient.patientId,
      doctorId: cancellation.doctor_id,
      appointmentDatetime: cancellation.appointment_datetime
    });
    if (!logged) {
      throw new Error('Waitlist promotion audit log could not be written.');
    }

    await acknowledge(queue, payload);
    await appointmentModel.markWaitlistPromotionProcessed(cancellation.id);
    return true;
  } catch (error) {
    await retry(queue, payload);

    if (error.code === 'SLOT_TAKEN' || error.code === 'DOCTOR_FULL') {
      await appointmentModel.markWaitlistPromotionProcessed(cancellation.id);
      console.warn('Waitlisted patient retained for a later opening:', error.message);
      return true;
    }

    console.error('Waitlist promotion failed; patient remains queued:', error.message);
    return false;
  }
}

async function processNotification() {
  const payload = await claim(QUEUES.notifications);
  if (!payload) {
    return false;
  }

  try {
    const notification = JSON.parse(payload);
    const logged = await appendAuditLog({
      action: 'confirmation-job',
      ...notification
    });
    if (!logged) {
      throw new Error('Confirmation audit log could not be written.');
    }

    await acknowledge(QUEUES.notifications, payload);
    return true;
  } catch (error) {
    await retry(QUEUES.notifications, payload);
    console.error('Confirmation job failed; the job was retained:', error.message);
    return false;
  }
}

async function workerLoop() {
  let recoverProcessing = true;

  while (!stopping) {
    try {
      if (recoverProcessing) {
        await restoreProcessingQueues();
        recoverProcessing = false;
      }

      const dispatched = await dispatchPendingConfirmations();
      const promoted = await processWaitlistPromotion();
      const notified = await processNotification();

      if (!dispatched && !promoted && !notified) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Appointment worker error; pending work will be retried:', error.message);
      recoverProcessing = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (client.isOpen) {
    await client.quit();
  }
}

if (require.main === module) {
  process.on('SIGINT', () => {
    stopping = true;
  });
  process.on('SIGTERM', () => {
    stopping = true;
  });

  workerLoop().catch((error) => {
    console.error('Appointment worker stopped unexpectedly:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  dispatchPendingConfirmations,
  processWaitlistPromotion,
  processNotification,
  workerLoop
};
