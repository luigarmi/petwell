import assert from 'node:assert/strict';
import test from 'node:test';

import { AppointmentType, UserRole } from '@petwell/shared-types';

import { ClinicsService } from '../src/clinics.service';

test('searchPublicClinics filters by specialty and appointment type and strips internal staff payload', async () => {
  const service = new ClinicsService({
    clinic: {
      findMany: async () => [
        {
          id: 'clinic-1',
          name: 'Clinica Norte',
          phone: '300',
          address: 'Calle 1',
          city: 'Bogota',
          country: 'Colombia',
          logoUrl: null,
          website: null,
          specialties: ['cardiologia'],
          services: [
            {
              id: 'svc-1',
              name: 'Teleconsulta cardiologica',
              appointmentType: AppointmentType.TELEMED,
              durationMinutes: 30,
              priceCop: 90000,
              isTelemedAvailable: true
            }
          ],
          staff: [
            {
              specialties: ['cardiologia'],
              role: UserRole.VETERINARIAN,
              user: {
                id: 'vet-1',
                firstName: 'Ana',
                lastName: 'Lopez',
                professionalLicense: 'VET-1'
              }
            }
          ]
        },
        {
          id: 'clinic-2',
          name: 'Clinica Sur',
          phone: '301',
          address: 'Calle 2',
          city: 'Bogota',
          country: 'Colombia',
          logoUrl: null,
          website: null,
          specialties: ['dermatologia'],
          services: [
            {
              id: 'svc-2',
              name: 'Consulta presencial',
              appointmentType: AppointmentType.IN_PERSON,
              durationMinutes: 30,
              priceCop: 70000,
              isTelemedAvailable: false
            }
          ],
          staff: [
            {
              specialties: ['dermatologia'],
              role: UserRole.VETERINARIAN,
              user: {
                id: 'vet-2',
                firstName: 'Luis',
                lastName: 'Perez',
                professionalLicense: 'VET-2'
              }
            }
          ]
        }
      ]
    }
  } as never);

  const result = await service.searchPublicClinics({
    city: 'Bogota',
    specialty: 'cardio',
    appointmentType: AppointmentType.TELEMED
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'clinic-1');
  assert.equal('staff' in (result[0] as Record<string, unknown>), false);
  assert.equal(result[0]?.veterinarians[0]?.id, 'vet-1');
});
