/**
 * R2 storage operations for image handling
 */

import type { Env, GeneratedItem } from '../types.ts';
import { decodeBase64, readUInt32BE, truncate, toInt } from './utils.ts';

/**
 * Generate URL-friendly slug from prompt
 * Takes first 3 words, converts to lowercase, replaces spaces with hyphens
 */
function generateSlug(prompt: string): string {
  return prompt
    .toLowerCase()
    .trim()
    .split(/\s+/)           // Split by whitespace
    .slice(0, 3)            // Take first 3 words
    .join('-')
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric except hyphens
    .replace(/-+/g, '-')    // Collapse multiple hyphens
    .replace(/^-|-$/g, '')  // Trim leading/trailing hyphens
    .slice(0, 30)           // Max 30 chars
    || 'img';               // Fallback if empty
}

interface StoreImageParams {
  prompt: string;
  width: number;
  height: number;
  model: string;
  seed?: number;
  b64: string;
  requestOrigin: string;
}

interface ImageInfo {
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

/** Detect image MIME type and dimensions from binary data */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 10) return null;

  // PNG signature check
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = pngSig.every((v, i) => bytes[i] === v);

  if (isPng && bytes.length >= 24) {
    const width = readUInt32BE(bytes, 16);
    const height = readUInt32BE(bytes, 20);
    return { mime: 'image/png', width, height };
  }

  // JPEG signature check
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (length < 2) break;

      // SOF markers that contain size info
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3 ||
        marker === 0xc5 ||
        marker === 0xc6 ||
        marker === 0xc7 ||
        marker === 0xc9 ||
        marker === 0xca ||
        marker === 0xcb ||
        marker === 0xcd ||
        marker === 0xce ||
        marker === 0xcf
      ) {
        const height = (bytes[offset + 5] << 8) + bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) + bytes[offset + 8];
        return { mime: 'image/jpeg', width, height };
      }

      offset += 2 + length;
    }
  }

  return null;
}

/** Build URL for accessing stored image */
export async function buildUrl(
  env: Env,
  key: string,
  requestOrigin: string
): Promise<string> {
  // If PUBLIC_BASE_URL is set, use it as CDN domain
  if (env.PUBLIC_BASE_URL && env.PUBLIC_BASE_URL.trim()) {
    return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }

  // Try to generate signed URL
  const ttl = toInt(env.SIGNED_URL_TTL, 86_400);
  try {
    const expiration = Math.floor(Date.now() / 1000) + ttl;
    const bucket = env.R2 as R2Bucket & {
      createSignedUrl?: (key: string, options: { expiration: number }) => Promise<string | { url: string }>;
    };

    if (bucket?.createSignedUrl) {
      const signed = await bucket.createSignedUrl(key, { expiration });
      if (typeof signed === 'string') return signed;
      if (signed?.url) return signed.url as string;
    }
  } catch (error) {
    console.warn('Signed URL generation failed, falling back to direct key', error);
  }

  // Fallback: relative URL (assumes R2 is publicly exposed via domain)
  return `${requestOrigin.replace(/\/$/, '')}/${key}`;
}

/** Store generated image to R2 and return metadata */
export async function storeImage(
  env: Env,
  params: StoreImageParams
): Promise<GeneratedItem> {
  // Decode base64 to binary
  const decoded = decodeBase64(params.b64);
  if (!decoded || decoded.length === 0) {
    throw new Error('Empty image payload after decoding');
  }

  // Detect image type and dimensions
  const info = sniffImage(decoded);
  if (!info) {
    throw new Error('Could not detect image MIME type or dimensions');
  }

  // Warn if dimensions differ significantly from requested
  if (Math.abs(info.width - params.width) > 64 || Math.abs(info.height - params.height) > 64) {
    console.warn(
      `Dimension drift detected: requested ${params.width}x${params.height}, got ${info.width}x${info.height}`
    );
  }

  // Generate slug from prompt prefix + short UUID
  const now = new Date();
  const ext = info.mime === 'image/png' ? 'png' : 'jpg';
  const slug = generateSlug(params.prompt);
  const shortId = crypto.randomUUID().slice(0, 8);
  const key = `images/${slug}-${shortId}.${ext}`;

  // Store to R2 with metadata
  await env.R2.put(key, decoded, {
    httpMetadata: {
      contentType: info.mime,
      cacheControl: 'public, max-age=31536000',
    },
    customMetadata: {
      prompt: truncate(params.prompt, 500),
      model: params.model,
      seed: params.seed ? String(params.seed) : '',
      createdAt: now.toISOString(),
      width: String(info.width),
      height: String(info.height),
    },
  });

  // Build access URL
  const url = await buildUrl(env, key, params.requestOrigin);

  return {
    url,
    key,
    mime: info.mime,
    width: info.width,
    height: info.height,
    meta: {
      prompt: params.prompt,
      model: params.model,
      seed: params.seed,
      createdAt: now.toISOString(),
    },
  };
}

/** Serve image from R2 */
export async function serveImage(
  env: Env,
  key: string
): Promise<Response> {
  const object = await env.R2.get(key);

  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
      'ETag': object.etag,
    },
  });
}
