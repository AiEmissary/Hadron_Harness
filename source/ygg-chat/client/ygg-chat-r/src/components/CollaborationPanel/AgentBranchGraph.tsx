import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentConversationNode } from '../../../../../shared/independentJobs'
import { layoutAgentBranches } from '../../features/collaboration/agentConversation'

export function AgentBranchGraph({ nodes, slot, selectedId, onSelect }: {
  nodes: AgentConversationNode[]; slot: 'a' | 'b' | 'shared'; selectedId: string | null; onSelect(id: string): void
}) {
  const layout = useMemo(() => layoutAgentBranches(nodes), [nodes]), [zoom, setZoom] = useState(0.85)
  const viewport = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const point = selectedId ? layout.points.get(selectedId) : null
    if (point && viewport.current) viewport.current.scrollLeft = Math.max(0, point.x * zoom - viewport.current.clientWidth / 2)
  }, [selectedId, layout, zoom])
  const label = slot === 'shared' ? 'Shared' : `Agent ${slot.toUpperCase()}`
  const color = slot === 'a' ? '#8b5cf6' : '#14b8a6'
  return <div>
    <div className='mb-1 flex justify-end gap-1'><button type='button' aria-label={`Zoom out ${label} tree`} onClick={() => setZoom(current => Math.max(0.45, current - 0.15))} className='px-2 text-xs'>−</button><span className='px-1 text-xs'>{Math.round(zoom * 100)}%</span><button type='button' aria-label={`Zoom in ${label} tree`} onClick={() => setZoom(current => Math.min(1.6, current + 0.15))} className='px-2 text-xs'>+</button></div>
    <div ref={viewport} className='overflow-auto' aria-label={`${label} branch graph`}>
      <svg width={layout.width * zoom} height={layout.height * zoom} viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ minWidth: layout.width * zoom }} role='group' aria-label={`${label} question and answer nodes`}>
        {nodes.filter(node => node.parentId).map(node => {
          const parent = layout.points.get(node.parentId!)!, child = layout.points.get(node.id)!
          return <path key={node.id} d={`M ${parent.x} ${parent.y + 35} C ${parent.x} ${parent.y + 65}, ${child.x} ${child.y - 65}, ${child.x} ${child.y - 35}`} fill='none' stroke={color} strokeWidth={2.5} opacity={0.65} />
        })}
        {nodes.map(node => {
          const point = layout.points.get(node.id)!, selected = selectedId === node.id
          return <foreignObject key={node.id} x={point.x - 80} y={point.y - 30} width={160} height={76}>
            <button type='button' aria-pressed={selected} aria-label={`${label} branch ${node.kind}: ${node.text.slice(0, 60) || node.status}`} title={node.text.slice(0, 500)} onClick={() => onSelect(node.id)}
              className='flex h-[70px] w-full flex-col overflow-hidden rounded-lg border-2 bg-white px-2 py-1 text-left shadow-sm dark:bg-neutral-800'
              style={{ borderColor: color, outline: selected ? `2px solid ${color}` : undefined, outlineOffset: -4 }}>
              <span className='flex w-full items-center gap-2 text-[11px] font-semibold'><span aria-hidden='true' className='h-2 w-2 rounded-full' style={{ background: node.kind === 'task' ? color : '#38bdf8' }} />{node.kind === 'task' ? 'You' : slot === 'shared' ? 'Combined answer' : `Agent ${slot.toUpperCase()}`}<span className='ml-auto truncate text-[9px] font-normal'>{node.status}</span></span>
              <span className='mt-1 line-clamp-2 w-full whitespace-normal break-words text-[11px] leading-4'>{node.text || 'Waiting for response...'}</span>
            </button>
          </foreignObject>
        })}
      </svg>
    </div>
  </div>
}
