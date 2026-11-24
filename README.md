# MediBook clinic appointment API

MediBook is a Node.js and Express REST API for managing clinic patients, doctors, and appointments. It uses MySQL with parameterized `mysql2` queries, Redis queues with a background worker, asynchronous audit logging, Jest tests, and an English/French course feedback page.

## Database design

The database contains exactly three entities: `patients`, `doctors`, and `appointments`. The appointments table links patients to doctors and stores booking, cancellation, refund, and durable queue state.

The structure is normalized to keep patient and doctor details in their own tables. `amount_paid` is stored on an appointment as a historical booking value, so a later change to a doctor's consultation fee does not change the recorded price of an existing appointment.

The schema diagram in the `database` folder shows the entities and their relationships:

![MediBook database schema diagram](<database/DATABASE SCHEME.drawio.png>)

The database scripts are [schema.sql](database/schema.sql) and [seed.sql](database/seed.sql). The seed contains three patients, three doctors (including one without appointments), and twelve appointments.

## Project structure

- `database/` — MySQL schema, sample data, and the one-time migration for existing databases
- `src/models/` — all application SQL and database operations
- `src/controllers/` — request handling and validation orchestration
- `src/routes/` — URL and HTTP method mappings
- `src/workers/appointmentWorker.js` — background waitlist and confirmation-job worker
- `src/utils/` — validation, Redis queue, and audit-log helpers
- `locales/` — English and French feedback page content
- `tests/` — Jest tests for validation, HTTP routes, and queue-worker behavior

No ORM is used. Application SQL is kept in model modules and uses parameterized queries.

## Requirements

- Node.js and npm
- Docker Desktop with Docker Compose, or existing MySQL and Redis services

## Setup and run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file and set a local MySQL password:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `DB_PASSWORD` to a password for your local development database. Do not commit `.env`; it is ignored by Git.

3. Start MySQL and Redis:

   ```bash
   docker compose up -d
   docker compose ps
   ```

   On its first initialization, MySQL loads `database/schema.sql` and `database/seed.sql`. Docker does not rerun these scripts for a database volume that has already been initialized.

   If you have an older database that predates the queue-state columns, apply `database/migrations/001_add_queue_outbox_columns.sql` once to that database. Do not run this one-time migration against a fresh database created from the current schema.

4. Start the API and its background worker:

   ```bash
   npm start
   ```

   The API listens on port `3000` by default. `GET http://localhost:3000/health` checks that the API is responding. The worker is started as a child process by the API.

5. Run the tests:

   ```bash
   npm test
   ```

To stop the local database services, run `docker compose down`. This keeps the database volumes and their data.

## API endpoints

All API routes use the `http://localhost:3000` base URL. Send JSON bodies with `Content-Type: application/json`.

### Health

- `GET /health`

### Patients

- `GET /api/patients` — list patients
- `GET /api/patients/:id` — get one patient
- `POST /api/patients` — create a patient (`name`, `email`, `phone`)
- `PUT /api/patients/:id` — update a patient
- `DELETE /api/patients/:id` — delete a patient when it is not referenced by an appointment

### Doctors

- `GET /api/doctors` — list doctors
- `GET /api/doctors/:id` — get one doctor
- `POST /api/doctors` — create a doctor (`name`, `specialty`, `consultationFee`, `room`)
- `PUT /api/doctors/:id` — update a doctor
- `DELETE /api/doctors/:id` — delete a doctor when it is not referenced by an appointment
- `GET /api/doctors/:id/statistics` — revenue, upcoming appointments, daily counts, and utilization
- `GET /api/doctors/reports` — appointment and revenue totals for every doctor
- `GET /api/doctors/busy-days` — doctor-days above 80% of daily capacity

### Appointments

- `GET /api/appointments` — list appointments with patient and doctor names
- `POST /api/appointments` — book an appointment (`patientId`, `doctorId`, `appointmentDatetime`)
- `DELETE /api/appointments/:id` — cancel an appointment; an optional JSON `reason` may be provided

Appointment datetimes should be ISO 8601 UTC values, for example `2026-12-01T09:00:00Z`.

### Feedback page

- `GET /feedback` — English feedback page
- `GET /feedback?lang=fr` — French feedback page
- An unsupported language falls back to English.

The page contains exactly five essay questions with prefilled, editable textareas. Its title, instructions, questions, and answer text are loaded from locale files, and the current date is formatted for the selected locale. This is a demonstration form; it does not persist submitted answers.

## Business rules and implementation decisions

### Booking and appointment capacity

- Appointments must be in the future, during 09:00–17:00 UTC, and aligned to a 30-minute boundary.
- A doctor can have at most 12 scheduled appointments per day.
- A doctor cannot have two scheduled appointments at the same date and time. The application checks this rule, and a MySQL unique constraint provides a database-level safeguard.
- A waitlist offer is made when the requested slot is occupied or the doctor's daily capacity is reached.

### Cancellation and refunds

Refunds are calculated on the server from the cancellation time to the appointment time:

- More than 48 hours' notice: 100%
- 24 to 48 hours' notice, including both boundaries: 50%
- Less than 24 hours' notice: 0%

The cancellation status and refund amount are updated in a single MySQL transaction. The refund is recorded and returned by the API; no payment gateway or real money transfer is implemented. A cancelled appointment remains in the database for history, and its slot can be booked again.

### Audit log

Successful bookings and cancellations are appended as JSON lines to `logs/audit.log` using asynchronous filesystem operations. The logger creates the directory when needed. A logging failure is reported but does not fail the user's booking or cancellation request.

### Redis queues and worker

Waitlist entries are stored in FIFO Redis lists partitioned by doctor and date. The worker handles pending cancellation promotions and confirmation jobs separately from the API request. Queue state is also recorded on the existing `appointments` rows, preserving the three-entity limit. Confirmation enqueueing is idempotent, and jobs in processing lists are restored after worker interruptions. If promotion or audit logging fails transiently, work remains retryable rather than being silently discarded.

### Reports

Doctor statistics and reports are calculated by SQL in the model layer using joins and aggregates. The doctors report includes doctors with no appointments; the busy-days report returns doctor/date combinations above 80% of the 12-appointment daily capacity.

## Tests

Jest tests run with `npm test` and do not require live MySQL or Redis connections. They cover refund tiers and boundaries, appointment-time validation, feedback page language/date/content, the appointment-list route, and waitlist retry behavior after a transient worker failure.
