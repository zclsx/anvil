import { promises as fs } from 'node:fs'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  DEFAULT_SKILL_NAME,
  isValidSkillName,
  listAvailableSkillNames,
  loadSkill,
} from './documentSkill'
import { generateDocxFromTemplate } from './documentTemplate'
import { generateDocx, isWriteTargetWithinWorkspace, resolveWritePath } from './documentWriter'

const MAX_SKILL_TEXT_CHARS = 4000

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

const GET_SKILL_DESCRIPTION = [
  'Get the purpose and writing rules of a document skill (a reusable Word document format).',
  'Call this BEFORE create_docx_from_skill so you write the markdown to match the skill’s rules.',
  'Returns the skill purpose, its writing rules, and the list of available skills.',
  'Does not return low-level style settings — those are applied by create_docx_from_skill itself.',
].join(' ')

export function createGetDocumentSkillTool(getWorkspacePath: () => string) {
  return tool(
    'get_document_skill',
    GET_SKILL_DESCRIPTION,
    {
      skill: z
        .string()
        .optional()
        .describe(`Skill name (default "${DEFAULT_SKILL_NAME}"). Use list of available skills if unsure.`),
    },
    async ({ skill = DEFAULT_SKILL_NAME }) => {
      const workspacePath = getWorkspacePath()
      const available = await listAvailableSkillNames(workspacePath)

      if (!isValidSkillName(skill)) {
        return errorResult(`无效的 skill 名称：${skill}（仅允许字母、数字、_ 和 -）`)
      }

      const loaded = await loadSkill(skill, workspacePath)
      if (!loaded) {
        return errorResult(
          `未找到文档 skill：${skill}。可用 skill：${available.join(', ') || '(无)'}`,
        )
      }

      const rules = loaded.writingRules.map((r, i) => `${i + 1}. ${r}`).join('\n')
      let text = [
        `文档 skill：${loaded.name}`,
        loaded.purpose ? `用途：${loaded.purpose}` : '',
        rules ? `写作规则：\n${rules}` : '写作规则：(无)',
        `可用 skill：${available.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n\n')

      if (text.length > MAX_SKILL_TEXT_CHARS) {
        text = `${text.slice(0, MAX_SKILL_TEXT_CHARS)}\n…（已截断）`
      }

      return { content: [{ type: 'text' as const, text }] }
    },
    {
      annotations: { title: 'Get document skill', readOnlyHint: true, openWorldHint: false },
      alwaysLoad: true,
    },
  )
}

const CREATE_FROM_SKILL_DESCRIPTION = [
  'Create a Microsoft Word (.docx) document using a document skill (a reusable, formatted style).',
  'Use this when the user wants a formal/report-style document, a PRD, meeting notes, or asks to follow a document skill/template.',
  'First call get_document_skill to read the skill’s writing rules, then pass markdown that follows them.',
  'The skill’s style or template is applied automatically. Do NOT use Bash, python, or pandoc.',
].join(' ')

export function createWriteFromSkillTool(getWorkspacePath: () => string) {
  return tool(
    'create_docx_from_skill',
    CREATE_FROM_SKILL_DESCRIPTION,
    {
      skill: z.string().optional().describe(`Document skill name. Default "${DEFAULT_SKILL_NAME}".`),
      path: z.string().describe('Output path for the .docx, inside the workspace.'),
      markdown: z.string().describe('Document body as markdown (headings, paragraphs, lists, bold/italic).'),
      title: z.string().optional().describe('Optional document title rendered at the top.'),
      overwrite: z.boolean().optional().describe('Allow overwriting an existing file. Default false.'),
    },
    async ({ skill = DEFAULT_SKILL_NAME, path: rawPath, markdown, title, overwrite = false }) => {
      const workspacePath = getWorkspacePath()

      if (!isValidSkillName(skill)) {
        return errorResult(`无效的 skill 名称：${skill}`)
      }
      const loaded = await loadSkill(skill, workspacePath)
      if (!loaded) {
        const available = await listAvailableSkillNames(workspacePath)
        return errorResult(`未找到文档 skill：${skill}。可用 skill：${available.join(', ') || '(无)'}`)
      }
      if (loaded.templateError) {
        return errorResult(loaded.templateError)
      }

      const resolved = resolveWritePath(rawPath, workspacePath)
      if (!resolved.ok) return errorResult(resolved.error)
      if (!(await isWriteTargetWithinWorkspace(resolved.absPath, workspacePath))) {
        return errorResult('输出路径越过 workspace 边界（可能经由符号链接），已拒绝写入')
      }

      try {
        const blockCount = loaded.templatePath
          ? await generateDocxFromTemplate(resolved.absPath, markdown, title, loaded.templatePath, { overwrite })
          : await generateDocx(resolved.absPath, markdown, title, {
              overwrite,
              style: loaded.style,
            })
        return {
          content: [
            {
              type: 'text' as const,
              text: `已生成 Word 文档：${resolved.absPath}\n使用文档 skill：${loaded.name}\n包含 ${blockCount} 个内容块。`,
            },
          ],
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
          return errorResult(`文件已存在：${rawPath}（如需覆盖请设 overwrite=true）`)
        }
        const message = error instanceof Error ? error.message : String(error)
        return errorResult(`生成文档失败：${message}`)
      }
    },
    {
      annotations: { title: 'Create Word document from skill', readOnlyHint: false, destructiveHint: true },
      alwaysLoad: true,
    },
  )
}
