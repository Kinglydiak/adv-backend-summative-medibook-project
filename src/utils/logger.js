const fs = require('fs/promises');
const path = require('path');

async function appendAuditLog(entry) {
  try {
    const logDirectory = path.join(__dirname, '../../logs');
    await fs.mkdir(logDirectory, { recursive: true });
    const logPath = path.join(logDirectory, 'audit.log');
    const payload = { timestamp: new Date().toISOString(), ...entry };
    await fs.appendFile(logPath, `${JSON.stringify(payload)}
`, 'utf8');
    return true;
  } catch (error) {
    console.warn('Audit log failure:', error.message);
    return false;
  }
}

module.exports = { appendAuditLog };
