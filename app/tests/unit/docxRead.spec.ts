import { test, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveDocxReadPath } from '../../electron/main/query/docxRead'

test.describe('resolveDocxReadPath (preview read boundary)', () => {
  let wsDir = ''
  let outsideDir = ''

  test.beforeAll(async () => {
    wsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-read-ws-'))
    outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'anvil-read-out-'))
  })
  test.afterAll(async () => {
    if (wsDir) await fs.rm(wsDir, { recursive: true, force: true })
    if (outsideDir) await fs.rm(outsideDir, { recursive: true, force: true })
  })

  test('reads a .docx inside an allowed root', async () => {
    const file = path.join(wsDir, 'a.docx')
    await fs.writeFile(file, 'hello-docx-bytes')
    const r = await resolveDocxReadPath(file, [wsDir])
    expect(r.ok).toBe(true)
    expect(r.bytes && Buffer.from(r.bytes).toString()).toBe('hello-docx-bytes')
  })

  test('rejects a .docx outside all roots', async () => {
    const file = path.join(outsideDir, 'b.docx')
    await fs.writeFile(file, 'x')
    const r = await resolveDocxReadPath(file, [wsDir])
    expect(r.ok).toBe(false)
    expect(r.error).toContain('workspace')
  })

  test('rejects a non-.docx path', async () => {
    const file = path.join(wsDir, 'c.txt')
    await fs.writeFile(file, 'x')
    const r = await resolveDocxReadPath(file, [wsDir])
    expect(r.ok).toBe(false)
  })

  test('rejects a relative path', async () => {
    const r = await resolveDocxReadPath('./a.docx', [wsDir])
    expect(r.ok).toBe(false)
  })

  test('rejects a symlinked .docx file sitting inside a root', async () => {
    const target = path.join(outsideDir, 'evil.docx')
    await fs.writeFile(target, 'x')
    await fs.symlink(target, path.join(wsDir, 'evil.docx'))
    const r = await resolveDocxReadPath(path.join(wsDir, 'evil.docx'), [wsDir])
    expect(r.ok).toBe(false)
  })

  test('rejects a real path that escapes the root via a symlinked ancestor dir', async () => {
    await fs.symlink(outsideDir, path.join(wsDir, 'linkdir'))
    await fs.writeFile(path.join(outsideDir, 'x.docx'), 'x')
    const r = await resolveDocxReadPath(path.join(wsDir, 'linkdir', 'x.docx'), [wsDir])
    expect(r.ok).toBe(false)
  })
})
