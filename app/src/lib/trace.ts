import type { Item, Turn } from '../store'

export type SplitTurnItemsResult = {
  userItems: Item[]
  processItems: Item[]
  finalAnswer: Item | null
}

export function splitTurnItems(turn: Pick<Turn, 'itemIds'>, items: Record<string, Item>): SplitTurnItemsResult {
  const turnItems = turn.itemIds
    .map((id) => items[id])
    .filter((item): item is Item => item != null)

  let finalAnswerId: string | null = null
  for (const item of turnItems) {
    if (item.role === 'assistant' && item.kind === 'text') {
      finalAnswerId = item.id
    }
  }

  const userItems: Item[] = []
  const processItems: Item[] = []
  let finalAnswer: Item | null = null

  for (const item of turnItems) {
    if (item.role === 'user') {
      userItems.push(item)
    } else if (item.id === finalAnswerId) {
      finalAnswer = item
    } else {
      processItems.push(item)
    }
  }

  return { userItems, processItems, finalAnswer }
}
