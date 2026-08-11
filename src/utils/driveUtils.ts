/**
 * Utility functions for Google Drive photo URL formatting
 */

/**
 * Converts any Google Drive URL (export=view, uc?id=, etc.) to the official Drive view link
 * which opens the photo preview page directly in the browser.
 */
export function formatDriveViewUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('http')) return url;

  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/view?usp=sharing`;
  }
  return url;
}

/**
 * Converts any Google Drive URL to direct image CDN link (lh3.googleusercontent.com)
 * so it can be safely rendered inside <img src="..." /> tags in web UI.
 */
export function formatDriveImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:image')) return url;
  if (!url.startsWith('http')) return url;

  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}
