import assert from 'node:assert/strict';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost/api';
const password = 'Petwell123!';
const readinessUrl = `${baseUrl}/health/ready`;

type Session = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: string;
    clinicIds: string[];
    firstName: string;
  };
};

type GatewayReadiness = {
  checks?: Array<{
    critical: boolean;
    error?: string;
    name: string;
    status: string;
  }>;
  ready: boolean;
  service: string;
  status: string;
};

async function request<T>(path: string, options: RequestInit = {}, token?: string, expectOk = true): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok && expectOk) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function login(email: string, pwd = password) {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: pwd })
  });
}

async function poll<T>(label: string, fn: () => Promise<T>, predicate: (value: T) => boolean, attempts = 12, delayMs = 1000) {
  for (let index = 0; index < attempts; index += 1) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Polling timed out: ${label}`);
}

async function waitForGatewayReadiness(attempts = 24, delayMs = 5000) {
  let lastError = 'Gateway readiness did not respond.';

  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(readinessUrl, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        lastError = `Gateway readiness returned HTTP ${response.status}: ${await response.text()}`;
      } else {
        const report = (await response.json()) as GatewayReadiness;

        if (report.ready) {
          return report;
        }

        const downChecks = report.checks
          ?.filter((check) => check.status !== 'up')
          .map((check) => `${check.name}${check.error ? ` (${check.error})` : ''}`)
          .join(', ');
        lastError = `Gateway not ready yet. Status=${report.status}. Down checks: ${downChecks ?? 'unknown'}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown readiness error';
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Gateway readiness timed out at ${readinessUrl}. Last error: ${lastError}`);
}

function nextBusinessDay(daysAhead = 2) {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return {
    dateOnly: target.toISOString().slice(0, 10),
    weekday: target.getUTCDay()
  };
}

async function main() {
  await waitForGatewayReadiness();

  const clinicSuffix = Date.now().toString().slice(-6);
  const ownerEmail = `owner.${clinicSuffix}@petwell.local`;
  const clinicEmail = `clinic.${clinicSuffix}@petwell.local`;
  const vetEmail = `vet.${clinicSuffix}@petwell.local`;
  const recepEmail = `recep.${clinicSuffix}@petwell.local`;
  const clinicAdminEmail = `admin.${clinicSuffix}@petwell.local`;
  const clinicPassword = 'ClinicAdmin123!';
  const vetPassword = 'VetAccess123!';
  const { dateOnly, weekday } = nextBusinessDay();

  const superadmin = await login('superadmin@petwell.local');

  const clinic = await request<{ id: string }>(
    '/clinics',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Clinica E2E ${clinicSuffix}`,
        email: clinicEmail,
        phone: '6017000000',
        address: 'Calle E2E 123',
        city: 'Bogota',
        country: 'Colombia',
        specialties: ['medicina general', 'telemedicina']
      })
    },
    superadmin.accessToken
  );

  const clinicAdmin = await request<{ user: { id: string } }>(
    `/clinics/${clinic.id}/staff`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: clinicAdminEmail,
        firstName: 'Clara',
        lastName: 'Admin',
        phone: '3005550001',
        role: 'clinic_admin',
        password: clinicPassword
      })
    },
    superadmin.accessToken
  );

  const vet = await request<{ user: { id: string } }>(
    `/clinics/${clinic.id}/staff`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: vetEmail,
        firstName: 'Victor',
        lastName: 'Vet',
        phone: '3005550002',
        role: 'veterinarian',
        professionalLicense: `E2E-${clinicSuffix}`,
        password: vetPassword
      })
    },
    superadmin.accessToken
  );

  await request(
    `/clinics/${clinic.id}/staff`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: recepEmail,
        firstName: 'Rosa',
        lastName: 'Recep',
        phone: '3005550003',
        role: 'receptionist',
        password: clinicPassword
      })
    },
    superadmin.accessToken
  );

  await request(
    `/clinics/${clinic.id}/services`,
    {
      method: 'POST',
      body: JSON.stringify({
        appointmentType: 'in_person',
        name: 'Consulta general',
        durationMinutes: 30,
        priceCop: 90000,
        isTelemedAvailable: false
      })
    },
    superadmin.accessToken
  );

  await request(
    `/clinics/${clinic.id}/services`,
    {
      method: 'POST',
      body: JSON.stringify({
        appointmentType: 'telemed',
        name: 'Teleconsulta',
        durationMinutes: 30,
        priceCop: 85000,
        isTelemedAvailable: true
      })
    },
    superadmin.accessToken
  );

  await request(
    '/schedules',
    {
      method: 'POST',
      body: JSON.stringify({
        clinicId: clinic.id,
        veterinarianId: vet.user.id,
        weekday,
        startTime: '10:00',
        endTime: '12:00',
        slotDurationMinutes: 30
      })
    },
    superadmin.accessToken
  );

  const owner = await request<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Olivia',
      lastName: 'Owner',
      email: ownerEmail,
      phone: '3006000000',
      password
    })
  });

  const pet = await request<{ id: string }>(
    '/pets',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Nube',
        species: 'dog',
        breed: 'Criollo',
        sex: 'female',
        weightKg: 12.4,
        birthDate: '2021-01-05',
        mainClinicId: clinic.id
      })
    },
    owner.accessToken
  );

  const availability = await request<Array<{ startsAt: string; available: boolean }>>(
    `/availability?clinicId=${clinic.id}&veterinarianId=${vet.user.id}&date=${dateOnly}`
  );
  const firstSlot = availability.find((slot) => slot.available);
  assert.ok(firstSlot, 'Expected an available slot');

  const appointment = await request<{ id: string; status: string }>(
    '/appointments',
    {
      method: 'POST',
      body: JSON.stringify({
        clinicId: clinic.id,
        veterinarianId: vet.user.id,
        petId: pet.id,
        appointmentType: 'in_person',
        startsAt: firstSlot!.startsAt
      })
    },
    owner.accessToken
  );
  assert.equal(appointment.status, 'pending_payment');

  const payment = await poll(
    'payment creation',
    () => request<{ id: string; status: string }>(`/billing/payments/appointment/${appointment.id}/latest`, {}, owner.accessToken),
    (value) => Boolean(value.id)
  );

  const approvedPayment = await request<{ status: string }>(
    `/billing/payments/${payment.id}/mock/approve`,
    { method: 'POST' },
    owner.accessToken
  );
  assert.equal(approvedPayment.status, 'approved');

  const confirmedAppointment = await poll(
    'appointment confirmation',
    () => request<{ status: string }>(`/appointments/${appointment.id}`, {}, owner.accessToken),
    (value) => value.status === 'confirmed'
  );
  assert.equal(confirmedAppointment.status, 'confirmed');

  const notifications = await poll(
    'notification delivery',
    () => request<Array<{ template: string }>>('/notifications/me', {}, owner.accessToken),
    (value) => value.some((notification) => notification.template === 'appointment-confirmed')
  );
  assert.equal(notifications.some((notification) => notification.template === 'appointment-confirmed'), true);

  const vetSession = await login(vetEmail, vetPassword);
  const ehrRecord = await request<{ id: string }>(
    '/ehr/records',
    {
      method: 'POST',
      body: JSON.stringify({
        petId: pet.id,
        consultation: 'Consulta e2e',
        diagnosis: 'Paciente estable',
        vaccines: 'No aplica',
        prescriptions: 'Ninguna',
        labResults: 'No aplica',
        clinicalNotes: 'Observación e2e'
      })
    },
    vetSession.accessToken
  );

  const allowedEhr = await request<Array<{ id: string }>>(`/ehr/records/pet/${pet.id}?reason=e2e_authorized`, {}, vetSession.accessToken);
  assert.equal(allowedEhr.some((record) => record.id === ehrRecord.id), true);

  const foreignVet = await login('vet3@petwell.local');
  const forbiddenResponse = await fetch(`${baseUrl}/ehr/records/pet/${pet.id}?reason=e2e_forbidden`, {
    headers: {
      Authorization: `Bearer ${foreignVet.accessToken}`
    }
  });
  assert.equal(forbiddenResponse.status, 403);

  const secondSlot = availability.filter((slot) => slot.available)[1];
  assert.ok(secondSlot, 'Expected a second available slot for telemed');

  const telemedAppointment = await request<{ id: string }>(
    '/appointments',
    {
      method: 'POST',
      body: JSON.stringify({
        clinicId: clinic.id,
        veterinarianId: vet.user.id,
        petId: pet.id,
        appointmentType: 'telemed',
        startsAt: secondSlot!.startsAt
      })
    },
    owner.accessToken
  );

  const telemedPayment = await poll(
    'telemed payment creation',
    () => request<{ id: string }>(`/billing/payments/appointment/${telemedAppointment.id}/latest`, {}, owner.accessToken),
    (value) => Boolean(value.id)
  );

  await request(`/billing/payments/${telemedPayment.id}/mock/approve`, { method: 'POST' }, owner.accessToken);

  const room = await poll(
    'telemed room creation',
    () => request<{ roomUrl: string }>(`/telemed/rooms/appointment/${telemedAppointment.id}`, {}, owner.accessToken),
    (value) => Boolean(value.roomUrl),
    15,
    1000
  );
  assert.equal(room.roomUrl.includes('/telemed/'), true);

  console.log('Critical E2E flow completed successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
