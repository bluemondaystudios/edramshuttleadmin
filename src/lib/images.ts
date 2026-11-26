// Receipt photos are shrunk on the phone before upload (CLAUDE.md section 14):
// longest side at most 1400px, JPEG at quality 0.65, aiming for 250 KB or less.

export const MAX_SIDE = 1400;
export const TARGET_BYTES = 250 * 1024;

/** Scales (width, height) down so the longest side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Attempts in order until one is small enough: quality first, then size. */
export const ATTEMPTS: { scale: number; quality: number }[] = [
  { scale: 1, quality: 0.65 },
  { scale: 1, quality: 0.5 },
  { scale: 0.8, quality: 0.5 },
  { scale: 0.65, quality: 0.45 },
];

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respects the EXIF orientation, so phone photos aren't sideways
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback for browsers that can't decode this way (modern browsers apply EXIF to <img> too)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress the photo'))), 'image/jpeg', quality),
  );
}

/** Shrinks a photo to a JPEG for upload. Throws a plain-language error if the photo can't be read. */
export async function compressReceipt(file: Blob): Promise<Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new Error("Couldn't read that photo. Take it again, or choose a JPEG or PNG picture.");
  }
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const base = fitWithin(w, h);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process photos.');

  let best: Blob | null = null;
  for (const a of ATTEMPTS) {
    canvas.width = Math.max(1, Math.round(base.width * a.scale));
    canvas.height = Math.max(1, Math.round(base.height * a.scale));
    ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    best = await toJpeg(canvas, a.quality);
    if (best.size <= TARGET_BYTES) break;
  }
  if ('close' in source) source.close();
  return best!;
}
