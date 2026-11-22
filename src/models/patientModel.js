const pool = require('../config/db');

async function listPatients() {
  const [rows] = await pool.query('SELECT * FROM patients ORDER BY id ASC');
  return rows;
}

async function getPatientById(id) {
  const [rows] = await pool.query('SELECT * FROM patients WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createPatient({ name, email, phone }) {
  const [result] = await pool.query(
    'INSERT INTO patients (name, email, phone) VALUES (?, ?, ?)',
    [name.trim(), email.trim(), phone.trim()]
  );
  return { id: result.insertId, name: name.trim(), email: email.trim(), phone: phone.trim() };
}

async function updatePatient(id, { name, email, phone }) {
  await pool.query(
    'UPDATE patients SET name = ?, email = ?, phone = ? WHERE id = ?',
    [name.trim(), email.trim(), phone.trim(), id]
  );

  const patient = await getPatientById(id);
  return patient;
}

async function deletePatient(id) {
  const result = await pool.query('DELETE FROM patients WHERE id = ?', [id]);
  return result[0];
}

module.exports = { listPatients, getPatientById, createPatient, updatePatient, deletePatient };
