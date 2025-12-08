# ImageNew API Documentation

AI Image Generator powered by Together AI (FLUX.1-schnell)

## Base URL

```
https://gen.savedimage.com
```

## Authentication

All API requests require an API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

---

## Endpoints

### POST /api/generate-image

Generate an AI image from a text prompt.

#### Request

```bash
curl -X POST "https://gen.savedimage.com/api/generate-image" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cyberpunk city at night with neon lights",
    "width": 1024,
    "height": 608
  }'
```

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Text description of the image (max 500 chars) |
| `width` | number | No | 1024 | Image width (must be multiple of 16, max 2048) |
| `height` | number | No | 608 | Image height (must be multiple of 16, max 2048) |
| `seed` | number | No | random | Seed for reproducible results (0-2147483647) |
| `steps` | number | No | 4 | Number of inference steps |

#### Response

```json
{
  "success": true,
  "url": "https://cdn.savedimage.com/images/a-cyberpunk-city-aae2526f.jpg",
  "key": "images/a-cyberpunk-city-aae2526f.jpg",
  "meta": {
    "prompt": "A cyberpunk city at night with neon lights",
    "model": "black-forest-labs/FLUX.1-schnell-Free",
    "seed": 123456789,
    "createdAt": "2025-12-08T02:48:12.710Z"
  },
  "items": [...]
}
```

---

### GET /api/gallery

List generated images from storage.

#### Request

```bash
curl "https://gen.savedimage.com/api/gallery?limit=12&offset=0" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 12 | Number of images to return (max 100) |
| `offset` | number | 0 | Pagination offset |

#### Response

```json
{
  "images": [
    {
      "key": "images/a-cyberpunk-city-aae2526f.jpg",
      "url": "https://cdn.savedimage.com/images/a-cyberpunk-city-aae2526f.jpg",
      "size": 245678,
      "uploaded": "2025-12-08T02:48:12.710Z",
      "metadata": {
        "prompt": "A cyberpunk city at night with neon lights",
        "model": "black-forest-labs/FLUX.1-schnell-Free",
        "width": "1024",
        "height": "608"
      }
    }
  ],
  "truncated": false,
  "cursor": null
}
```

---

## Size Presets

| Name | Size | Aspect Ratio |
|------|------|--------------|
| Banner (default) | 1024×608 | 10:6 |
| Square | 1024×1024 | 1:1 |
| Full HD Landscape | 1920×1080 | 16:9 |
| Full HD Portrait | 1080×1920 | 9:16 |
| HD Landscape | 1280×720 | 16:9 |
| Instagram Post | 1080×1080 | 1:1 |
| Instagram Story | 1080×1920 | 9:16 |
| Twitter Post | 1200×675 | 16:9 |
| YouTube Thumbnail | 1280×720 | 16:9 |

> **Note**: All dimensions must be multiples of 16 (Together AI requirement)

---

## Examples

### Basic Generation

```bash
curl -X POST "https://gen.savedimage.com/api/generate-image" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A beautiful sunset over the ocean"}'
```

### Square Image

```bash
curl -X POST "https://gen.savedimage.com/api/generate-image" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cute cat wearing sunglasses",
    "width": 1024,
    "height": 1024
  }'
```

### Reproducible Result (with seed)

```bash
curl -X POST "https://gen.savedimage.com/api/generate-image" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A mountain landscape at dawn",
    "width": 1920,
    "height": 1080,
    "seed": 42
  }'
```

### Portrait Image (Instagram Story)

```bash
curl -X POST "https://gen.savedimage.com/api/generate-image" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A fashion model in a futuristic outfit",
    "width": 1080,
    "height": 1920
  }'
```

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing or invalid API key |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

### Example Error

```json
{
  "error": "Prompt is required"
}
```

---

## Rate Limits

- 30 requests per minute per API key
- Maximum 4 concurrent requests

---

## Image URLs

Generated images are stored on Cloudflare R2 and served via CDN:

```
https://cdn.savedimage.com/images/{slug}-{id}.jpg
```

Example:
```
https://cdn.savedimage.com/images/a-cyberpunk-city-aae2526f.jpg
```
