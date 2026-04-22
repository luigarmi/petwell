import { Buffer } from 'node:buffer';

import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { env } from './config';

type ReceiptPayload = {
  id: string;
  appointmentId: string;
  amountCop: number;
  currency: string;
  approvedAt?: Date | null;
  createdAt?: Date | null;
  provider: string;
  status: string;
  appointmentType?: string | null;
  startsAt?: string | null;
};

@Injectable()
export class StorageService {
  private readonly client = new S3Client({
    endpoint: `${env.MINIO_USE_SSL ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY
    }
  });
  private bucketReady = false;

  async uploadReceipt(payment: ReceiptPayload) {
    await this.ensureBucket();

    const document = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    const buffer = await new Promise<Buffer>((resolve) => {
      document.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      document.on('end', () => resolve(Buffer.concat(chunks)));

      const formatCurrency = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0
        }).format(amount);

      const formatDate = (value?: Date | string | null) => {
        if (!value) {
          return 'Sin fecha';
        }

        return new Intl.DateTimeFormat('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date(value));
      };

      const shortReference = (value: string) => (value.length <= 8 ? value.toUpperCase() : value.slice(-8).toUpperCase());
      const startCase = (value?: string | null) =>
        value
          ? value
              .replace(/[_-]+/g, ' ')
              .split(' ')
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
              .join(' ')
          : 'Sin dato';
      const pageWidth = document.page.width - document.page.margins.left - document.page.margins.right;
      const left = document.page.margins.left;
      const top = document.page.margins.top;
      const navy = '#173F5F';
      const muted = '#62707C';
      const paper = '#F4F6F8';
      const text = '#24323F';

      const drawInfoCard = (x: number, y: number, width: number, title: string, value: string) => {
        document.roundedRect(x, y, width, 62, 14).fillAndStroke(paper, '#E2E8EC');
        document.fillColor(muted).fontSize(9).text(title.toUpperCase(), x + 14, y + 12, { width: width - 28 });
        document.fillColor(text).fontSize(12).text(value, x + 14, y + 28, {
          width: width - 28
        });
      };

      document.roundedRect(left, top, pageWidth, 124, 24).fill(navy);
      document.fillColor('#FFFFFF').fontSize(11).text('PETWELL', left + 24, top + 24);
      document.fontSize(26).text('Recibo de pago', left + 24, top + 46);
      document.fontSize(11).fillColor('#D9E3EA').text('Comprobante generado por la plataforma de atencion veterinaria.', left + 24, top + 84);

      document.fillColor('#FFFFFF').fontSize(10).text(`Ref. pago ${shortReference(payment.id)}`, left + pageWidth - 160, top + 28, {
        width: 136,
        align: 'right'
      });
      document.text(`Ref. cita ${shortReference(payment.appointmentId)}`, left + pageWidth - 160, top + 46, {
        width: 136,
        align: 'right'
      });

      document.roundedRect(left, top + 146, pageWidth, 118, 22).fillAndStroke('#FFFFFF', '#E7ECEF');
      document.fillColor(muted).fontSize(10).text('Monto aprobado', left + 24, top + 168);
      document.fillColor(navy).fontSize(30).text(formatCurrency(payment.amountCop, payment.currency), left + 24, top + 186);
      document.fillColor(text).fontSize(11).text(`Estado: ${startCase(payment.status)}`, left + 24, top + 228);
      document.text(`Medio: ${startCase(payment.provider)}`, left + 180, top + 228);

      const cardY = top + 286;
      const cardGap = 14;
      const cardWidth = (pageWidth - cardGap) / 2;

      drawInfoCard(left, cardY, cardWidth, 'Servicio', startCase(payment.appointmentType) || 'Consulta');
      drawInfoCard(left + cardWidth + cardGap, cardY, cardWidth, 'Fecha de la cita', formatDate(payment.startsAt));
      drawInfoCard(left, cardY + 78, cardWidth, 'Fecha de emision', formatDate(payment.createdAt ?? new Date()));
      drawInfoCard(left + cardWidth + cardGap, cardY + 78, cardWidth, 'Fecha de aprobacion', formatDate(payment.approvedAt ?? new Date()));

      document.roundedRect(left, cardY + 174, pageWidth, 96, 18).fillAndStroke('#F8FAFB', '#E2E8EC');
      document.fillColor(navy).fontSize(12).text('Resumen', left + 18, cardY + 190);
      document.fillColor(text).fontSize(11).text(
        'Este documento confirma el pago registrado en PetWell. Guardalo como soporte de tu cita y presentalo si la clinica lo solicita.',
        left + 18,
        cardY + 212,
        { width: pageWidth - 36, lineGap: 3 }
      );

      document.fillColor(muted).fontSize(9).text(
        'PetWell - soporte digital de pagos y atencion veterinaria',
        left,
        document.page.height - 62,
        { width: pageWidth, align: 'center' }
      );
      document.end();
    });
    const key = `receipts/${payment.id}.pdf`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: key,
        ContentType: 'application/pdf',
        Body: buffer
      })
    );

    return `${env.PUBLIC_APP_URL}/minio/${env.MINIO_BUCKET}/${key}`;
  }

  async checkHealth() {
    await this.client.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
    return {
      bucket: env.MINIO_BUCKET,
      endpoint: `${env.MINIO_USE_SSL ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`
    };
  }

  private async ensureBucket() {
    if (this.bucketReady) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: env.MINIO_BUCKET }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: env.MINIO_BUCKET }));
    }

    this.bucketReady = true;
  }
}
