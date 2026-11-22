const pool = require('../config/db');
const {
  DAILY_APPOINTMENT_CAP,
  BUSY_DAY_THRESHOLD
} = require('../config/businessRules');

async function listDoctors() {
  const [rows] = await pool.query('SELECT * FROM doctors ORDER BY id ASC');
  return rows;
}

async function getDoctorById(id) {
  const [rows] = await pool.query('SELECT * FROM doctors WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createDoctor({ name, specialty, consultationFee, room }) {
  const [result] = await pool.query(
    'INSERT INTO doctors (name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [name.trim(), specialty.trim(), Number(consultationFee), room.trim()]
  );
  return { id: result.insertId, name: name.trim(), specialty: specialty.trim(), consultationFee: Number(consultationFee), room: room.trim() };
}

async function updateDoctor(id, { name, specialty, consultationFee, room }) {
  await pool.query(
    'UPDATE doctors SET name = ?, specialty = ?, consultation_fee = ?, room = ? WHERE id = ?',
    [name.trim(), specialty.trim(), Number(consultationFee), room.trim(), id]
  );

  const doctor = await getDoctorById(id);
  return doctor;
}

async function deleteDoctor(id) {
  const result = await pool.query('DELETE FROM doctors WHERE id = ?', [id]);
  return result[0];
}

async function getDoctorStatistics(doctorId) {
  const [rows] = await pool.query(
    `SELECT
      d.id AS doctor_id,
      d.name AS doctor_name,
      COALESCE(SUM(a.amount_paid - a.refund_amount), 0) AS revenue_collected,
      SUM(CASE WHEN a.status = ? AND a.appointment_datetime > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS upcoming_appointments
    FROM doctors d
    LEFT JOIN appointments a ON a.doctor_id = d.id
    WHERE d.id = ?
    GROUP BY d.id, d.name`,
    ['scheduled', doctorId]
  );

  if (!rows[0]) {
    return null;
  }

  const [dailyCounts] = await pool.query(
    `SELECT
      DATE_ADD(UTC_DATE(), INTERVAL day_offsets.day_offset DAY) AS appointment_date,
      COUNT(a.id) AS appointment_count,
      ROUND(COUNT(a.id) / ? * 100, 2) AS utilization_percent
    FROM (
      SELECT 0 AS day_offset UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
      SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
    ) AS day_offsets
    LEFT JOIN appointments a
      ON a.doctor_id = ?
      AND a.status = ?
      AND a.appointment_datetime >= UTC_TIMESTAMP()
      AND DATE(a.appointment_datetime) = DATE_ADD(UTC_DATE(), INTERVAL day_offsets.day_offset DAY)
    GROUP BY day_offsets.day_offset
    ORDER BY day_offsets.day_offset`,
    [DAILY_APPOINTMENT_CAP, doctorId, 'scheduled']
  );
  const [utilizationRows] = await pool.query(
    `SELECT ROUND(COUNT(*) / (? * 7) * 100, 2) AS utilization_percent
    FROM appointments
    WHERE doctor_id = ?
      AND status = ?
      AND appointment_datetime >= UTC_TIMESTAMP()
      AND appointment_datetime < DATE_ADD(UTC_DATE(), INTERVAL 7 DAY)`,
    [DAILY_APPOINTMENT_CAP, doctorId, 'scheduled']
  );

  return {
    ...rows[0],
    appointments_per_day: dailyCounts,
    utilization_percent: utilizationRows[0].utilization_percent
  };
}

async function getDoctorReport() {
  const [rows] = await pool.query(
    `SELECT
      d.id AS doctor_id,
      d.name AS doctor_name,
      d.specialty,
      COUNT(a.id) AS total_appointments,
      COALESCE(SUM(a.amount_paid - a.refund_amount), 0) AS revenue_collected
    FROM doctors d
    LEFT JOIN appointments a ON a.doctor_id = d.id
    GROUP BY d.id, d.name, d.specialty
    ORDER BY d.id`
  );
  return rows;
}

async function getBusyDaysReport() {
  const [rows] = await pool.query(
    `SELECT
      a.doctor_id,
      d.name AS doctor_name,
      DATE(a.appointment_datetime) AS appointment_date,
      COUNT(*) AS booked_slots
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    WHERE a.status = ?
    GROUP BY a.doctor_id, d.name, DATE(a.appointment_datetime)
    HAVING COUNT(*) > ? * ?
    ORDER BY a.doctor_id, appointment_date`,
    ['scheduled', DAILY_APPOINTMENT_CAP, BUSY_DAY_THRESHOLD]
  );
  return rows;
}

module.exports = {
  listDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorStatistics,
  getDoctorReport,
  getBusyDaysReport
};
