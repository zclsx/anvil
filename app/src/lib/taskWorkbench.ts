import type { Item, PendingApproval, Turn } from '../store'
import { getGeneratedDocxArtifactsForTurn, type GeneratedDocxArtifact } from './generatedFiles'
import { toolStepSummary } from './toolStep'

export type TaskWorkbenchStatus = 'idle' | 'running' | 'awaitingApproval' | 'completed' | 'failed' | 'cancelled'
export type TaskWorkbenchTone = 'idle' | 'running' | 'success' | 'warning' | 'danger'
export type TaskToolRunStatus = 'running' | 'success' | 'failed' | 'pendingApproval' | 'denied' | 'idle'

export interface TaskToolRun {
  itemId: string
  label: string
  argPreview: string
  resultPreview: string
  extraLines: number
  status: TaskToolRunStatus
  statusLabel: string
  tone: TaskWorkbenchTone
  risk: 'low' | 'medium' | 'high' | null
}

export interface TaskWorkbenchModel {
  status: TaskWorkbenchStatus
  tone: TaskWorkbenchTone
  label: string
  description: string
  activeTurn: Turn | null
  toolRuns: TaskToolRun[]
  artifacts: GeneratedDocxArtifact[]
}

function latestTurn(turns: Turn[]): Turn | null {
  return turns.length > 0 ? turns[turns.length - 1] : null
}

function latestRunningTurn(turns: Turn[]): Turn | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (turn?.status === 'running') return turn
  }
  return null
}

function activeTurnForWorkbench(turns: Turn[]): Turn | null {
  return latestRunningTurn(turns) ?? latestTurn(turns)
}

function pendingApprovalForItem(itemId: string, pendingApprovals: PendingApproval[]): PendingApproval | null {
  return pendingApprovals.find((approval) => approval.itemId === itemId) ?? null
}

function deriveToolStatus(
  item: Item,
  pendingApproval: PendingApproval | null,
): Pick<TaskToolRun, 'status' | 'statusLabel' | 'tone' | 'risk'> {
  if (pendingApproval) {
    return {
      status: 'pendingApproval',
      statusLabel: '待审批',
      tone: 'warning',
      risk: pendingApproval.risk,
    }
  }
  if (item.approvalDecision === 'deny') {
    return {
      status: 'denied',
      statusLabel: '已拒绝',
      tone: 'danger',
      risk: item.approvalRisk ?? null,
    }
  }
  if (item.toolIsError === true) {
    return {
      status: 'failed',
      statusLabel: '错误',
      tone: 'danger',
      risk: item.approvalRisk ?? null,
    }
  }
  if (item.toolOutput != null) {
    return {
      status: 'success',
      statusLabel: '完成',
      tone: 'success',
      risk: item.approvalRisk ?? null,
    }
  }
  if (item.toolName) {
    return {
      status: 'running',
      statusLabel: '运行中',
      tone: 'running',
      risk: item.approvalRisk ?? null,
    }
  }
  return {
    status: 'idle',
    statusLabel: '待执行',
    tone: 'idle',
    risk: item.approvalRisk ?? null,
  }
}

function deriveToolRuns(
  turn: Turn | null,
  items: Record<string, Item>,
  pendingApprovals: PendingApproval[],
): TaskToolRun[] {
  if (!turn) return []
  return turn.itemIds.flatMap((id) => {
    const item = items[id]
    if (!item || item.kind !== 'tool_use') return []
    const summary = toolStepSummary(item)
    const pendingApproval = pendingApprovalForItem(id, pendingApprovals)
    const status = deriveToolStatus(item, pendingApproval)
    return [{
      itemId: id,
      label: summary.label,
      argPreview: summary.argPreview,
      resultPreview: summary.resultPreview,
      extraLines: summary.extraLines,
      ...status,
    }]
  })
}

function statusForTurn(
  turn: Turn | null,
  toolRuns: TaskToolRun[],
  artifacts: GeneratedDocxArtifact[],
  pendingApprovals: PendingApproval[],
): Pick<TaskWorkbenchModel, 'status' | 'tone' | 'label' | 'description'> {
  if (pendingApprovals.length > 0) {
    return {
      status: 'awaitingApproval',
      tone: 'warning',
      label: '等待审批',
      description: `${pendingApprovals.length} 个工具请求需要确认`,
    }
  }

  if (!turn) {
    return {
      status: 'idle',
      tone: 'idle',
      label: '空闲',
      description: '发送指令后，这里会显示当前任务、工具运行和生成文件。',
    }
  }

  const pendingArtifacts = artifacts.filter((artifact) => artifact.status === 'pending').length
  const successArtifacts = artifacts.filter((artifact) => artifact.status === 'success').length
  const failedArtifacts = artifacts.filter((artifact) => artifact.status === 'failed').length
  const runningTools = toolRuns.filter((tool) => tool.status === 'running').length

  if (turn.status === 'running') {
    if (pendingArtifacts > 0) {
      return {
        status: 'running',
        tone: 'running',
        label: '生成中',
        description: `${pendingArtifacts} 个文件正在生成`,
      }
    }
    if (runningTools > 0) {
      return {
        status: 'running',
        tone: 'running',
        label: '工具运行中',
        description: `${runningTools} 个工具正在执行`,
      }
    }
    return {
      status: 'running',
      tone: 'running',
      label: '运行中',
      description: '模型正在处理当前请求',
    }
  }

  if (turn.status === 'failed') {
    return {
      status: 'failed',
      tone: 'danger',
      label: '失败',
      description: failedArtifacts > 0 ? `${failedArtifacts} 个文件生成失败` : '当前任务未完成',
    }
  }

  if (turn.status === 'cancelled') {
    return {
      status: 'cancelled',
      tone: 'danger',
      label: '已取消',
      description: '当前任务已被取消',
    }
  }

  if (successArtifacts > 0) {
    return {
      status: 'completed',
      tone: 'success',
      label: '已完成',
      description: `生成了 ${successArtifacts} 个文件`,
    }
  }

  if (toolRuns.length > 0) {
    return {
      status: 'completed',
      tone: 'success',
      label: '已完成',
      description: `执行了 ${toolRuns.length} 个工具`,
    }
  }

  return {
    status: 'completed',
    tone: 'success',
    label: '已完成',
    description: '当前任务已完成',
  }
}

export function deriveTaskWorkbenchModel({
  turns,
  items,
  pendingApprovals,
}: {
  turns: Turn[]
  items: Record<string, Item>
  pendingApprovals: PendingApproval[]
}): TaskWorkbenchModel {
  const activeTurn = activeTurnForWorkbench(turns)
  const toolRuns = deriveToolRuns(activeTurn, items, pendingApprovals)
  const artifacts = activeTurn ? getGeneratedDocxArtifactsForTurn(activeTurn, items) : []
  return {
    activeTurn,
    toolRuns,
    artifacts,
    ...statusForTurn(activeTurn, toolRuns, artifacts, pendingApprovals),
  }
}
