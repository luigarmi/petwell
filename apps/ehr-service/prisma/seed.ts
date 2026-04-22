import { PrismaClient } from '@petwell/prisma-ehr-service-client';

import { DEMO_IDS } from '@petwell/shared-types';
import { encryptString } from '@petwell/shared-utils';

const prisma = new PrismaClient();
const encryptionKey = process.env.FIELD_ENCRYPTION_KEY ?? 'change-me-32-byte-field-key-123456';

function encrypt(value: string) {
  return encryptString(value, encryptionKey);
}

function addDays(date: Date, days: number, hour: number, minute: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

async function main() {
  await prisma.accessAudit.deleteMany();
  await prisma.clinicConsent.deleteMany();
  await prisma.ehrRecord.deleteMany();

  const now = new Date();

  const records = [
    {
      id: DEMO_IDS.ehr.lunaConsultation,
      petId: DEMO_IDS.pets.luna,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      appointmentId: DEMO_IDS.appointments.completedNorth,
      consultation: 'Consulta general por control anual y chequeo de peso.',
      reasonForVisit: 'Chequeo anual y ajuste de plan nutricional.',
      anamnesis: 'La tutora reporta apetito estable y menor tolerancia al ejercicio.',
      physicalExam: 'Condicion corporal 7/9, mucosas rosadas, frecuencia cardiaca estable.',
      diagnosis: 'Paciente estable con sobrepeso leve.',
      vaccines: 'Vacunacion completa vigente.',
      treatments: 'Plan nutricional hipocalorico y caminatas controladas.',
      prescriptions: 'Suplemento articular por 30 dias.',
      labResults: 'Hemograma dentro de rangos normales.',
      imagingReports: 'No requiere estudios de imagen en esta visita.',
      clinicalNotes: 'Continuar ejercicio moderado y ajustar porciones.',
      createdAt: addDays(now, -14, 10, 45)
    },
    {
      id: DEMO_IDS.ehr.maxConsultation,
      petId: DEMO_IDS.pets.max,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
      appointmentId: DEMO_IDS.appointments.telemedCompletedNorth,
      consultation: 'Teleconsulta por vomito ocasional.',
      reasonForVisit: 'Evaluacion digestiva remota posterior a un episodio de vomito.',
      anamnesis: 'Vomito aislado, sin diarrea, hidratacion conservada segun tutor.',
      physicalExam: 'Sin examen fisico presencial; se revisa estado general por videollamada.',
      diagnosis: 'Gastritis leve presuntiva.',
      vaccines: 'Vacunacion al dia.',
      treatments: 'Reposo digestivo y seguimiento remoto en 48 horas.',
      prescriptions: 'Dieta blanda por 48 horas.',
      labResults: 'Sin laboratorios solicitados.',
      imagingReports: 'Sin estudios de imagen indicados.',
      clinicalNotes: 'Monitorear apetito y recurrencia.',
      createdAt: addDays(now, -7, 16, 40)
    },
    {
      id: DEMO_IDS.ehr.ninaConsultation,
      petId: DEMO_IDS.pets.nina,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      consultation: 'Control dermatologico por prurito.',
      reasonForVisit: 'Prurito recurrente con lesion interdigital.',
      anamnesis: 'Episodios repetidos tras paseos en parque y exposicion a polen.',
      physicalExam: 'Eritema leve en abdomen ventral y espacios interdigitales.',
      diagnosis: 'Dermatitis alergica.',
      vaccines: 'Vacunas completas.',
      treatments: 'Bano medicado semanal y control ambiental.',
      prescriptions: 'Shampoo medicado y antihistaminico.',
      labResults: 'Citologia compatible con inflamacion leve.',
      imagingReports: 'No aplica.',
      clinicalNotes: 'Control en 15 dias.',
      createdAt: addDays(now, -28, 9, 20)
    },
    {
      id: DEMO_IDS.ehr.rockyConsultation,
      petId: DEMO_IDS.pets.rocky,
      clinicId: DEMO_IDS.clinics.south,
      veterinarianId: DEMO_IDS.users.veterinarianSouthPrimary,
      appointmentId: DEMO_IDS.appointments.emergencySouthCompleted,
      consultation: 'Atencion por vomito y dolor abdominal agudo.',
      reasonForVisit: 'Urgencia digestiva con dolor abdominal y vomito.',
      anamnesis: 'Inicio agudo hace 12 horas, anorexia parcial y un episodio de diarrea.',
      physicalExam: 'Dolor abdominal moderado a la palpacion, hidratacion adecuada.',
      diagnosis: 'Gastroenteritis controlada sin deshidratacion severa.',
      vaccines: 'No aplica durante la urgencia.',
      treatments: 'Fluidoterapia corta y manejo gastrico inicial.',
      prescriptions: 'Protector gastrico y dieta gastrointestinal por 5 dias.',
      labResults: 'Hemograma con leucocitosis leve.',
      imagingReports: 'Ecografia abdominal sin obstruccion evidente.',
      clinicalNotes: 'Control presencial en 48 horas.',
      createdAt: addDays(now, -1, 19, 15)
    },
    {
      id: DEMO_IDS.ehr.lunaFollowUp,
      petId: DEMO_IDS.pets.luna,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthPrimary,
      consultation: 'Seguimiento nutricional posterior al control anual.',
      reasonForVisit: 'Revaluacion de peso y adherencia al plan.',
      anamnesis: 'Tutor reporta mejor tolerancia al ejercicio y adherencia alta a la dieta.',
      physicalExam: 'Condicion corporal 6/9, sin hallazgos agudos.',
      diagnosis: 'Evolucion favorable con perdida de peso controlada.',
      vaccines: 'Sin cambios.',
      treatments: 'Mantener plan alimentario y ejercicio progresivo.',
      prescriptions: 'Continuar dieta hipoalergenica.',
      labResults: 'Perfil metabolico normal.',
      imagingReports: 'Sin imagenologia requerida.',
      clinicalNotes: 'Revisar condicion corporal en 6 semanas.',
      createdAt: addDays(now, -9, 8, 30)
    },
    {
      id: DEMO_IDS.ehr.maxFollowUp,
      petId: DEMO_IDS.pets.max,
      clinicId: DEMO_IDS.clinics.north,
      veterinarianId: DEMO_IDS.users.veterinarianNorthSecondary,
      consultation: 'Seguimiento virtual posterior a gastroenteritis.',
      reasonForVisit: 'Control remoto tras tratamiento digestivo.',
      anamnesis: 'Sin vomitos nuevos, apetito normal desde hace 72 horas.',
      physicalExam: 'Seguimiento por telemedicina sin examen presencial.',
      diagnosis: 'Sin nuevos episodios digestivos.',
      vaccines: 'Plan vacunal vigente.',
      treatments: 'Reintroduccion gradual de dieta habitual.',
      prescriptions: 'Suspender dieta blanda y regresar a concentrado habitual.',
      labResults: 'No se requieren examenes adicionales.',
      imagingReports: 'No aplica.',
      clinicalNotes: 'Alta medica si no hay recaidas.',
      createdAt: addDays(now, -5, 11, 0)
    }
  ];

  for (const record of records) {
    await prisma.ehrRecord.create({
      data: {
        id: record.id,
        petId: record.petId,
        clinicId: record.clinicId,
        veterinarianId: record.veterinarianId,
        appointmentId: record.appointmentId,
        consultationEncrypted: encrypt(record.consultation),
        reasonForVisitEncrypted: encrypt(record.reasonForVisit),
        anamnesisEncrypted: encrypt(record.anamnesis),
        physicalExamEncrypted: encrypt(record.physicalExam),
        diagnosisEncrypted: encrypt(record.diagnosis),
        vaccinesEncrypted: encrypt(record.vaccines),
        treatmentsEncrypted: encrypt(record.treatments),
        prescriptionsEncrypted: encrypt(record.prescriptions),
        labResultsEncrypted: encrypt(record.labResults),
        imagingReportsEncrypted: encrypt(record.imagingReports),
        clinicalNotesEncrypted: encrypt(record.clinicalNotes),
        createdByUserId: record.veterinarianId,
        createdAt: record.createdAt
      }
    });
  }

  await prisma.clinicConsent.createMany({
    data: [
      {
        id: 'consent_luna_north_to_south',
        petId: DEMO_IDS.pets.luna,
        sourceClinicId: DEMO_IDS.clinics.north,
        targetClinicId: DEMO_IDS.clinics.south,
        grantedByUserId: DEMO_IDS.users.clinicAdminNorth,
        purpose: 'Segunda opinion nutricional y continuidad asistencial.',
        scopeSummary: 'Acceso integral al historial medico y planes de seguimiento.',
        ownerApprovedByUserId: DEMO_IDS.users.ownerAna,
        ownerApprovedAt: addDays(now, -20, 14, 40),
        grantedAt: addDays(now, -20, 15, 0)
      },
      {
        id: 'consent_rocky_south_to_north',
        petId: DEMO_IDS.pets.rocky,
        sourceClinicId: DEMO_IDS.clinics.south,
        targetClinicId: DEMO_IDS.clinics.north,
        grantedByUserId: DEMO_IDS.users.clinicAdminSouth,
        purpose: 'Reconsulta externa para revision de emergencia digestiva.',
        scopeSummary: 'Historia reciente, examenes y tratamiento de urgencias.',
        ownerApprovedByUserId: DEMO_IDS.users.ownerCarla,
        ownerApprovedAt: addDays(now, -4, 11, 35),
        grantedAt: addDays(now, -4, 12, 0),
        expiresAt: addDays(now, 10, 12, 0)
      }
    ]
  });

  await prisma.accessAudit.createMany({
    data: [
      {
        id: 'audit_luna_record_1',
        recordId: DEMO_IDS.ehr.lunaConsultation,
        petId: DEMO_IDS.pets.luna,
        actorUserId: DEMO_IDS.users.clinicAdminNorth,
        actorRole: 'clinic_admin',
        actorClinicId: DEMO_IDS.clinics.north,
        action: 'read',
        reason: 'follow_up_review',
        createdAt: addDays(now, -8, 10, 15)
      },
      {
        id: 'audit_luna_record_2',
        recordId: DEMO_IDS.ehr.lunaFollowUp,
        petId: DEMO_IDS.pets.luna,
        actorUserId: DEMO_IDS.users.veterinarianSouthPrimary,
        actorRole: 'veterinarian',
        actorClinicId: DEMO_IDS.clinics.south,
        action: 'read',
        reason: 'cross_clinic_consult',
        createdAt: addDays(now, -3, 9, 10)
      },
      {
        id: 'audit_max_record_1',
        recordId: DEMO_IDS.ehr.maxConsultation,
        petId: DEMO_IDS.pets.max,
        actorUserId: DEMO_IDS.users.ownerAna,
        actorRole: 'pet_owner',
        action: 'read',
        reason: 'owner_portal_review',
        createdAt: addDays(now, -4, 7, 45)
      },
      {
        id: 'audit_rocky_record_1',
        recordId: DEMO_IDS.ehr.rockyConsultation,
        petId: DEMO_IDS.pets.rocky,
        actorUserId: DEMO_IDS.users.clinicAdminSouth,
        actorRole: 'clinic_admin',
        actorClinicId: DEMO_IDS.clinics.south,
        action: 'read',
        reason: 'quality_audit',
        createdAt: addDays(now, -1, 20, 0)
      }
    ]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
