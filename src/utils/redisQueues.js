const crypto = require('crypto');
const { client, ensureRedisConnection } = require('../config/redis');

const QUEUES = {
  notifications: 'medibook:notifications'
};

const enqueueConfirmationOnceScript = `
if redis.call('SET', KEYS[2], '1', 'NX') then
  redis.call('RPUSH', KEYS[1], ARGV[1])
  return 1
end
return 0`;

function dateKey(dateTime) {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    throw new Error('A valid appointment date is required for queueing.');
  }
  return date.toISOString().slice(0, 10);
}

function waitlistQueueKey(doctorId, appointmentDatetime) {
  return `medibook:waitlist:${doctorId}:${dateKey(appointmentDatetime)}`;
}

async function enqueueWaitlist({ patientId, doctorId, appointmentDatetime }) {
  await ensureRedisConnection();
  const queue = waitlistQueueKey(doctorId, appointmentDatetime);
  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    patientId,
    doctorId,
    requestedDatetime: appointmentDatetime
  });
  return client.rPush(queue, payload);
}

async function enqueueConfirmation(appointment) {
  await ensureRedisConnection();
  const payload = JSON.stringify({
    id: `appointment-${appointment.id}`,
    type: 'confirmation',
    appointmentId: appointment.id,
    patientId: appointment.patient_id,
    doctorId: appointment.doctor_id,
    appointmentDateTime: appointment.appointment_datetime
  });
  return client.eval(enqueueConfirmationOnceScript, {
    keys: [
      QUEUES.notifications,
      `medibook:confirmation:enqueued:${appointment.id}`
    ],
    arguments: [payload]
  });
}

async function claim(queue) {
  await ensureRedisConnection();
  return client.lMove(queue, `${queue}:processing`, 'LEFT', 'RIGHT');
}

async function acknowledge(queue, payload) {
  await client.lRem(`${queue}:processing`, 1, payload);
}

async function retry(queue, payload) {
  await client.lRem(`${queue}:processing`, 1, payload);
  await client.lPush(queue, payload);
}

async function restoreProcessingQueues() {
  await ensureRedisConnection();
  const waitlistProcessingQueues = (await client.keys('medibook:waitlist:*:processing'))
    .map((key) => key.slice(0, -':processing'.length));
  const queues = [
    QUEUES.notifications,
    ...waitlistProcessingQueues
  ];

  for (const queue of queues) {
    const processing = `${queue}:processing`;
    const items = await client.lRange(processing, 0, -1);
    for (let index = items.length - 1; index >= 0; index -= 1) {
      await client.lPush(queue, items[index]);
    }
    if (items.length > 0) {
      await client.del(processing);
    }
  }
}

module.exports = {
  QUEUES,
  waitlistQueueKey,
  enqueueWaitlist,
  enqueueConfirmation,
  claim,
  acknowledge,
  retry,
  restoreProcessingQueues
};
