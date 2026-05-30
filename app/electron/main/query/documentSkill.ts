import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DocxStyleOptions {
  font?: string
  bodySize?: number
  heading1Size?: number
  heading2Size?: number
  heading3Size?: number
  paragraphSpacingAfter?: number
}

export interface DocumentSkill {
  name: string
  purpose: string
  writingRules: string[]
  style: DocxStyleOptions
}

export const DEFAULT_SKILL_NAME = 'default-report'

export const DEFAULT_DOCX_STYLE: Required<DocxStyleOptions> = {
  font: 'Microsoft YaHei',
  bodySize: 11,
  heading1Size: 18,
  heading2Size: 14,
  heading3Size: 12,
  paragraphSpacingAfter: 120,
}

const SKILLS_SUBDIR = path.join('.anvil', 'document-skills')

const BUILTIN_DOCUMENT_SKILLS: Record<string, string> = {
  'default-report': `# default-report

## Purpose
正式项目报告 / 工作总结 / PRD 文档。

## Writing Rules
- 使用中文正式书面语，避免口语和表情符号
- 一级标题用于主章节，二级标题用于小节，最多三级标题
- 列表层级不超过两层
- 对比类信息优先用表格或并列列表
- 每段聚焦一个要点，避免超长段落

## Document Style
font: Microsoft YaHei
bodySize: 11
heading1Size: 18
heading2Size: 14
heading3Size: 12
paragraphSpacingAfter: 120
`,
}

const SKILL_NAME_RE = /^[a-zA-Z0-9_-]+$/

export function isValidSkillName(name: unknown): name is string {
  return typeof name === 'string' && name.length > 0 && name.length <= 64 && SKILL_NAME_RE.test(name)
}

export function listBuiltinSkillNames(): string[] {
  return Object.keys(BUILTIN_DOCUMENT_SKILLS)
}

async function readWorkspaceSkillSource(
  skillName: string,
  workspacePath: string,
): Promise<string | null> {
  const workspaceAbs = path.resolve(workspacePath)
  const skillPath = path.resolve(workspaceAbs, SKILLS_SUBDIR, `${skillName}.md`)

  // lexical containment first
  const rel = path.relative(workspaceAbs, skillPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null

  try {
    const stat = await fs.lstat(skillPath)
    if (!stat.isFile() || stat.isSymbolicLink()) return null
    // realpath containment (defends against symlinked ancestors)
    const [realWorkspace, realSkill] = await Promise.all([
      fs.realpath(workspaceAbs),
      fs.realpath(skillPath),
    ])
    const realRel = path.relative(realWorkspace, realSkill)
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) return null
    return await fs.readFile(skillPath, 'utf8')
  } catch {
    return null
  }
}

/**
 * Resolve a skill's raw markdown source: workspace override first, then
 * builtin. Returns null when the name is invalid or not found anywhere.
 */
export async function resolveSkillSource(
  skillName: string,
  workspacePath: string,
): Promise<string | null> {
  if (!isValidSkillName(skillName)) return null
  const fromWorkspace = await readWorkspaceSkillSource(skillName, workspacePath)
  if (fromWorkspace !== null) return fromWorkspace
  return BUILTIN_DOCUMENT_SKILLS[skillName] ?? null
}

/**
 * List available skill names for a workspace: builtins plus any
 * `.anvil/document-skills/*.md` overrides, de-duplicated.
 */
export async function listAvailableSkillNames(workspacePath: string): Promise<string[]> {
  const names = new Set(listBuiltinSkillNames())
  try {
    const workspaceAbs = path.resolve(workspacePath)
    const dir = path.resolve(workspaceAbs, SKILLS_SUBDIR)
    const [realWorkspace, realDir] = await Promise.all([
      fs.realpath(workspaceAbs),
      fs.realpath(dir),
    ])
    const rel = path.relative(realWorkspace, realDir)
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      const entries = await fs.readdir(realDir)
      for (const entry of entries) {
        if (entry.toLowerCase().endsWith('.md')) {
          const name = entry.slice(0, -3)
          if (isValidSkillName(name)) names.add(name)
        }
      }
    }
  } catch {
    // no workspace skills dir — builtins only
  }
  return Array.from(names).sort()
}

type NumericStyleKey = Exclude<keyof DocxStyleOptions, 'font'>

const NUMERIC_STYLE_BOUNDS: Record<NumericStyleKey, { min: number; max: number }> = {
  bodySize: { min: 6, max: 72 },
  heading1Size: { min: 6, max: 96 },
  heading2Size: { min: 6, max: 96 },
  heading3Size: { min: 6, max: 96 },
  paragraphSpacingAfter: { min: 0, max: 2000 },
}

function parseStyleLine(style: DocxStyleOptions, key: string, rawValue: string): void {
  const value = rawValue.trim()
  if (!value) return
  if (key === 'font') {
    style.font = value
    return
  }
  const numericKeys: NumericStyleKey[] = [
    'bodySize',
    'heading1Size',
    'heading2Size',
    'heading3Size',
    'paragraphSpacingAfter',
  ]
  const matched = numericKeys.find((k) => k === key)
  if (!matched) return
  const num = Number(value)
  const bounds = NUMERIC_STYLE_BOUNDS[matched]
  if (!Number.isFinite(num) || !bounds) return
  if (num < bounds.min || num > bounds.max) return
  style[matched] = num
}

/**
 * Parse skill markdown into a structured skill. Sections are `## Heading`
 * blocks; Document Style is `key: value` lines. Unknown keys and
 * out-of-range values are ignored so callers fall back to defaults.
 */
export function parseSkill(name: string, source: string): DocumentSkill {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let section: 'purpose' | 'rules' | 'style' | 'other' = 'other'
  const purposeLines: string[] = []
  const writingRules: string[] = []
  const style: DocxStyleOptions = {}

  for (const raw of lines) {
    const line = raw.trim()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      const title = heading[1].trim().toLowerCase()
      if (title === 'purpose') section = 'purpose'
      else if (title === 'writing rules') section = 'rules'
      else if (title === 'document style') section = 'style'
      else section = 'other'
      continue
    }
    if (!line) continue

    if (section === 'purpose') {
      purposeLines.push(line)
    } else if (section === 'rules') {
      const bullet = /^[-*]\s+(.*)$/.exec(line)
      writingRules.push(bullet ? bullet[1].trim() : line)
    } else if (section === 'style') {
      const kv = /^([a-zA-Z0-9_]+)\s*:\s*(.*)$/.exec(line)
      if (kv) parseStyleLine(style, kv[1], kv[2])
    }
  }

  return {
    name,
    purpose: purposeLines.join(' ').trim(),
    writingRules,
    style,
  }
}

export async function loadSkill(
  skillName: string,
  workspacePath: string,
): Promise<DocumentSkill | null> {
  const source = await resolveSkillSource(skillName, workspacePath)
  if (source === null) return null
  const parsed = parseSkill(skillName, source)
  return { ...parsed, style: { ...DEFAULT_DOCX_STYLE, ...parsed.style } }
}
