/**
 * Het grootste bestand uit een width-srcset ("url 300w, url 1024w, …"), of
 * de terugval als de srcset leeg of onleesbaar is. Voor de lightbox en de
 * link achter een galerijtegel.
 */
export function largestFromSrcset(srcset: string, fallback: string): string {
  let best = { url: fallback, width: 0 }
  for (const part of (srcset || '').split(',')) {
    const [url, descriptor] = part.trim().split(/\s+/)
    const width = Number.parseInt(descriptor ?? '', 10)
    if (url && Number.isFinite(width) && width > best.width) best = { url, width }
  }
  return best.url
}
