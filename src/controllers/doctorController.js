const doctorModel = require('../models/doctorModel');
const { validateDoctorPayload, validateId } = require('../utils/validation');

async function listDoctors(req, res, next) {
  try {
    const doctors = await doctorModel.listDoctors();
    res.json(doctors);
  } catch (error) {
    next(error);
  }
}

async function getDoctor(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'doctor id');
    if (idError) return res.status(400).json({ message: idError });
    const doctor = await doctorModel.getDoctorById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    return res.json(doctor);
  } catch (error) {
    return next(error);
  }
}

async function createDoctor(req, res, next) {
  try {
    const validationErrors = validateDoctorPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors[0] });
    }

    const doctor = await doctorModel.createDoctor({
      name: req.body.name,
      specialty: req.body.specialty,
      consultationFee: req.body.consultationFee,
      room: req.body.room
    });

    return res.status(201).json(doctor);
  } catch (error) {
    return next(error);
  }
}

async function updateDoctor(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'doctor id');
    if (idError) return res.status(400).json({ message: idError });
    const validationErrors = validateDoctorPayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors[0] });
    }

    const doctor = await doctorModel.updateDoctor(req.params.id, {
      name: req.body.name,
      specialty: req.body.specialty,
      consultationFee: req.body.consultationFee,
      room: req.body.room
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }

    return res.json(doctor);
  } catch (error) {
    return next(error);
  }
}

async function deleteDoctor(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'doctor id');
    if (idError) return res.status(400).json({ message: idError });
    const result = await doctorModel.deleteDoctor(req.params.id);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function getDoctorStatistics(req, res, next) {
  try {
    const idError = validateId(req.params.id, 'doctor id');
    if (idError) return res.status(400).json({ message: idError });
    const stats = await doctorModel.getDoctorStatistics(req.params.id);
    if (!stats) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
}

async function getDoctorsReport(req, res, next) {
  try {
    const report = await doctorModel.getDoctorReport();
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

async function getBusyDaysReport(req, res, next) {
  try {
    const report = await doctorModel.getBusyDaysReport();
    return res.json(report);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorStatistics,
  getDoctorsReport,
  getBusyDaysReport
};
