require('dotenv').config();
const app = require('./src/app');
const { fork } = require('child_process');

const port = Number(process.env.PORT || 3000);
const worker = fork('./src/workers/appointmentWorker.js', { stdio: 'inherit' });

app.listen(port, () => {
  console.log(`MediBook API listening on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  worker.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGTERM', () => {
  worker.kill('SIGTERM');
  process.exit(0);
});
