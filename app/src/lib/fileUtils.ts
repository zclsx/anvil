import { normalizePathForCompare } from './pathUtils'

export function isImagePath(filePath: string): boolean {
  return /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(filePath)
}

export function formatFileReferenceLabel(pathLiteral: string): string {
  const parts = normalizePathForCompare(pathLiteral)
    .split('/')
    .filter((part) => part.length > 0 && part !== '.')
  if (parts.length === 0) return pathLiteral
  return parts[parts.length - 1] ?? pathLiteral
}
