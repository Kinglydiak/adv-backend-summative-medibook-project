const patientModel = require('../models/patientModel');
const { validatePatientPayload, validateId } = require('../utils/validation');

async function listPatients(req, res, next) {
  try {
    const patients = await patientModel.listPatients();
    res.json(patients);
  } catch (error) {
    next(error);
  }
}

async function getPatient(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'patient id');
    if (idError) return res.status(400).json({ message: idError });
    const patient = await patientModel.getPatientById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found.' });
    }
    return res.json(patient);
  } catch (error) {
    return next(error);
  }
}

async function createPatient(req, res, next) {
  try {
    const validationErrors = validatePatientPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors[0] });
    }

    const patient = await patientModel.createPatient(req.body);
    return res.status(201).json(patient);
  } catch (error) {
    return next(error);
  }
}

async function updatePatient(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'patient id');
    if (idError) return res.status(400).json({ message: idError });
    const validationErrors = validatePatientPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors[0] });
    }

    const patient = await patientModel.updatePatient(req.params.id, req.body);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    return res.json(patient);
  } catch (error) {
    return next(error);
  }
}

async function deletePatient(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'patient id');
    if (idError) return res.status(400).json({ message: idError });
    const result = await patientModel.deletePatient(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
