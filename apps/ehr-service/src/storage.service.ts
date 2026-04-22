import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable, NotFoundException } from '@nestjs/common';

import { env } from './config';

type AttachmentUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type EhrAttachment = {
  id: string;
  fileName: string;
  size: number;
  uploadedAt: string;
};

@Injectable()
export class StorageService {
  private readonly basePath = env.EHR_STORAGE_PATH ?? path.join(process.cwd(), 'storage', 'ehr');

  async uploadAttachments(recordId: string, files: AttachmentUpload[]): Promise<EhrAttachment[]> {
    const directory = this.recordDirectory(recordId);
    await mkdir(directory, { recursive: true });

    const uploadedAt = new Date().toISOString();
    const results: EhrAttachment[] = [];

    for (const file of files) {
      const safeFileName = this.safeFileName(file.originalname);
      const relativePath = `${Date.now()}-${randomUUID()}__${safeFileName}`;
      await writeFile(path.join(directory, relativePath), file.buffer);

      results.push({
        id: this.encodeAttachmentId(relativePath),
        fileName: safeFileName,
        size: file.size,
        uploadedAt
      });
    }

    return results;
  }

  async listAttachments(recordId: string): Promise<EhrAttachment[]> {
    const directory = this.recordDirectory(recordId);
    await mkdir(directory, { recursive: true });

    const entries = await readdir(directory, { withFileTypes: true });
    const attachments = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const relativePath = entry.name;
          const fileStat = await stat(path.join(directory, relativePath));

          return {
            id: this.encodeAttachmentId(relativePath),
            fileName: this.decodeFileName(relativePath),
            size: fileStat.size,
            uploadedAt: fileStat.mtime.toISOString()
          } satisfies EhrAttachment;
        })
    );

    return attachments.sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime());
  }

  async downloadAttachment(recordId: string, attachmentId: string) {
    const recordDirectory = path.resolve(this.recordDirectory(recordId));
    const relativePath = this.decodeAttachmentId(attachmentId);
    const resolvedPath = path.resolve(recordDirectory, relativePath);

    if (resolvedPath !== recordDirectory && !resolvedPath.startsWith(`${recordDirectory}${path.sep}`)) {
      throw new NotFoundException('Clinical attachment not found');
    }

    try {
      const contents = await readFile(resolvedPath);

      return {
        fileName: this.decodeFileName(relativePath),
        contentType: this.contentTypeFromFileName(relativePath),
        contents
      };
    } catch {
      throw new NotFoundException('Clinical attachment not found');
    }
  }

  async checkHealth() {
    await mkdir(this.basePath, { recursive: true });
    return {
      path: this.basePath
    };
  }

  private recordDirectory(recordId: string) {
    return path.join(this.basePath, recordId, 'attachments');
  }

  private safeFileName(fileName: string) {
    return fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'archivo';
  }

  private encodeAttachmentId(relativePath: string) {
    return Buffer.from(relativePath, 'utf-8').toString('base64url');
  }

  private decodeAttachmentId(attachmentId: string) {
    return Buffer.from(attachmentId, 'base64url').toString('utf-8');
  }

  private decodeFileName(relativePath: string) {
    const fileName = relativePath.split('__')[1];
    return fileName || relativePath;
  }

  private contentTypeFromFileName(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    switch (extension) {
      case '.pdf':
        return 'application/pdf';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.txt':
        return 'text/plain; charset=utf-8';
      default:
        return 'application/octet-stream';
    }
  }
}
