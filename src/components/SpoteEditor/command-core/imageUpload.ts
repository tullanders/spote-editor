let counter = 0

/** Unique id per upload, used to tag a placeholder so it can be found again after the async upload. */
export function nextUploadId(): string {
  counter += 1
  return `u${Date.now().toString(36)}${counter.toString(36)}`
}

/** Temporary src/URL token embedded in the placeholder while uploading. */
export const placeholderSrc = (id: string): string => `uploading:${id}`

/** Raw-markdown placeholder inserted at the cursor while the upload is in flight. */
export const placeholderMarkdown = (id: string): string => `![laddar…](${placeholderSrc(id)})`

/** Final embed markdown (alt empty in v1). */
export const imageMarkdown = (url: string): string => `![](${url})`

/** Locate the raw-markdown placeholder for `id`, or null if it is gone. */
export function findPlaceholderRange(doc: string, id: string): { from: number; to: number } | null {
  const ph = placeholderMarkdown(id)
  const from = doc.indexOf(ph)
  return from < 0 ? null : { from, to: from + ph.length }
}

/** Keep only image files from a FileList (clipboard or drop), tolerating null/undefined. */
export function imageFilesFrom(list: FileList | null | undefined): File[] {
  if (!list) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}
