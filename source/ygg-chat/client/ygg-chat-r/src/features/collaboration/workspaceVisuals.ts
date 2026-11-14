export interface WorkspaceVisual {title:string;source:string;kind:'svg'|'image'}
export const WORKSPACE_VISUAL_INSTRUCTION='When the user asks to see a drawing, design, mock-up, diagram or graph, include a complete self-contained SVG in a fenced ```svg block in your reply, with a viewBox, readable labels and no scripts, links or external resources. Hadron displays it in a visual preview. Explain it briefly outside the block. Do not claim to have generated a photograph or image file unless a tool actually did so. For graphs, label axes and units and distinguish supplied data from illustrative data. For ordinary questions, respond normally without a visual.'
/** Artifacts stay in the saved reply, so branches, copies and reload need no separate store. */
export function workspaceVisuals(text:string):WorkspaceVisual[]{
 const visuals:WorkspaceVisual[]=[]
 for(const match of text.matchAll(/```svg[^\S\r\n]*\r?\n([\s\S]*?)```/gi)){
  if(match[1].length<=200000&&/^\s*<svg[\s>]/i.test(match[1]))visuals.push({title:`Visual ${visuals.length+1}`,source:match[1].trim(),kind:'svg'})
  if(visuals.length===8)break
 }
 if(!visuals.length&&/^\s*<svg[\s>]/i.test(text)&&text.length<=200000)visuals.push({title:'Visual 1',source:text.trim(),kind:'svg'})
 for(const match of text.matchAll(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)\)/g)){
  if(visuals.length===8)break
  if(match[2].length<=4000000)visuals.push({title:match[1]||`Image ${visuals.length+1}`,source:match[2],kind:'image'})
 }
 return visuals
}
export function workspaceVisualText(text:string):string{
 if(/^\s*<svg[\s>]/i.test(text)&&text.length<=200000)return ''
 return text.replace(/```svg[^\S\r\n]*\r?\n([\s\S]*?)```/gi,(block,source:string)=>source.length<=200000&&/^\s*<svg[\s>]/i.test(source)?'':block)
  .replace(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)\)/g,(block,_title:string,source:string)=>source.length<=4000000?'':block).trim()
}
/** A small inert vector vocabulary. Never insert model markup into the app DOM. */
export function safeWorkspaceSvg(source:string):string{
 const document=new DOMParser().parseFromString(source,'image/svg+xml')
 if(document.querySelector('parsererror')||document.documentElement.localName!=='svg')throw Error('This drawing is incomplete. Ask the agent to provide a complete SVG.')
 const tags=new Set(['svg','g','rect','circle','ellipse','line','polyline','polygon','path','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','title','desc'])
 const attributes=new Set(['xmlns','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity','fill-opacity','stroke-opacity','transform','font-family','font-size','font-weight','text-anchor','dominant-baseline','dx','dy','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path'])
 for(const node of Array.from(document.querySelectorAll('*'))){
  if(!tags.has(node.localName)){node.remove();continue}
  for(const attribute of Array.from(node.attributes)){
   if(!attributes.has(attribute.name)||/[<>]|(?:https?:|data:|javascript:|file:|\\)/i.test(attribute.value)&&attribute.name!=='xmlns'||/url\(/i.test(attribute.value)&&!/^url\(#[\w-]+\)$/.test(attribute.value))node.removeAttribute(attribute.name)
  }
 }
 document.documentElement.setAttribute('xmlns','http://www.w3.org/2000/svg')
 return new XMLSerializer().serializeToString(document.documentElement)
}
