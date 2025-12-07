/**
 * GET /api/gallery - List generated images
 *
 * Used by frontend to:
 * 1. Verify API key validity (on first load)
 * 2. Display recent generations
 */

import type { Env, GalleryImage, GalleryResponse } from '../types.ts';
import { toInt } from '../lib/utils.ts';
import { buildUrl } from '../lib/r2.ts';

/**
 * Handle gallery listing request
 *
 * Query parameters:
 * - limit: Number of images to return (default 12, max 50)
 * - offset: Pagination offset (default 0)
 */
export async function handleGallery(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  // Parse pagination params
  const limit = Math.min(toInt(url.searchParams.get('limit') ?? undefined, 12), 50);
  const offset = Math.max(toInt(url.searchParams.get('offset') ?? undefined, 0), 0);

  try {
    // List objects from R2 with prefix
    // Note: R2 list doesn't support true offset, so we fetch limit+offset and slice
    const listed = await env.R2.list({
      prefix: 'images/',
      limit: 1000, // R2 max per request
    });

    // Sort by uploaded date descending (newest first)
    const sorted = listed.objects.sort((a, b) => {
      return b.uploaded.getTime() - a.uploaded.getTime();
    });

    // Apply pagination
    const paginated = sorted.slice(offset, offset + limit);

    // Build response items
    const images: GalleryImage[] = await Promise.all(
      paginated.map(async (obj) => {
        const imageUrl = await buildUrl(env, obj.key, url.origin);
        return {
          key: obj.key,
          url: imageUrl,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
          metadata: obj.customMetadata,
        };
      })
    );

    const response: GalleryResponse = {
      images,
      limit,
      offset,
    };

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list images';
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
