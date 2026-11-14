import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import {ProjectBuildPanel} from './ProjectBuildPanel'
it('exposes separate agent entries and native source choice, requiring a proposal before mutation controls',()=>{
 const html=renderToStaticMarkup(<ProjectBuildPanel conversationId='workspace' enabled active options={[{provider:'openaichatgpt',label:'ChatGPT',connected:true,models:[{id:'model',label:'Model'}]}]}/> )
 expect(html).toContain('Project Agent A provider');expect(html).toContain('Project Agent B provider')
 expect(html).toContain('Project Agent A model');expect(html).toContain('Project Agent B model')
 expect(html).toContain('Add source files');expect(html).toContain('Choose project folder')
 expect(html).toContain('Selected source files: 0 / 20')
 expect(html).toContain('Previous selections are kept.')
 expect(html).toContain('Prepare proposal');expect(html).toContain('Files change only after you approve the reviewed snapshot')
 expect(html).toContain('Before you can prepare a proposal:')
 expect(html).toContain('Choose a provider for Agent B.')
 expect(html).toContain('Enter a project goal.')
 expect(html).toContain('Enter at least one deliverable:')
 expect(html).toContain('aria-describedby="project-requirements-workspace"')
 expect(html).not.toContain('Apply reviewed changes');expect(html).not.toContain('Run Node tests');expect(html).not.toContain('Run build/test/fix')
})
