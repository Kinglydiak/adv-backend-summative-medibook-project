const express = require('express');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const { renderFeedbackPage } = require('./controllers/feedbackController');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.get('/feedback', renderFeedbackPage);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  let statusCode = Number.isInteger(error.statusCode) ? error.statusCode : error.status;
  let message = error.message || 'Internal server error.';

  if (error.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'A record with the supplied unique value already exists.';
  } else if (error.code === 'ER_ROW_IS_REFERENCED_2') {
    statusCode = 409;
    message = 'This record cannot be deleted while it is referenced by appointments.';
  }

  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }
  if (statusCode >= 500 && !error.operationCompleted && !error.expose) {
    message = 'Internal server error.';
  }

  res.status(statusCode).json({
    message
  });
});

module.exports = app;
