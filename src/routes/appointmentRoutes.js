const express = require('express');
const { bookAppointment, cancelAppointment } = require('../controllers/appointmentController');

const router = express.Router();

router.post('/', bookAppointment);
router.delete('/:id', cancelAppointment);

module.exports = router;
