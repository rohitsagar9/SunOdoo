import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { MultipartFile } from '@fastify/multipart';
import { env } from './env.js';
import { AppError } from './errors.js';

const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

export async function saveUpload(file: MultipartFile, prefix: string) {
  const extension = path.extname(file.filename ?? '').toLowerCase();
  if (!allowed.has(extension)) {
    throw new AppError(422, 'Upload a JPG, PNG, WEBP or PDF file', 'INVALID_FILE');
  }

  fs.mkdirSync(env.uploadDir, { recursive: true });
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  await pipeline(file.file, fs.createWriteStream(path.join(env.uploadDir, filename)));

  if (file.file.truncated) {
    throw new AppError(413, 'File is larger than the 8 MB limit', 'FILE_TOO_LARGE');
  }

  return `/uploads/${filename}`;
}

export async function saveDataUrl(dataUrl: string, prefix: string) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new AppError(422, 'Signature must be a PNG or JPEG image', 'INVALID_SIGNATURE');
  }

  fs.mkdirSync(env.uploadDir, { recursive: true });
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(env.uploadDir, filename), Buffer.from(match[2], 'base64'));
  return `/uploads/${filename}`;
}
