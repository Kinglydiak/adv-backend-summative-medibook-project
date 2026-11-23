const appointmentModel = require('../models/appointmentModel');
const { validateAppointmentDateTime, validateId } = require('../utils/validation');
const { appendAuditLog } = require('../utils/logger');
const { enqueueWaitlist } = require('../utils/redisQueues');

async function listAppointments(req, res, next) {
  try {
    const appointments = await appointmentModel.listAppointments();
    return res.json(appointments);
  } catch (error) {
    return next(error);
  }
}

async function bookAppointment(req, res, next) {
  try {
    const { patientId, doctorId, appointmentDatetime } = req.body || {};

    const timeError = validateAppointmentDateTime(appointmentDatetime);
    if (timeError) {
      return res.status(400).json({ message: timeError });
    }

    const patientIdError = validateId(patientId, 'patientId');
    const doctorIdError = validateId(doctorId, 'doctorId');
    if (patientIdError || doctorIdError) {
      return res.status(400).json({ message: patientIdError || doctorIdError });
    }

    const result = await appointmentModel.createAppointment({
      patientId,
      doctorId,
      appointmentDatetime
    });

    await appendAuditLog({
      action: 'appointment-booked',
      appointmentId: result.appointment.id,
      patientId,
      doctorId,
      appointmentDatetime
    });

    return res.status(201).json({ message: 'Appointment created successfully.', appointment: result.appointment });
  } catch (error) {
    if (error.code === 'DOCTOR_FULL' || error.code === 'SLOT_TAKEN') {
      try {
        await enqueueWaitlist({
          patientId: Number(req.body.patientId),
          doctorId: Number(req.body.doctorId),
          appointmentDatetime: req.body.appointmentDatetime
        });
      } catch (queueError) {
        queueError.statusCode = 503;
        queueError.message = 'The appointment is unavailable and the waitlist could not be reached.';
        queueError.expose = true;
        return next(queueError);
      }

      return res.status(409).json({
        message: 'The requested slot is unavailable. A waitlist spot has been offered.',
        waitlistOffered: true
      });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }

    return next(error);
  }
}

async function cancelAppointment(req, res, next) {
  try {
    const appointmentId = req.params.id;
    const appointmentIdError = validateId(appointmentId, 'appointment id');
    if (appointmentIdError) {
      return res.status(400).json({ message: appointmentIdError });
    }
    const { reason } = req.body || {};
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 255)) {
      return res.status(400).json({ message: 'Cancellation reason must be text no longer than 255 characters.' });
    }

    const result = await appointmentModel.cancelAppointment({
      appointmentId,
      reason
    });

    await appendAuditLog({
      action: 'appointment-cancelled',
      appointmentId,
      refundAmount: result.refundAmount,
      reason: reason || 'Patient cancelled'
    });

    return res.json({
      message: 'Appointment cancelled successfully.',
      refundAmount: result.refundAmount,
      refundPercent: result.refundPercent
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ message: error.message });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = { listAppointments, bookAppointment, cancelAppointment };
