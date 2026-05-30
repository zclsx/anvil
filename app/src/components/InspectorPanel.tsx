import { FileSearch } from 'lucide-react'
import type { Item } from '../store'
import { Inspector } from './Inspector'

export function InspectorPanel({ item }: { item: Item | null }) {
  return (
    <aside className="w-[400px] border-l border-outline-variant bg-surface-container-lowest overflow-hidden no-drag flex flex-col">
      {item ? (
        <Inspector item={item} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant italic text-[11px] opacity-75 p-4 text-center">
          <FileSearch size={24} className="mb-2 opacity-40" />
          点击左侧 conversation item 查看详情
        </div>
      )}
    </aside>
  )
}
