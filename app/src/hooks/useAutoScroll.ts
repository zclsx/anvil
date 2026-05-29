import { useEffect, useRef } from 'react'
import type { Item, Turn } from '../store'

export function useAutoScroll({
  turns,
  items,
  pendingApprovalCount,
  autoFollow,
  awaitingFirstItem,
  conversationEndRef,
}: {
  turns: Turn[]
  items: Record<string, Item>
  pendingApprovalCount: number
  autoFollow: boolean
  awaitingFirstItem: boolean
  conversationEndRef: React.RefObject<HTMLDivElement | null>
}): void {
  const autoScrollStateRef = useRef({
    awaitingFirstItem: false,
    lastItemId: null as string | null | undefined,
    lastTurnId: undefined as string | undefined,
    lastTurnStatus: undefined as string | undefined,
    lastTurnItemCount: 0,
    pendingApprovalCount: 0,
    turnsLength: 0,
  })

  const lastTurn = turns[turns.length - 1]
  const lastTurnItemCount = lastTurn?.itemIds.length ?? 0
  const lastItemId = lastTurnItemCount > 0 ? lastTurn?.itemIds[lastTurnItemCount - 1] : null
  const lastItemTextLength = lastItemId ? (items[lastItemId]?.text?.length ?? 0) : 0

  useEffect(() => {
    const nextAutoScrollState = {
      awaitingFirstItem,
      lastItemId,
      lastTurnId: lastTurn?.id,
      lastTurnStatus: lastTurn?.status,
      lastTurnItemCount,
      pendingApprovalCount,
      turnsLength: turns.length,
    }
    const previous = autoScrollStateRef.current
    const isStructuralChange =
      previous.awaitingFirstItem !== nextAutoScrollState.awaitingFirstItem ||
      previous.lastItemId !== nextAutoScrollState.lastItemId ||
      previous.lastTurnId !== nextAutoScrollState.lastTurnId ||
      previous.lastTurnStatus !== nextAutoScrollState.lastTurnStatus ||
      previous.lastTurnItemCount !== nextAutoScrollState.lastTurnItemCount ||
      previous.pendingApprovalCount !== nextAutoScrollState.pendingApprovalCount ||
      previous.turnsLength !== nextAutoScrollState.turnsLength

    autoScrollStateRef.current = nextAutoScrollState
    if (!autoFollow) return
    conversationEndRef.current?.scrollIntoView({
      behavior: isStructuralChange ? 'smooth' : 'auto',
      block: 'end',
    })
  }, [
    autoFollow,
    awaitingFirstItem,
    lastItemId,
    lastItemTextLength,
    lastTurn?.id,
    lastTurn?.status,
    lastTurnItemCount,
    pendingApprovalCount,
    turns.length,
    conversationEndRef,
  ])
}
