import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';
import { saveUpload } from './files.js';

export async function parseForm(request: FastifyRequest, prefix: string) {
  if (!request.isMultipart()) {
    throw new AppError(415, 'Send this request as multipart/form-data', 'MULTIPART_REQUIRED');
  }

  const fields: Record<string, string> = {};
  let fileUrl: string | undefined;

  for await (const part of request.parts()) {
    if (part.type === 'file') {
      if (fileUrl) {
        part.file.resume();
        continue;
      }
      fileUrl = await saveUpload(part, prefix);
    } else {
      fields[part.fieldname] = String(part.value ?? '');
    }
  }

  return { fields, fileUrl };
}
