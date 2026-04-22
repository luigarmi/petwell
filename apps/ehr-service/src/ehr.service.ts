import { randomUUID } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { RabbitMqEventBus, createEventPayload } from '@petwell/shared-events';
import { EVENT_NAMES, JwtUserClaims, UserRole } from '@petwell/shared-types';
import { decryptString, encryptString } from '@petwell/shared-utils';

import { env } from './config';
import { canAccessClinicalRecord } from './access.utils';
import { CreateConsentDto, CreateEhrRecordDto } from './dto/ehr.dto';
import { PrismaService } from './prisma.service';
import { StorageService } from './storage.service';

type EhrAttachment = {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
};

type PetAccessProfile = {
  id: string;
  ownerId: string;
  ownerIds?: string[];
  coOwnerIds?: string[];
  mainClinicId?: string | null;
};

type EhrRecordView = {
  id: string;
  petId: string;
  clinicId: string;
  veterinarianId: string;
  appointmentId: string | null;
  consultation: string;
  reasonForVisit: string | null;
  anamnesis: string | null;
  physicalExam: string | null;
  diagnosis: string;
  vaccines: string;
  treatments: string | null;
  prescriptions: string;
  labResults: string;
  imagingReports: string | null;
  clinicalNotes: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  attachments: EhrAttachment[];
};

@Injectable()
export class EhrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: RabbitMqEventBus,
    private readonly httpService: HttpService,
    private readonly storageService: StorageService
  ) {}

  async createRecord(user: JwtUserClaims, dto: CreateEhrRecordDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN].includes(user.role)) {
      throw new ForbiddenException('You are not allowed to create clinical records');
    }

    const petProfile = await this.getPetAccessProfile(dto.petId);
    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(petProfile.mainClinicId ?? '')) {
      throw new ForbiddenException('You do not have access to create records for this pet');
    }

    const clinicId = user.role === UserRole.SUPERADMIN ? dto.clinicId : petProfile.mainClinicId ?? user.clinicIds[0];
    if (!clinicId) {
      throw new ForbiddenException('clinicId is required');
    }

    const created = await this.prisma.ehrRecord.create({
      data: {
        id: randomUUID(),
        petId: dto.petId,
        clinicId,
        veterinarianId: user.sub,
        appointmentId: dto.appointmentId,
        consultationEncrypted: this.encrypt(dto.consultation),
        reasonForVisitEncrypted: dto.reasonForVisit ? this.encrypt(dto.reasonForVisit) : null,
        anamnesisEncrypted: dto.anamnesis ? this.encrypt(dto.anamnesis) : null,
        physicalExamEncrypted: dto.physicalExam ? this.encrypt(dto.physicalExam) : null,
        diagnosisEncrypted: this.encrypt(dto.diagnosis),
        vaccinesEncrypted: this.encrypt(dto.vaccines),
        treatmentsEncrypted: dto.treatments ? this.encrypt(dto.treatments) : null,
        prescriptionsEncrypted: this.encrypt(dto.prescriptions),
        labResultsEncrypted: this.encrypt(dto.labResults),
        imagingReportsEncrypted: dto.imagingReports ? this.encrypt(dto.imagingReports) : null,
        clinicalNotesEncrypted: this.encrypt(dto.clinicalNotes),
        createdByUserId: user.sub
      }
    });

    return this.serializeRecord(created);
  }

  async listRecordsByPet(user: JwtUserClaims, petId: string, reason?: string) {
    const records = await this.prisma.ehrRecord.findMany({
      where: {
        petId,
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (user.role === UserRole.PET_OWNER) {
      await this.assertPetOwnerAccess(user, petId);

      const ownerVisibleRecords = [];
      for (const record of records) {
        await this.auditAccess(user, record.id, record.petId, reason);
        ownerVisibleRecords.push(await this.serializeRecord(record));
      }

      return ownerVisibleRecords;
    }

    const consents = await this.prisma.clinicConsent.findMany({
      where: { petId }
    });

    const visibleRecords = [];
    for (const record of records) {
      if (!canAccessClinicalRecord(user, record, consents)) {
        continue;
      }

      await this.auditAccess(user, record.id, record.petId, reason);
      visibleRecords.push(await this.serializeRecord(record));
    }

    if (visibleRecords.length === 0 && records.length > 0) {
      throw new ForbiddenException('You do not have access to this pet EHR');
    }

    return visibleRecords;
  }

  async getRecordById(user: JwtUserClaims, recordId: string, reason?: string) {
    const record = await this.prisma.ehrRecord.findUnique({
      where: { id: recordId }
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException('Clinical record not found');
    }

    if (user.role === UserRole.PET_OWNER) {
      await this.assertPetOwnerAccess(user, record.petId);
      await this.auditAccess(user, record.id, record.petId, reason);
      return this.serializeRecord(record);
    }

    const consents = await this.prisma.clinicConsent.findMany({
      where: { petId: record.petId }
    });

    if (!canAccessClinicalRecord(user, record, consents)) {
      throw new ForbiddenException('You do not have access to this clinical record');
    }

    await this.auditAccess(user, record.id, record.petId, reason);
    return this.serializeRecord(record);
  }

  async downloadRecord(user: JwtUserClaims, recordId: string, reason?: string) {
    const record = await this.getRecordById(user, recordId, reason ?? 'download');
    const fileName = `historia-clinica-${this.safeFilePart(record.petId)}-${record.id.slice(-8).toLowerCase()}.txt`;

    const sections = [
      ['Registro', record.id],
      ['Mascota', record.petId],
      ['Clinica', record.clinicId],
      ['Veterinario', record.veterinarianId],
      ['Cita', record.appointmentId ?? 'Sin cita asociada'],
      ['Creado', this.formatDate(record.createdAt)],
      ['Actualizado', this.formatDate(record.updatedAt)],
      ['Consulta', record.consultation],
      ['Motivo de visita', record.reasonForVisit ?? 'Sin dato'],
      ['Anamnesis', record.anamnesis ?? 'Sin dato'],
      ['Examen fisico', record.physicalExam ?? 'Sin dato'],
      ['Diagnostico', record.diagnosis],
      ['Vacunas', record.vaccines],
      ['Tratamientos', record.treatments ?? 'Sin dato'],
      ['Prescripciones', record.prescriptions],
      ['Resultados de laboratorio', record.labResults],
      ['Reportes de imagenes', record.imagingReports ?? 'Sin dato'],
      ['Notas clinicas', record.clinicalNotes],
      ['Archivos adjuntos', record.attachments.length ? record.attachments.map((file) => file.fileName).join(', ') : 'Sin archivos adjuntos']
    ];

    const contents = Buffer.from(
      ['PETWELL - HISTORIA CLINICA', '', ...sections.map(([title, value]) => `${title}\n${value}\n`) ].join('\n'),
      'utf-8'
    );

    return { fileName, contents };
  }

  async uploadAttachments(
    user: JwtUserClaims,
    recordId: string,
    files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>
  ) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN].includes(user.role)) {
      throw new ForbiddenException('You are not allowed to upload clinical files');
    }

    const record = await this.prisma.ehrRecord.findUnique({
      where: { id: recordId }
    });

    if (!record || record.deletedAt) {
      throw new NotFoundException('Clinical record not found');
    }

    const consents = await this.prisma.clinicConsent.findMany({
      where: { petId: record.petId }
    });

    if (user.role !== UserRole.SUPERADMIN && !canAccessClinicalRecord(user, record, consents)) {
      throw new ForbiddenException('You do not have access to this clinical record');
    }

    const validFiles = files.filter((file) => file?.buffer?.length);
    if (validFiles.length === 0) {
      return [];
    }

    return this.storageService.uploadAttachments(recordId, validFiles);
  }

  async downloadAttachment(user: JwtUserClaims, recordId: string, attachmentId: string, reason?: string) {
    await this.getRecordById(user, recordId, reason ?? 'attachment_download');
    return this.storageService.downloadAttachment(recordId, attachmentId);
  }

  async createConsent(user: JwtUserClaims, dto: CreateConsentDto) {
    if (![UserRole.SUPERADMIN, UserRole.CLINIC_ADMIN, UserRole.VETERINARIAN].includes(user.role)) {
      throw new ForbiddenException('You are not allowed to manage consent');
    }

    const sourceClinicId = user.role === UserRole.SUPERADMIN ? dto.sourceClinicId : user.clinicIds[0];
    if (!sourceClinicId) {
      throw new ForbiddenException('sourceClinicId is required');
    }

    return this.prisma.clinicConsent.upsert({
      where: {
        petId_sourceClinicId_targetClinicId: {
          petId: dto.petId,
          sourceClinicId,
          targetClinicId: dto.targetClinicId
        }
      },
      update: {
        purpose: dto.purpose,
        scopeSummary: dto.scopeSummary,
        ownerApprovedByUserId: dto.ownerApprovedByUserId,
        ownerApprovedAt: dto.ownerApprovedAt ? new Date(dto.ownerApprovedAt) : null,
        revokedAt: null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        grantedByUserId: user.sub
      },
      create: {
        id: randomUUID(),
        petId: dto.petId,
        sourceClinicId,
        targetClinicId: dto.targetClinicId,
        grantedByUserId: user.sub,
        purpose: dto.purpose,
        scopeSummary: dto.scopeSummary,
        ownerApprovedByUserId: dto.ownerApprovedByUserId,
        ownerApprovedAt: dto.ownerApprovedAt ? new Date(dto.ownerApprovedAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null
      }
    });
  }

  async revokeConsent(user: JwtUserClaims, consentId: string) {
    const consent = await this.prisma.clinicConsent.findUnique({
      where: { id: consentId }
    });

    if (!consent) {
      throw new NotFoundException('Consent not found');
    }

    if (user.role !== UserRole.SUPERADMIN && !user.clinicIds.includes(consent.sourceClinicId)) {
      throw new ForbiddenException('You cannot revoke this consent');
    }

    return this.prisma.clinicConsent.update({
      where: { id: consentId },
      data: { revokedAt: new Date() }
    });
  }

  async listConsents(user: JwtUserClaims, petId: string) {
    const consents = await this.prisma.clinicConsent.findMany({
      where: { petId },
      orderBy: { grantedAt: 'desc' }
    });

    if (user.role === UserRole.PET_OWNER) {
      await this.assertPetOwnerAccess(user, petId);
      return consents;
    }

    if (
      user.role !== UserRole.SUPERADMIN &&
      !consents.some((consent) => user.clinicIds.includes(consent.sourceClinicId) || user.clinicIds.includes(consent.targetClinicId))
    ) {
      throw new ForbiddenException('You do not have access to these consents');
    }

    return consents;
  }

  async listAccessAudit(user: JwtUserClaims, petId: string) {
    const audits = await this.prisma.accessAudit.findMany({
      where: { petId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    if (user.role === UserRole.PET_OWNER) {
      await this.assertPetOwnerAccess(user, petId);
      return audits;
    }

    if (
      user.role !== UserRole.SUPERADMIN &&
      audits.length > 0 &&
      !audits.some((audit) => audit.actorClinicId && user.clinicIds.includes(audit.actorClinicId))
    ) {
      throw new ForbiddenException('You do not have access to this audit trail');
    }

    return audits;
  }

  private async serializeRecord(record: {
    id: string;
    petId: string;
    clinicId: string;
    veterinarianId: string;
    appointmentId: string | null;
    consultationEncrypted: string;
    reasonForVisitEncrypted: string | null;
    anamnesisEncrypted: string | null;
    physicalExamEncrypted: string | null;
    diagnosisEncrypted: string;
    vaccinesEncrypted: string;
    treatmentsEncrypted: string | null;
    prescriptionsEncrypted: string;
    labResultsEncrypted: string;
    imagingReportsEncrypted: string | null;
    clinicalNotesEncrypted: string;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const attachments = await this.storageService.listAttachments(record.id);

    return {
      id: record.id,
      petId: record.petId,
      clinicId: record.clinicId,
      veterinarianId: record.veterinarianId,
      appointmentId: record.appointmentId,
      consultation: this.decrypt(record.consultationEncrypted),
      reasonForVisit: record.reasonForVisitEncrypted ? this.decrypt(record.reasonForVisitEncrypted) : null,
      anamnesis: record.anamnesisEncrypted ? this.decrypt(record.anamnesisEncrypted) : null,
      physicalExam: record.physicalExamEncrypted ? this.decrypt(record.physicalExamEncrypted) : null,
      diagnosis: this.decrypt(record.diagnosisEncrypted),
      vaccines: this.decrypt(record.vaccinesEncrypted),
      treatments: record.treatmentsEncrypted ? this.decrypt(record.treatmentsEncrypted) : null,
      prescriptions: this.decrypt(record.prescriptionsEncrypted),
      labResults: this.decrypt(record.labResultsEncrypted),
      imagingReports: record.imagingReportsEncrypted ? this.decrypt(record.imagingReportsEncrypted) : null,
      clinicalNotes: this.decrypt(record.clinicalNotesEncrypted),
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attachments
    } satisfies EhrRecordView;
  }

  private async auditAccess(user: JwtUserClaims, recordId: string, petId: string, reason?: string) {
    await this.prisma.accessAudit.create({
      data: {
        id: randomUUID(),
        recordId,
        petId,
        actorUserId: user.sub,
        actorRole: user.role,
        actorClinicId: user.clinicIds[0],
        action: 'read',
        reason
      }
    });

    await this.eventBus.publish(
      EVENT_NAMES.EHR_RECORD_ACCESSED,
      createEventPayload({
        recordId,
        petId,
        actorUserId: user.sub,
        actorRole: user.role,
        clinicId: user.clinicIds[0],
        reason,
        accessedAt: new Date().toISOString()
      })
    );
  }

  private encrypt(value: string) {
    return encryptString(value, env.FIELD_ENCRYPTION_KEY);
  }

  private decrypt(value: string) {
    return decryptString(value, env.FIELD_ENCRYPTION_KEY);
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(value);
  }

  private safeFilePart(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  }

  private async assertPetOwnerAccess(user: JwtUserClaims, petId: string) {
    if (user.role !== UserRole.PET_OWNER) {
      return;
    }

    const accessProfile = await this.getPetAccessProfile(petId);
    const ownerIds = accessProfile.ownerIds?.length ? accessProfile.ownerIds : [accessProfile.ownerId];
    if (!ownerIds.includes(user.sub)) {
      throw new ForbiddenException('You do not have access to this pet EHR');
    }
  }

  private async getPetAccessProfile(petId: string) {
    const response: { data: PetAccessProfile } = await firstValueFrom(
      this.httpService.get<PetAccessProfile>(`${env.PET_SERVICE_URL}/pets/internal/${petId}/access-profile`)
    );

    return response.data;
  }
}
