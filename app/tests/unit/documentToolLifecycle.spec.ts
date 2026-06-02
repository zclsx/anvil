import { test, expect } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import {
  createReadDocumentTool,
  createWriteDocumentTool,
  type DocumentToolLifecycle,
} from '../../electron/main/query/documentTool'
import {
  createGetDocumentSkillTool,
  createWriteFromSkillTool,
} from '../../electron/main/query/documentSkillTool'

type ToolWithHandler = {
  handler: (input: Record<string, unknown>) => Promise<unknown>
}

function createLifecycle() {
  const calls: string[] = []
  const lifecycle: DocumentToolLifecycle = {
    onStart: () => calls.push('start'),
    onFinish: () => calls.push('finish'),
  }
  return { calls, lifecycle }
}

test.describe('document tool lifecycle', () => {
  const workspacePath = path.join(os.tmpdir(), 'anvil-document-tool-lifecycle')

  test('wraps read_document execution', async () => {
    const { calls, lifecycle } = createLifecycle()
    const tool = createReadDocumentTool(() => workspacePath, () => [], lifecycle) as ToolWithHandler

    await tool.handler({ path: './missing.docx' })

    expect(calls).toEqual(['start', 'finish'])
  })

  test('wraps create_docx execution', async () => {
    const { calls, lifecycle } = createLifecycle()
    const tool = createWriteDocumentTool(() => workspacePath, lifecycle) as ToolWithHandler

    await tool.handler({ path: './wrong-extension.md', markdown: 'body' })

    expect(calls).toEqual(['start', 'finish'])
  })

  test('wraps get_document_skill execution', async () => {
    const { calls, lifecycle } = createLifecycle()
    const tool = createGetDocumentSkillTool(() => workspacePath, lifecycle) as ToolWithHandler

    await tool.handler({ skill: '../invalid' })

    expect(calls).toEqual(['start', 'finish'])
  })

  test('wraps create_docx_from_skill execution', async () => {
    const { calls, lifecycle } = createLifecycle()
    const tool = createWriteFromSkillTool(() => workspacePath, lifecycle) as ToolWithHandler

    await tool.handler({ skill: '../invalid', path: './out.docx', markdown: 'body' })

    expect(calls).toEqual(['start', 'finish'])
  })
})
