import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  isValidSkillName,
  resolveSkillSource,
  loadSkill,
  parseSkill,
  listAvailableSkillNames,
} from '../../electron/main/query/documentSkill'
import { generateDocx } from '../../electron/main/query/documentWriter'
import { extractDocumentText } from '../../electron/main/query/documentReader'

test.describe('isValidSkillName', () => {
  test('accepts simple names', () => {
    expect(isValidSkillName('default-report')).toBe(true)
    expect(isValidSkillName('prd')).toBe(true)
    expect(isValidSkillName('meeting_notes')).toBe(true)
  })
  test('rejects traversal / absolute / empty / dotted', () => {
    expect(isValidSkillName('../x')).toBe(false)
    expect(isValidSkillName('/abs/path')).toBe(false)
    expect(isValidSkillName('')).toBe(false)
    expect(isValidSkillName('a.b')).toBe(false)
    expect(isValidSkillName(123 as unknown)).toBe(false)
  })
})

test.describe('parseSkill', () => {
  test('parses purpose, rules, and style', () => {
    const skill = parseSkill(
      'x',
      `# x\n\n## Purpose\n正式报告\n\n## Writing Rules\n- 用正式书面语\n- 标题最多三级\n\n## Document Style\nfont: Microsoft YaHei\nbodySize: 11\nheading1Size: 18\nparagraphSpacingAfter: 120\n`,
    )
    expect(skill.purpose).toContain('正式报告')
    expect(skill.writingRules).toEqual(['用正式书面语', '标题最多三级'])
    expect(skill.style).toEqual({
      font: 'Microsoft YaHei',
      bodySize: 11,
      heading1Size: 18,
      paragraphSpacingAfter: 120,
    })
  })

  test('ignores invalid / out-of-range style values (fallback to default)', () => {
    const skill = parseSkill('x', `## Document Style\nbodySize: 999\nheading1Size: abc\nfont:\n`)
    expect(skill.style.bodySize).toBeUndefined()
    expect(skill.style.heading1Size).toBeUndefined()
    expect(skill.style.font).toBeUndefined()
  })
})

test.describe('resolveSkillSource / loadSkill', () => {
  let wsDir = ''
  let outsideDir = ''

  test.beforeAll(async () => {
    wsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-skill-ws-'))
    outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-skill-out-'))
    await fs.mkdir(path.join(wsDir, '.anvil', 'document-skills'), { recursive: true })
  })
  test.afterAll(async () => {
    if (wsDir) await fs.rm(wsDir, { recursive: true, force: true })
    if (outsideDir) await fs.rm(outsideDir, { recursive: true, force: true })
  })

  test('builtin default-report resolves without a workspace file', async () => {
    const skill = await loadSkill('default-report', wsDir)
    expect(skill?.name).toBe('default-report')
    expect(skill?.style.font).toBe('Microsoft YaHei')
  })

  test('workspace skill overrides builtin', async () => {
    await fs.writeFile(
      path.join(wsDir, '.anvil', 'document-skills', 'default-report.md'),
      '## Purpose\n自定义\n\n## Document Style\nfont: SimSun\nbodySize: 12\n',
    )
    const skill = await loadSkill('default-report', wsDir)
    expect(skill?.style.font).toBe('SimSun')
    expect(skill?.style.bodySize).toBe(12)
  })

  test('missing skill resolves to null', async () => {
    expect(await resolveSkillSource('does-not-exist', wsDir)).toBeNull()
  })

  test('invalid skill name resolves to null', async () => {
    expect(await resolveSkillSource('../escape', wsDir)).toBeNull()
  })

  test('symlinked skill file is rejected', async () => {
    const outsideSkill = path.join(outsideDir, 'evil.md')
    await fs.writeFile(outsideSkill, '## Purpose\nevil\n')
    await fs.symlink(outsideSkill, path.join(wsDir, '.anvil', 'document-skills', 'evil.md'))
    expect(await resolveSkillSource('evil', wsDir)).toBeNull()
  })

  test('lists builtin + workspace skills', async () => {
    await fs.writeFile(path.join(wsDir, '.anvil', 'document-skills', 'prd.md'), '## Purpose\nprd\n')
    const names = await listAvailableSkillNames(wsDir)
    expect(names).toContain('default-report')
    expect(names).toContain('prd')
  })
})

test.describe('generateDocx with skill style', () => {
  let tmpDir = ''
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-skill-doc-'))
  })
  test.afterAll(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('applies style and round-trips content', async () => {
    const file = path.join(tmpDir, 'styled.docx')
    const count = await generateDocx(file, '# 标题\n\n正文内容。', '报告', {
      style: { font: 'Microsoft YaHei', bodySize: 11, heading1Size: 18, paragraphSpacingAfter: 120 },
    })
    expect(count).toBeGreaterThan(0)

    const text = await extractDocumentText(file)
    expect(text).toContain('报告')
    expect(text).toContain('标题')
    expect(text).toContain('正文内容')

    // style lands in the docx package (styles.xml docDefaults)
    const JSZip = (await import('jszip')).default
    const buf = await fs.readFile(file)
    const zip = await JSZip.loadAsync(buf)
    const stylesXml = await zip.file('word/styles.xml')?.async('string')
    expect(stylesXml).toBeTruthy()
    expect(stylesXml).toContain('Microsoft YaHei')
  })
})
