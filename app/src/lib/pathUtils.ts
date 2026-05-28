export function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+$/g, '')
}

export function getComparablePath(filePath: string): string {
  return /^[A-Za-z]:\//.test(filePath) ? filePath.toLowerCase() : filePath
}

export function getWorkspaceRelativePath(
  filePath: string,
  workspacePath: string,
): string | null {
  const normalizedFile = normalizePathForCompare(filePath)
  const normalizedWorkspace = normalizePathForCompare(workspacePath)
  const comparableFile = getComparablePath(normalizedFile)
  const comparableWorkspace = getComparablePath(normalizedWorkspace)

  if (comparableFile === comparableWorkspace) return '.'
  if (!comparableFile.startsWith(`${comparableWorkspace}/`)) return null

  const relative = normalizedFile.slice(normalizedWorkspace.length + 1)
  return relative.length > 0 ? `./${relative}` : '.'
}

export function formatWorkspaceShort(p: string): string {
  const parts = p.split(/[\\/]+/).filter(Boolean)
  if (parts.length <= 2) return p
  return `…/${parts.slice(-2).join('/')}`
}

export function truncatePath(p: string): string {
  if (p.length < 30) return p
  return formatWorkspaceShort(p)
}

export function formatPathLiteral(pathLiteral: string): string {
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(pathLiteral.matchAll(/`+/g), (match) => match[0].length),
  )
  const fence = '`'.repeat(longestBacktickRun + 1)
  const padding = longestBacktickRun > 0 ? ' ' : ''
  return `${fence}${padding}${pathLiteral}${padding}${fence}`
}

export function getPromptPathDisplay(promptPath: string): string {
  return promptPath.replace(/^`+ ?/, '').replace(/ ?`+$/, '')
}
