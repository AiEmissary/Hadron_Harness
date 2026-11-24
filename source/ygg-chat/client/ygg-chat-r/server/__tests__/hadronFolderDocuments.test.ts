import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import {afterEach,beforeEach,expect,it} from 'vitest'
import {ProjectReadHost} from '../hadronTools/projectRead.js'

let root:string,project:string
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'hadron-folder-docs-'));project=path.join(root,'project');fs.mkdirSync(project)})
afterEach(()=>{fs.rmSync(root,{recursive:true,force:true})})
const signal=()=>new AbortController().signal
const tools=()=>{const host=new ProjectReadHost(),grant=host.grant('owner','workspace','a',project);return host.session('owner',grant.id,'workspace','a')}

/** A small but valid PDF: one page per entry, each drawing its text with a standard font. */
function pdf(pages:string[]):Buffer{
  const objects:string[]=[]
  const pageIds=pages.map((_,index)=>4+index*2)
  objects[1]='<< /Type /Catalog /Pages 2 0 R >>'
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  pages.forEach((text,index)=>{
    const page=4+index*2,stream=`BT /F1 18 Tf 72 720 Td (${text}) Tj ET`
    objects[page]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page+1} 0 R >>`
    objects[page+1]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  })
  let body='%PDF-1.4\n'
  const offsets:number[]=[]
  for(let id=1;id<objects.length;id++){offsets[id]=body.length;body+=`${id} 0 obj\n${objects[id]}\nendobj\n`}
  const xref=body.length
  body+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')
  body+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body,'latin1')
}

/** A minimal Word (.docx) document with one paragraph per entry. */
async function docx(paragraphs:string[]):Promise<Buffer>{
  const zip=new JSZip()
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs.map(text=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join('')+'</w:body></w:document>')
  return zip.generateAsync({type:'nodebuffer'})
}

it('reads the text of a PDF in a shared folder, page by page and in line ranges',async()=>{
  fs.writeFileSync(path.join(project,'Report.PDF'),pdf(['Quarterly summary','Budget is 4200 pounds']))
  const read=await tools().invoke('project_read',{path:'Report.PDF'},signal()) as {text:string;sha256:string;untrustedContent:boolean}
  expect(read.text).toContain('Page 1');expect(read.text).toContain('Quarterly summary')
  expect(read.text).toContain('Page 2');expect(read.text).toContain('Budget is 4200 pounds')
  expect(read.sha256).toMatch(/^[a-f0-9]{64}$/);expect(read.untrustedContent).toBe(true)
  const lines=read.text.split('\n'),budgetLine=lines.findIndex(line=>line.includes('Budget'))+1
  const part=await tools().invoke('project_read',{path:'Report.PDF',startLine:budgetLine,maxLines:1},signal()) as {text:string}
  expect(part.text).toContain('Budget is 4200 pounds');expect(part.text).not.toContain('Quarterly')
})

it('reads the text of a Microsoft Word document in a shared folder',async()=>{
  fs.writeFileSync(path.join(project,'Letter.docx'),await docx(['Dear team,','The launch moves to Friday.']))
  const read=await tools().invoke('project_read',{path:'Letter.docx'},signal()) as {text:string}
  expect(read.text).toContain('Dear team,');expect(read.text).toContain('The launch moves to Friday.')
})

it('reads an old Word 97-2003 (.doc) document made by Microsoft Word, including its footnote',async()=>{
  // Fixture saved by Microsoft Word in the binary .doc format; it contains only this test text.
  fs.copyFileSync(path.join(import.meta.dirname,'fixtures','legacy-word-97.doc'),path.join(project,'Minutes.DOC'))
  const read=await tools().invoke('project_read',{path:'Minutes.DOC'},signal()) as {text:string}
  expect(read.text).toContain('Hadron legacy Word test')
  expect(read.text).toContain('The meeting moves to Thursday at 3pm.')
  expect(read.text).toContain('Budget: 4,200 pounds (café costs included).')
  expect(read.text).toContain('Footnotes');expect(read.text).toContain('Footnote: confirmed by email.')
})

it('explains unreadable documents instead of returning raw bytes',async()=>{
  fs.writeFileSync(path.join(project,'broken.pdf'),'not really a pdf')
  fs.writeFileSync(path.join(project,'broken.docx'),'not really a word file')
  fs.writeFileSync(path.join(project,'broken.doc'),'not really an old word file either')
  await expect(tools().invoke('project_read',{path:'broken.pdf'},signal())).rejects.toThrow('PDF could not be read')
  await expect(tools().invoke('project_read',{path:'broken.docx'},signal())).rejects.toThrow('Word document could not be read')
  await expect(tools().invoke('project_read',{path:'broken.doc'},signal())).rejects.toThrow('not really a .doc file')
})

it('still reads HTML in a shared folder as text',async()=>{
  fs.writeFileSync(path.join(project,'page.html'),'<!doctype html><h1>Welcome</h1>')
  const read=await tools().invoke('project_read',{path:'page.html'},signal()) as {text:string}
  expect(read.text).toContain('<h1>Welcome</h1>')
})
