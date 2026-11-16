import {expect,it} from 'vitest'
import {workspaceActivity,sharedWorkspaceActivity} from './workspaceActivity'
import type {ProposalSessionStatus} from '../../../../../shared/collaboration'

it('distinguishes a failed operation from unfinished assigned work and a finished reply',()=>{
 const result=workspaceActivity([{time:'2026-11-16T00:00:00Z',tool:'project_search',state:'failed'},{time:'2026-11-16T00:00:01Z',tool:'project_read',state:'completed'}],[{id:'a',status:'error'},{id:'b',status:'completed'}])
 expect(result.map(item=>[item.label,item.state])).toEqual([['Agent A: Not finished','Not finished'],['Agent B: Reply finished','Reply finished'],['Search project','Failed'],['Read project file','Completed']])
})

it('describes a successful joint reply without asserting that an entire project is finished',()=>{
 const result=sharedWorkspaceActivity({status:'completed',participants:[],collaboration:{phase:'finished',maxRequests:5,stages:[]}} as unknown as ProposalSessionStatus)
 expect(result[0]).toEqual({label:'Joint reply finished',state:'Reply finished'})
})
