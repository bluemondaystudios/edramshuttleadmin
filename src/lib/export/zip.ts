// Builds a ZIP in the browser with fflate, one file at a time, so a year of receipts
// never has to sit in memory uncompressed. Photos and PDFs are stored as-is (already
// compressed); text files are deflated.

import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';

export interface ZipEntry {
  path: string;
  /** Text, bytes, or a function that produces the bytes when it's this file's turn. */
  data: string | Uint8Array | (() => Promise<Uint8Array | null>);
}

export interface ZipProgress {
  done: number;
  total: number;
  current: string;
}

export interface ZipResult {
  blob: Blob;
  /** Paths that couldn't be fetched (e.g. a receipt missing from storage); listed in the README of the caller. */
  skipped: string[];
}

export async function buildZip(entries: ZipEntry[], onProgress?: (p: ZipProgress) => void): Promise<ZipResult> {
  const chunks: Uint8Array[] = [];
  let failure: Error | null = null;
  let finished!: () => void;
  const done = new Promise<void>((resolve) => (finished = resolve));
  const zip = new Zip((err, chunk, final) => {
    if (err) failure = err;
    else chunks.push(chunk);
    if (final || err) finished();
  });

  const skipped: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    onProgress?.({ done: i, total: entries.length, current: e.path });
    let bytes: Uint8Array | null;
    if (typeof e.data === 'function') {
      try {
        bytes = await e.data();
      } catch {
        bytes = null;
      }
      if (!bytes) {
        skipped.push(e.path);
        continue;
      }
    } else {
      bytes = typeof e.data === 'string' ? strToU8(e.data) : e.data;
    }
    const isCompressed = /\.(jpe?g|png|pdf|zip)$/i.test(e.path);
    const file = isCompressed ? new ZipPassThrough(e.path) : new ZipDeflate(e.path, { level: 6 });
    file.mtime = new Date();
    zip.add(file);
    file.push(bytes, true);
    // Let the page breathe (progress updates, no "page unresponsive") between files
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  zip.end();
  await done;
  if (failure) throw failure;
  onProgress?.({ done: entries.length, total: entries.length, current: '' });
  return { blob: new Blob(chunks as BlobPart[], { type: 'application/zip' }), skipped };
}
