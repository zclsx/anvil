import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  extractDocumentText,
  isSupportedDocument,
  paginateText,
  resolveDocumentPath,
} from './documentReader'
import { generateDocx, isWriteTargetWithinWorkspace, resolveWritePath } from './documentWriter'

const DEFAULT_MAX_CHARS = 12000

export interface DocumentToolLifecycle {
  onStart?: () => void
  onFinish?: () => void
}

const READ_DOCUMENT_DESCRIPTION = [
  'Read text content from a Microsoft Office Word (.docx) or Excel (.xlsx) document at a given path.',
  'Use this whenever the user references such a file — the built-in Read tool cannot decode Office formats.',
  'Do NOT use Bash, python, pip, or pandoc to parse Office documents; use this tool instead.',
  'For large files, page through with `offset` until the result reports no more content.',
].join(' ')

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

async function symlinkEscapesWorkspace(absPath: string, workspacePath: string): Promise<boolean> {
  try {
    const [realTarget, realWorkspace] = await Promise.all([
      fs.realpath(absPath),
      fs.realpath(workspacePath),
    ])
    const rel = path.relative(realWorkspace, realTarget)
    return rel.startsWith('..') || path.isAbsolute(rel)
  } catch {
    // realpath failed (missing/broken) — treat as escape so we don't read it
    return true
  }
}

export function createReadDocumentTool(
  getWorkspacePath: () => string,
  getReferencedPaths: () => string[],
  lifecycle: DocumentToolLifecycle = {},
) {
  return tool(
    'read_document',
    READ_DOCUMENT_DESCRIPTION,
    {
      path: z
        .string()
        .describe('Path to the .docx or .xlsx file, relative to the workspace or absolute within it.'),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Character offset to start reading from, for paging large documents. Default 0.'),
      maxChars: z
        .number()
        .int()
        .min(1)
        .max(50000)
        .optional()
        .describe(`Maximum characters to return. Default ${DEFAULT_MAX_CHARS}.`),
    },
    async ({ path: rawPath, offset = 0, maxChars = DEFAULT_MAX_CHARS }) => {
      lifecycle.onStart?.()
      try {
        const workspacePath = getWorkspacePath()
        const resolved = resolveDocumentPath(rawPath, workspacePath, getReferencedPaths())
        if (!resolved.ok) return errorResult(resolved.error)

        if (!isSupportedDocument(resolved.absPath)) {
          return errorResult('仅支持读取 .docx / .xlsx 文档')
        }

        try {
          await fs.access(resolved.absPath)
        } catch {
          return errorResult(`文件不存在：${rawPath}`)
        }

        // For workspace-scoped reads, re-check the *real* path: a symlink inside
        // the workspace could otherwise point a read-only, auto-approved tool at
        // a file outside it. Referenced paths are user-authorized, so skip.
        if (resolved.source === 'workspace' && (await symlinkEscapesWorkspace(resolved.absPath, workspacePath))) {
          return errorResult('该路径通过符号链接指向 workspace 外，已拒绝读取')
        }

        let fullText: string
        try {
          fullText = await extractDocumentText(resolved.absPath)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          return errorResult(`解析文档失败：${message}`)
        }

        const page = paginateText(fullText, offset, maxChars)
        const range = `${page.offset}–${page.offset + page.returnedChars}`
        const more = page.hasMore
          ? `（还有更多内容，下次用 offset=${page.nextOffset} 继续读取）`
          : '（已读取到文档结尾）'
        const header = `[read_document] ${rawPath}\n总字符数 ${page.totalChars}，本次返回 ${range}${more}\n\n`

        return { content: [{ type: 'text' as const, text: header + page.text }] }
      } finally {
        lifecycle.onFinish?.()
      }
    },
    {
      annotations: {
        title: 'Read Office document',
        readOnlyHint: true,
        openWorldHint: false,
      },
      alwaysLoad: true,
    },
  )
}

const CREATE_DOCX_DESCRIPTION = [
  'Create a Microsoft Word (.docx) document from markdown content and write it into the workspace.',
  'Use this when the user asks you to generate/produce/export a Word document — do NOT use Bash, python, or pandoc.',
  'Supports headings (#/##/###), paragraphs, bullet/numbered lists, and **bold**/*italic*.',
  'Tables and images are not supported and will be flattened to text.',
].join(' ')

export function createWriteDocumentTool(
  getWorkspacePath: () => string,
  lifecycle: DocumentToolLifecycle = {},
) {
  return tool(
    'create_docx',
    CREATE_DOCX_DESCRIPTION,
    {
      path: z
        .string()
        .describe('Output path for the .docx file, inside the workspace (e.g. ./outputs/report.docx).'),
      markdown: z
        .string()
        .describe('Document body as markdown (headings, paragraphs, lists, bold/italic).'),
      title: z.string().optional().describe('Optional document title rendered at the top.'),
      overwrite: z
        .boolean()
        .optional()
        .describe('Allow overwriting an existing file. Default false; set true to replace.'),
    },
    async ({ path: rawPath, markdown, title, overwrite = false }) => {
      lifecycle.onStart?.()
      try {
        const workspacePath = getWorkspacePath()
        const resolved = resolveWritePath(rawPath, workspacePath)
        if (!resolved.ok) return errorResult(resolved.error)

        if (!(await isWriteTargetWithinWorkspace(resolved.absPath, workspacePath))) {
          return errorResult('输出路径越过 workspace 边界（可能经由符号链接），已拒绝写入')
        }

        const blockCount = await generateDocx(resolved.absPath, markdown, title, { overwrite })
        return {
          content: [
            {
              type: 'text' as const,
              text: `已生成 Word 文档：${resolved.absPath}\n包含 ${blockCount} 个内容块。`,
            },
          ],
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
          return errorResult(`文件已存在：${rawPath}（如需覆盖请设 overwrite=true）`)
        }
        const message = error instanceof Error ? error.message : String(error)
        return errorResult(`生成文档失败：${message}`)
      } finally {
        lifecycle.onFinish?.()
      }
    },
    {
      annotations: {
        title: 'Create Word document',
        readOnlyHint: false,
        destructiveHint: true,
      },
      alwaysLoad: true,
    },
  )
}
