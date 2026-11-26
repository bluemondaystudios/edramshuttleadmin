// Sending a PDF from the phone (CLAUDE.md section 11).

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opens the phone's share sheet (WhatsApp, email…) with the PDF, or downloads it where sharing files isn't supported. */
export async function shareOrDownload(file: File, title: string, text: string): Promise<ShareOutcome> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Some browsers refuse at the last moment: fall back to a download.
    }
  }
  downloadFile(file);
  return 'downloaded';
}
