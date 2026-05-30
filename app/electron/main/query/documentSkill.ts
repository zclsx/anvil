import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface DocxStyleOptions {
  font?: string
  bodySize?: number
  heading1Size?: number
  heading2Size?: number
  heading3Size?: number
  pageMarginTop?: number
  pageMarginRight?: number
  pageMarginBottom?: number
  pageMarginLeft?: number
  lineSpacing?: number
  paragraphSpacingBefore?: number
  paragraphSpacingAfter?: number
  firstLineIndent?: number
  alignment?: DocxAlignment
  titleSize?: number
  titleBold?: boolean
  titleAlignment?: DocxAlignment
  titleSpacingAfter?: number
  heading1SpacingBefore?: number
  heading1SpacingAfter?: number
  heading2SpacingBefore?: number
  heading2SpacingAfter?: number
  heading3SpacingBefore?: number
  heading3SpacingAfter?: number
  tableBorderColor?: string
  tableBorderSize?: number
  tableCellPadding?: number
  tableHeaderShading?: string
  tableHeaderBold?: boolean
  tableWidth?: number
}

export type DocxAlignment = 'left' | 'center' | 'right' | 'justify'

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
  heading2Size: 15,
  heading3Size: 13,
  pageMarginTop: 72,
  pageMarginRight: 72,
  pageMarginBottom: 72,
  pageMarginLeft: 72,
  lineSpacing: 1.15,
  paragraphSpacingBefore: 0,
  paragraphSpacingAfter: 6,
  firstLineIndent: 22,
  alignment: 'justify',
  titleSize: 22,
  titleBold: true,
  titleAlignment: 'center',
  titleSpacingAfter: 12,
  heading1SpacingBefore: 12,
  heading1SpacingAfter: 6,
  heading2SpacingBefore: 12,
  heading2SpacingAfter: 6,
  heading3SpacingBefore: 12,
  heading3SpacingAfter: 6,
  tableBorderColor: 'B8C2D6',
  tableBorderSize: 1,
  tableCellPadding: 6,
  tableHeaderShading: 'EEF4FF',
  tableHeaderBold: true,
  tableWidth: 100,
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
heading2Size: 15
heading3Size: 13
pageMarginTop: 72pt
pageMarginRight: 72pt
pageMarginBottom: 72pt
pageMarginLeft: 72pt
lineSpacing: 1.15
paragraphSpacingBefore: 0
paragraphSpacingAfter: 6pt
firstLineIndent: 22pt
alignment: justify
titleSize: 22
titleBold: true
titleAlignment: center
titleSpacingAfter: 12pt
heading1SpacingBefore: 12pt
heading1SpacingAfter: 6pt
heading2SpacingBefore: 12pt
heading2SpacingAfter: 6pt
heading3SpacingBefore: 12pt
heading3SpacingAfter: 6pt
tableBorderColor: B8C2D6
tableBorderSize: 1
tableCellPadding: 6pt
tableHeaderShading: EEF4FF
tableHeaderBold: true
tableWidth: 100
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

type StyleFieldSpec =
  | { kind: 'str'; default: string; minLength: number; maxLength: number }
  | { kind: 'pt' | 'halfPtSize' | 'multiplier' | 'int'; default: number; min: number; max: number }
  | { kind: 'bool'; default: boolean }
  | { kind: 'enum'; default: DocxAlignment; values: readonly DocxAlignment[] }
  | { kind: 'hex'; default: string }

const STYLE_FIELD_SPECS = {
  font: { kind: 'str', default: DEFAULT_DOCX_STYLE.font, minLength: 1, maxLength: 64 },
  bodySize: { kind: 'halfPtSize', default: DEFAULT_DOCX_STYLE.bodySize, min: 6, max: 72 },
  heading1Size: { kind: 'halfPtSize', default: DEFAULT_DOCX_STYLE.heading1Size, min: 6, max: 96 },
  heading2Size: { kind: 'halfPtSize', default: DEFAULT_DOCX_STYLE.heading2Size, min: 6, max: 96 },
  heading3Size: { kind: 'halfPtSize', default: DEFAULT_DOCX_STYLE.heading3Size, min: 6, max: 96 },
  pageMarginTop: { kind: 'pt', default: DEFAULT_DOCX_STYLE.pageMarginTop, min: 0, max: 200 },
  pageMarginRight: { kind: 'pt', default: DEFAULT_DOCX_STYLE.pageMarginRight, min: 0, max: 200 },
  pageMarginBottom: { kind: 'pt', default: DEFAULT_DOCX_STYLE.pageMarginBottom, min: 0, max: 200 },
  pageMarginLeft: { kind: 'pt', default: DEFAULT_DOCX_STYLE.pageMarginLeft, min: 0, max: 200 },
  lineSpacing: { kind: 'multiplier', default: DEFAULT_DOCX_STYLE.lineSpacing, min: 0.5, max: 4 },
  paragraphSpacingBefore: { kind: 'pt', default: DEFAULT_DOCX_STYLE.paragraphSpacingBefore, min: 0, max: 200 },
  paragraphSpacingAfter: { kind: 'pt', default: DEFAULT_DOCX_STYLE.paragraphSpacingAfter, min: 0, max: 200 },
  firstLineIndent: { kind: 'pt', default: DEFAULT_DOCX_STYLE.firstLineIndent, min: 0, max: 200 },
  alignment: { kind: 'enum', default: DEFAULT_DOCX_STYLE.alignment, values: ['left', 'center', 'right', 'justify'] },
  titleSize: { kind: 'halfPtSize', default: DEFAULT_DOCX_STYLE.titleSize, min: 6, max: 96 },
  titleBold: { kind: 'bool', default: DEFAULT_DOCX_STYLE.titleBold },
  titleAlignment: { kind: 'enum', default: DEFAULT_DOCX_STYLE.titleAlignment, values: ['left', 'center', 'right', 'justify'] },
  titleSpacingAfter: { kind: 'pt', default: DEFAULT_DOCX_STYLE.titleSpacingAfter, min: 0, max: 400 },
  heading1SpacingBefore: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading1SpacingBefore, min: 0, max: 400 },
  heading1SpacingAfter: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading1SpacingAfter, min: 0, max: 400 },
  heading2SpacingBefore: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading2SpacingBefore, min: 0, max: 400 },
  heading2SpacingAfter: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading2SpacingAfter, min: 0, max: 400 },
  heading3SpacingBefore: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading3SpacingBefore, min: 0, max: 400 },
  heading3SpacingAfter: { kind: 'pt', default: DEFAULT_DOCX_STYLE.heading3SpacingAfter, min: 0, max: 400 },
  tableBorderColor: { kind: 'hex', default: DEFAULT_DOCX_STYLE.tableBorderColor },
  tableBorderSize: { kind: 'int', default: DEFAULT_DOCX_STYLE.tableBorderSize, min: 0, max: 48 },
  tableCellPadding: { kind: 'pt', default: DEFAULT_DOCX_STYLE.tableCellPadding, min: 0, max: 72 },
  tableHeaderShading: { kind: 'hex', default: DEFAULT_DOCX_STYLE.tableHeaderShading },
  tableHeaderBold: { kind: 'bool', default: DEFAULT_DOCX_STYLE.tableHeaderBold },
  tableWidth: { kind: 'int', default: DEFAULT_DOCX_STYLE.tableWidth, min: 1, max: 100 },
} satisfies Record<keyof DocxStyleOptions, StyleFieldSpec>

function parseNumber(rawValue: string, spec: Extract<StyleFieldSpec, { kind: 'pt' | 'halfPtSize' | 'multiplier' | 'int' }>): number | null {
  const value = rawValue.trim().replace(/pt$/i, '').trim()
  const num = spec.kind === 'int' ? Number.parseInt(value, 10) : Number(value)
  if (!Number.isFinite(num) || num < spec.min || num > spec.max) return null
  if (spec.kind === 'int' && !Number.isInteger(num)) return null
  return num
}

function parseStyleValue(rawValue: string, spec: StyleFieldSpec): string | number | boolean | DocxAlignment | null {
  const value = rawValue.trim()
  if (!value) return null
  if (spec.kind === 'str') {
    return value.length >= spec.minLength && value.length <= spec.maxLength ? value : null
  }
  if (spec.kind === 'pt' || spec.kind === 'halfPtSize' || spec.kind === 'multiplier' || spec.kind === 'int') {
    return parseNumber(value, spec)
  }
  if (spec.kind === 'bool') {
    const normalized = value.toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    return null
  }
  if (spec.kind === 'enum') {
    const normalized = value.toLowerCase()
    return spec.values.includes(normalized as DocxAlignment) ? normalized as DocxAlignment : null
  }
  if (spec.kind === 'hex') {
    return /^[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : null
  }
  return null
}

function parseStyleLine(style: DocxStyleOptions, key: string, rawValue: string): void {
  const spec = STYLE_FIELD_SPECS[key as keyof DocxStyleOptions]
  if (!spec) return
  const value = parseStyleValue(rawValue, spec)
  if (value == null) return
  Object.assign(style, { [key]: value })
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
