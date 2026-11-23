const express = require('express');
const {
  listAppointments,
  bookAppointment,
  cancelAppointment
} = require('../controllers/appointmentController');

const router = express.Router();

router.get('/', listAppointments);
router.post('/', bookAppointment);
router.delete('/:id', cancelAppointment);

module.exports = router;
