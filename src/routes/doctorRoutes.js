const express = require('express');
const {
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorStatistics,
  getDoctorsReport,
  getBusyDaysReport
} = require('../controllers/doctorController');

const router = express.Router();

router.get('/reports', getDoctorsReport);
router.get('/busy-days', getBusyDaysReport);
router.get('/:id/statistics', getDoctorStatistics);
router.get('/', listDoctors);
router.get('/:id', getDoctor);
router.post('/', createDoctor);
router.put('/:id', updateDoctor);
router.delete('/:id', deleteDoctor);

module.exports = router;
