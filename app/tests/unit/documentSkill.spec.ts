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
  DEFAULT_DOCX_STYLE,
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
      [
        '# x',
        '',
        '## Purpose',
        '正式报告',
        '',
        '## Writing Rules',
        '- 用正式书面语',
        '- 标题最多三级',
        '',
        '## Document Style',
        'font: Microsoft YaHei',
        'bodySize: 11',
        'heading1Size: 18',
        'heading2Size: 15',
        'heading3Size: 13',
        'pageMarginTop: 72pt',
        'pageMarginRight: 72',
        'pageMarginBottom: 72pt',
        'pageMarginLeft: 72',
        'lineSpacing: 1.15',
        'paragraphSpacingBefore: 0',
        'paragraphSpacingAfter: 6pt',
        'firstLineIndent: 22pt',
        'alignment: justify',
        'titleSize: 22',
        'titleBold: true',
        'titleAlignment: center',
        'titleSpacingAfter: 12pt',
        'heading1SpacingBefore: 12pt',
        'heading1SpacingAfter: 6pt',
        'heading2SpacingBefore: 12pt',
        'heading2SpacingAfter: 6pt',
        'heading3SpacingBefore: 12pt',
        'heading3SpacingAfter: 6pt',
        'tableBorderColor: b8c2d6',
        'tableBorderSize: 1',
        'tableCellPadding: 6pt',
        'tableHeaderShading: eef4ff',
        'tableHeaderBold: true',
        'tableWidth: 100',
      ].join('\n'),
    )
    expect(skill.purpose).toContain('正式报告')
    expect(skill.writingRules).toEqual(['用正式书面语', '标题最多三级'])
    expect(skill.style).toEqual({
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
    })
  })

  test('ignores invalid / out-of-range style values (fallback to default)', () => {
    const skill = parseSkill(
      'x',
      [
        '## Document Style',
        'bodySize: 999',
        'heading1Size: abc',
        'font:',
        'pageMarginTop: 201pt',
        'lineSpacing: 0.1',
        'alignment: middle',
        'titleBold: yes',
        'tableBorderColor: #B8C2D6',
        'tableWidth: 101',
      ].join('\n'),
    )
    expect(skill.style.bodySize).toBeUndefined()
    expect(skill.style.heading1Size).toBeUndefined()
    expect(skill.style.font).toBeUndefined()
    expect(skill.style.pageMarginTop).toBeUndefined()
    expect(skill.style.lineSpacing).toBeUndefined()
    expect(skill.style.alignment).toBeUndefined()
    expect(skill.style.titleBold).toBeUndefined()
    expect(skill.style.tableBorderColor).toBeUndefined()
    expect(skill.style.tableWidth).toBeUndefined()
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
    expect(skill?.style).toEqual(DEFAULT_DOCX_STYLE)
  })

  test('workspace skill overrides builtin', async () => {
    await fs.writeFile(
      path.join(wsDir, '.anvil', 'document-skills', 'default-report.md'),
      '## Purpose\n自定义\n\n## Document Style\nfont: SimSun\nbodySize: 12\n',
    )
    const skill = await loadSkill('default-report', wsDir)
    expect(skill?.style.font).toBe('SimSun')
    expect(skill?.style.bodySize).toBe(12)
    expect(skill?.style.heading1Size).toBe(18)
    expect(skill?.style.paragraphSpacingAfter).toBe(6)
    expect(skill?.style.lineSpacing).toBe(1.15)
    expect(skill?.style.tableHeaderShading).toBe('EEF4FF')
  })

  test('loadSkill fills missing style fields with defaults', async () => {
    await fs.writeFile(
      path.join(wsDir, '.anvil', 'document-skills', 'rules-only.md'),
      '## Purpose\n只改写作规则\n\n## Writing Rules\n- 用正式书面语\n',
    )
    const skill = await loadSkill('rules-only', wsDir)
    expect(skill?.writingRules).toEqual(['用正式书面语'])
    expect(skill?.style).toEqual(DEFAULT_DOCX_STYLE)
  })

  test('legacy style keys still parse and inherit v2 defaults', async () => {
    await fs.writeFile(
      path.join(wsDir, '.anvil', 'document-skills', 'legacy.md'),
      [
        '## Purpose',
        '旧样式',
        '',
        '## Document Style',
        'font: SimSun',
        'bodySize: 10',
        'heading1Size: 16',
        'heading2Size: 14',
        'heading3Size: 12',
      ].join('\n'),
    )
    const skill = await loadSkill('legacy', wsDir)
    expect(skill?.style).toEqual({
      ...DEFAULT_DOCX_STYLE,
      font: 'SimSun',
      bodySize: 10,
      heading1Size: 16,
      heading2Size: 14,
      heading3Size: 12,
    })
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

  test('symlinked skills dir does not leak external skill names', async () => {
    const externalSkills = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-skill-ext-'))
    const linkWs = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-skill-linkws-'))
    try {
      await fs.writeFile(path.join(externalSkills, 'leaked.md'), '## Purpose\nx\n')
      await fs.mkdir(path.join(linkWs, '.anvil'), { recursive: true })
      await fs.symlink(externalSkills, path.join(linkWs, '.anvil', 'document-skills'))
      const names = await listAvailableSkillNames(linkWs)
      expect(names).not.toContain('leaked')
      expect(names).toContain('default-report')
    } finally {
      await fs.rm(externalSkills, { recursive: true, force: true })
      await fs.rm(linkWs, { recursive: true, force: true })
    }
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
