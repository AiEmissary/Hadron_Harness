import type {ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {useJobTreeWorkspace} from './JobTreeWorkspace'

/** All workflow instructions live in the left pane; configuration stays right. */
export function WorkflowComposer({mode,label,children}:{mode:'shared'|'project'|'continuous';label:string;children:ReactNode}){
 const workspace=useJobTreeWorkspace(),target=workspace?.targets[`${mode}Composer`]
 const content=<section aria-label={label} data-workflow-composer={mode} className='space-y-3 rounded-xl border-2 border-cyan-400 bg-white p-3 focus-within:ring-2 focus-within:ring-cyan-400 dark:bg-neutral-900'><h2 className='font-semibold'>{label}</h2>{children}</section>
 return target?createPortal(content,target):content
}
