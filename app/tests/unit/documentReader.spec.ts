import { test, expect } from '@playwright/test'
import {
  paginateText,
  resolveDocumentPath,
  isSupportedDocument,
} from '../../electron/main/query/documentReader'

test.describe('paginateText', () => {
  test('returns whole short text with no more pages', () => {
    const page = paginateText('hello world', 0, 12000)
    expect(page.text).toBe('hello world')
    expect(page.totalChars).toBe(11)
    expect(page.returnedChars).toBe(11)
    expect(page.offset).toBe(0)
    expect(page.hasMore).toBe(false)
    expect(page.nextOffset).toBeNull()
  })

  test('truncates long text and reports next offset', () => {
    const full = 'x'.repeat(100)
    const page = paginateText(full, 0, 40)
    expect(page.returnedChars).toBe(40)
    expect(page.hasMore).toBe(true)
    expect(page.nextOffset).toBe(40)
    expect(page.totalChars).toBe(100)
  })

  test('reads from a middle offset and reaches the end', () => {
    const full = 'abcdefghij' // 10 chars
    const page = paginateText(full, 7, 40)
    expect(page.text).toBe('hij')
    expect(page.offset).toBe(7)
    expect(page.returnedChars).toBe(3)
    expect(page.hasMore).toBe(false)
    expect(page.nextOffset).toBeNull()
  })

  test('clamps offset past end to empty result', () => {
    const page = paginateText('short', 999, 40)
    expect(page.text).toBe('')
    expect(page.offset).toBe(5)
    expect(page.returnedChars).toBe(0)
    expect(page.hasMore).toBe(false)
  })

  test('paging through a document covers all content exactly once', () => {
    const full = 'abcdefghijklmnop' // 16
    const first = paginateText(full, 0, 10)
    expect(first.text).toBe('abcdefghij')
    expect(first.nextOffset).toBe(10)
    const second = paginateText(full, first.nextOffset!, 10)
    expect(second.text).toBe('klmnop')
    expect(second.hasMore).toBe(false)
    expect(first.text + second.text).toBe(full)
  })
})

test.describe('resolveDocumentPath', () => {
  const ws = '/Users/test/proj'

  test('resolves a workspace-relative path', () => {
    const r = resolveDocumentPath('./src/a.docx', ws)
    expect(r).toEqual({ ok: true, absPath: '/Users/test/proj/src/a.docx' })
  })

  test('resolves a bare relative path', () => {
    const r = resolveDocumentPath('report.xlsx', ws)
    expect(r).toEqual({ ok: true, absPath: '/Users/test/proj/report.xlsx' })
  })

  test('accepts an absolute path inside the workspace', () => {
    const r = resolveDocumentPath('/Users/test/proj/deep/b.docx', ws)
    expect(r).toEqual({ ok: true, absPath: '/Users/test/proj/deep/b.docx' })
  })

  test('strips markdown backticks', () => {
    const r = resolveDocumentPath('`./a.docx`', ws)
    expect(r).toEqual({ ok: true, absPath: '/Users/test/proj/a.docx' })
  })

  test('rejects traversal outside the workspace', () => {
    const r = resolveDocumentPath('../../etc/passwd', ws)
    expect(r.ok).toBe(false)
  })

  test('rejects an absolute path outside the workspace', () => {
    const r = resolveDocumentPath('/etc/passwd', ws)
    expect(r.ok).toBe(false)
  })

  test('rejects the workspace root itself', () => {
    const r = resolveDocumentPath('.', ws)
    expect(r.ok).toBe(false)
  })

  test('rejects empty path', () => {
    expect(resolveDocumentPath('   ', ws).ok).toBe(false)
  })

  test('rejects when no workspace', () => {
    expect(resolveDocumentPath('./a.docx', '').ok).toBe(false)
  })
})

test.describe('isSupportedDocument', () => {
  test('accepts .docx and .xlsx (case-insensitive)', () => {
    expect(isSupportedDocument('/x/a.docx')).toBe(true)
    expect(isSupportedDocument('/x/a.XLSX')).toBe(true)
  })

  test('rejects unsupported formats', () => {
    for (const p of ['/x/a.doc', '/x/a.xls', '/x/a.pdf', '/x/a.txt', '/x/a']) {
      expect(isSupportedDocument(p)).toBe(false)
    }
  })
})
