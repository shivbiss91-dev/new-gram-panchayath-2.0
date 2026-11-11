/**
 * Resolves uploaded / sample complaint image paths cleanly across:
 * 1. Local Vite dev proxy (`/uploads/...`)
 * 2. Separate API host configured via `VITE_API_URL`
 * 3. Static bundled assets under `public/samples/...` (including sub-path deployments like GitHub Pages)
 */
export function resolveComplaintImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl || !imageUrl.trim()) return null;

  const trimmed = imageUrl.trim();

  // Already absolute or data/blob URL
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Server-hosted Multer upload
  if (trimmed.startsWith('/uploads/')) {
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    return apiBase ? `${apiBase}${trimmed}` : trimmed;
  }

  // Public static asset path (respects Vite BASE_URL e.g. `/` or `/gram-panchayat/`)
  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${baseUrl}${normalizedPath}`;
}
