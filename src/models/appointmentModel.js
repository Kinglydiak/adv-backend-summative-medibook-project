const pool = require('../config/db');
const { DAILY_APPOINTMENT_CAP } = require('../config/businessRules');
const {
  calculateRefundAmount,
  toMySqlDateTime
} = require('../utils/validation');

async function getAppointmentById(id) {
  const [rows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listAppointments() {
  const [rows] = await pool.query(
    `SELECT
      a.id,
      a.patient_id,
      p.name AS patient_name,
      a.doctor_id,
      d.name AS doctor_name,
      a.appointment_datetime,
      a.amount_paid,
      a.booked_on,
      a.status,
      a.cancelled_at,
      a.refund_amount,
      a.cancellation_reason
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    ORDER BY a.appointment_datetime, a.id`
  );
  return rows;
}

async function getPendingConfirmationAppointments() {
  const [rows] = await pool.query(
    `SELECT id, patient_id, doctor_id, appointment_datetime
    FROM appointments
    WHERE confirmation_queued_at IS NULL
    ORDER BY booked_on, id
    LIMIT 50`
  );
  return rows;
}

async function markConfirmationQueued(appointmentId) {
  await pool.query(
    'UPDATE appointments SET confirmation_queued_at = UTC_TIMESTAMP() WHERE id = ? AND confirmation_queued_at IS NULL',
    [appointmentId]
  );
}

async function getNextPendingWaitlistPromotion() {
  const [rows] = await pool.query(
    `SELECT id, doctor_id, appointment_datetime
    FROM appointments
    WHERE status = ? AND waitlist_processed_at IS NULL
    ORDER BY cancelled_at, id
    LIMIT 1`,
    ['cancelled']
  );
  return rows[0] || null;
}

async function markWaitlistPromotionProcessed(appointmentId) {
  await pool.query(
    'UPDATE appointments SET waitlist_processed_at = UTC_TIMESTAMP() WHERE id = ? AND status = ? AND waitlist_processed_at IS NULL',
    [appointmentId, 'cancelled']
  );
}

async function createAppointment({ patientId, doctorId, appointmentDatetime }) {
  const appointmentDateTimeSql = toMySqlDateTime(appointmentDatetime);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [doctorRows] = await connection.query('SELECT * FROM doctors WHERE id = ? FOR UPDATE', [doctorId]);
    const doctor = doctorRows[0];
    if (!doctor) {
      throw Object.assign(new Error('Doctor not found.'), { statusCode: 404 });
    }

    const [patientRows] = await connection.query('SELECT * FROM patients WHERE id = ? FOR UPDATE', [patientId]);
    if (!patientRows[0]) {
      throw Object.assign(new Error('Patient not found.'), { statusCode: 404 });
    }

    const [slotCheckRows] = await connection.query(
      'SELECT COUNT(*) AS scheduled_count FROM appointments WHERE doctor_id = ? AND DATE(appointment_datetime) = DATE(?) AND status = ?',
      [doctorId, appointmentDateTimeSql, 'scheduled']
    );

    if (Number(slotCheckRows[0].scheduled_count) >= DAILY_APPOINTMENT_CAP) {
      throw Object.assign(new Error('Doctor is fully booked for that day.'), { code: 'DOCTOR_FULL' });
    }

    const [existing] = await connection.query(
      'SELECT id FROM appointments WHERE doctor_id = ? AND appointment_datetime = ? AND status = ?',
      [doctorId, appointmentDateTimeSql, 'scheduled']
    );

    if (existing.length > 0) {
      throw Object.assign(new Error('This doctor slot is already booked.'), { code: 'SLOT_TAKEN' });
    }

    const [result] = await connection.query(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_datetime, amount_paid, booked_on, status, refund_amount) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
      [patientId, doctorId, appointmentDateTimeSql, Number(doctor.consultation_fee), 'scheduled', 0]
    );

    const [appointmentRows] = await connection.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]);
    const appointment = appointmentRows[0];
    await connection.commit();

    return { appointment, wasWaitlisted: false };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const duplicateError = new Error('This doctor slot is already booked.');
      duplicateError.code = 'SLOT_TAKEN';
      throw duplicateError;
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function cancelAppointment({ appointmentId, reason }) {
  const connection = await pool.getConnection();
  const cancelledAt = new Date();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [appointmentId]);
    const appointment = rows[0];

    if (!appointment) {
      throw Object.assign(new Error('Appointment not found.'), { statusCode: 404 });
    }

    if (appointment.status === 'cancelled') {
      throw Object.assign(new Error('Appointment is already cancelled.'), { statusCode: 409 });
    }

    const refundAmount = calculateRefundAmount(
      appointment.amount_paid,
      cancelledAt,
      appointment.appointment_datetime
    );
    const refundPercent = Number(appointment.amount_paid) > 0
      ? Number((refundAmount / Number(appointment.amount_paid)).toFixed(2))
      : 0;

    await connection.query(
      'UPDATE appointments SET status = ?, cancelled_at = ?, refund_amount = ?, cancellation_reason = ?, waitlist_processed_at = NULL WHERE id = ?',
      ['cancelled', cancelledAt, refundAmount, reason || 'Patient cancelled', appointmentId]
    );
    await connection.commit();

    return {
      id: appointmentId,
      doctorId: appointment.doctor_id,
      appointmentDatetime: appointment.appointment_datetime,
      refundAmount,
      refundPercent,
      status: 'cancelled'
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function promoteWaitlistedAppointment({ patientId, doctorId, appointmentDatetime }) {
  const appointmentDateTimeSql = toMySqlDateTime(appointmentDatetime);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [doctorRows] = await connection.query('SELECT * FROM doctors WHERE id = ? FOR UPDATE', [doctorId]);
    const doctor = doctorRows[0];
    if (!doctor) {
      throw Object.assign(new Error('Waitlisted doctor no longer exists.'), { statusCode: 404 });
    }

    const [patientRows] = await connection.query('SELECT id FROM patients WHERE id = ? FOR UPDATE', [patientId]);
    if (!patientRows[0]) {
      throw Object.assign(new Error('Waitlisted patient no longer exists.'), { statusCode: 404 });
    }

    const [existingPatientAppointmentRows] = await connection.query(
      'SELECT * FROM appointments WHERE patient_id = ? AND doctor_id = ? AND appointment_datetime = ? AND status = ?',
      [patientId, doctorId, appointmentDateTimeSql, 'scheduled']
    );
    if (existingPatientAppointmentRows[0]) {
      await connection.commit();
      return existingPatientAppointmentRows[0];
    }

    const [dayRows] = await connection.query(
      'SELECT COUNT(*) AS scheduled_count FROM appointments WHERE doctor_id = ? AND DATE(appointment_datetime) = DATE(?) AND status = ?',
      [doctorId, appointmentDateTimeSql, 'scheduled']
    );
    if (Number(dayRows[0].scheduled_count) >= DAILY_APPOINTMENT_CAP) {
      throw Object.assign(new Error('Doctor has reached the daily appointment cap.'), { code: 'DOCTOR_FULL' });
    }

    const [slotRows] = await connection.query(
      'SELECT id FROM appointments WHERE doctor_id = ? AND appointment_datetime = ? AND status = ?',
      [doctorId, appointmentDateTimeSql, 'scheduled']
    );
    if (slotRows.length > 0) {
      throw Object.assign(new Error('The released slot has already been booked.'), { code: 'SLOT_TAKEN' });
    }

    const [result] = await connection.query(
      'INSERT INTO appointments (patient_id, doctor_id, appointment_datetime, amount_paid, booked_on, status, refund_amount) VALUES (?, ?, ?, ?, NOW(), ?, ?)',
      [patientId, doctorId, appointmentDateTimeSql, Number(doctor.consultation_fee), 'scheduled', 0]
    );
    const [appointmentRows] = await connection.query('SELECT * FROM appointments WHERE id = ?', [result.insertId]);
    await connection.commit();
    return appointmentRows[0];
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      error.code = 'SLOT_TAKEN';
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listAppointments,
  createAppointment,
  cancelAppointment,
  getAppointmentById,
  promoteWaitlistedAppointment,
  getPendingConfirmationAppointments,
  markConfirmationQueued,
  getNextPendingWaitlistPromotion,
  markWaitlistPromotionProcessed
};
