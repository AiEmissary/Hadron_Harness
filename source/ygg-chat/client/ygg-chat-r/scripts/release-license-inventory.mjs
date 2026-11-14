import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const app=path.resolve(import.meta.dirname,'..'),out=path.resolve(app,'../../../../distribution/licences')
fs.mkdirSync(out,{recursive:true})
const visited=new Set(),packages=[],missing=[]
function manifest(name,from){const require=createRequire(path.join(from,'package.json'));return (require.resolve.paths(name+'/package.json')??[]).map(root=>path.join(root,name,'package.json')).find(file=>fs.existsSync(file))}
function visit(name,from,optional=false){
 const file=manifest(name,from);if(!file){if(!optional)missing.push(name);return}
 const real=fs.realpathSync(file);if(visited.has(real))return;visited.add(real)
 const pkg=JSON.parse(fs.readFileSync(real,'utf8')),directory=path.dirname(real)
 let files=fs.readdirSync(directory).filter(name=>/^(licen[cs]e|copying|notice)([._-].*)?$/i.test(name)&&fs.statSync(path.join(directory,name)).isFile())
 if(!files.length){const readme=fs.readdirSync(directory).find(name=>/^readme/i.test(name));if(readme&&/Permission is hereby granted/.test(fs.readFileSync(path.join(directory,readme),'utf8')))files.push(readme)}
 const record={name:pkg.name,version:pkg.version,license:pkg.license??pkg.licenses??null,repository:pkg.repository??null,notices:files}
 if(!record.license&&files.some(name=>fs.readFileSync(path.join(directory,name),'utf8').startsWith('The MIT License'))){record.license='MIT';record.licenseEvidence='Installed licence text, not missing package metadata'}
 packages.push(record)
 const target=path.join(out,'npm',encodeURIComponent(pkg.name)+'@'+pkg.version);fs.mkdirSync(target,{recursive:true})
 for(const name of files)fs.copyFileSync(path.join(directory,name),path.join(target,name))
 for(const [name] of Object.entries({...pkg.dependencies,...pkg.optionalDependencies}))visit(name,directory,Object.hasOwn(pkg.optionalDependencies??{},name))
 for(const [name] of Object.entries(pkg.peerDependencies??{}))visit(name,directory,pkg.peerDependenciesMeta?.[name]?.optional===true)
}
const own=JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8'))
for(const name of Object.keys({...own.dependencies,...own.optionalDependencies}))visit(name,app,Object.hasOwn(own.optionalDependencies??{},name))
packages.sort((a,b)=>(a.name+'@'+a.version).localeCompare(b.name+'@'+b.version))
const report={generated:'2026-11-08',scope:'Installed production dependency closure, conservatively including dependencies which a bundler may eliminate. Not a legal certification.',packages,missingRequired:[...new Set(missing)],reviewRequired:packages.filter(pkg=>!pkg.license||/SEE LICENSE|UNLICENSED|GPL|AGPL|LGPL|proprietary/i.test(JSON.stringify(pkg.license))).map(pkg=>({name:pkg.name,version:pkg.version,license:pkg.license})),missingNoticeText:packages.filter(pkg=>!pkg.notices.length).map(pkg=>pkg.name+'@'+pkg.version)}
if(process.argv.includes('--fetch-missing-notices')){
 for(const item of packages.filter(pkg=>!pkg.notices.length)){
  try{
   const metadata=await fetch('https://registry.npmjs.org/'+encodeURIComponent(item.name)+'/'+item.version).then(r=>r.json())
   const repository=typeof metadata.repository==='string'?metadata.repository:metadata.repository?.url
   const normalized=repository?.replace(/^github:/,'').replace(/^.*github\.com[:/]/,'').replace(/[?#].*$/,'').replace(/\.git$/,'').split('/').slice(0,2).join('/')
   if(!normalized||!normalized.includes('/'))continue
   const refs=[...new Set([metadata.gitHead,item.name+'@'+item.version,'v'+item.version,item.version].filter(Boolean))]
   let found=false
   for(const ref of refs){
   for(const name of ['LICENSE','LICENSE.md','LICENSE.txt','license','LICENSE-MIT','LICENSE-MIT.txt','license-mit','license.md']){
    const url=`https://raw.githubusercontent.com/${normalized}/${ref}/${name}`,response=await fetch(url)
    if(!response.ok)continue
    const text=await response.text();if(text.length<50||text.length>100000)continue
    const target=path.join(out,'npm',encodeURIComponent(item.name)+'@'+item.version,'UPSTREAM-'+name)
    fs.writeFileSync(target,text);item.notices.push('UPSTREAM-'+name);item.noticeSource=url;found=true;break
   }
   if(found)break
   }
  }catch(error){item.noticeFetchError=String(error.message)}
 }
 report.missingNoticeText=packages.filter(pkg=>!pkg.notices.length).map(pkg=>pkg.name+'@'+pkg.version)
}
report.publisherDeclarationsUsed=[]
for(const item of packages.filter(pkg=>!pkg.notices.length)){
 if(!['MIT','BSD-2-Clause'].includes(item.license))continue
 const pkg=JSON.parse(fs.readFileSync(manifest(item.name,app),'utf8'))
 if(pkg.version!==item.version)continue
 const target=path.join(out,'npm',encodeURIComponent(item.name)+'@'+item.version)
 const template=item.license==='MIT'?path.join(path.dirname(manifest('khroma',app)),'license'):path.join(path.dirname(manifest('mammoth',app)),'LICENSE')
 const text=fs.readFileSync(template,'utf8'),start=text.indexOf(item.license==='MIT'?'Permission is hereby granted':'Redistribution')
 if(start<0)continue
 const declaration={name:pkg.name,version:pkg.version,license:pkg.license,author:pkg.author,repository:pkg.repository,source:'https://registry.npmjs.org/'+encodeURIComponent(pkg.name)+'/'+pkg.version}
 fs.writeFileSync(path.join(target,'PUBLISHER-DECLARATION.json'),JSON.stringify(declaration,null,2))
 fs.writeFileSync(path.join(target,'DECLARED-LICENCE-NOTICE.txt'),`Package: ${pkg.name} ${pkg.version}\nAuthor as declared by the publisher: ${typeof pkg.author==='string'?pkg.author:JSON.stringify(pkg.author)}\nDeclared licence: ${pkg.license}\nThe published package and checked source contain no standalone licence text. The publisher's exact declaration is included separately. The standard declared licence terms are reproduced below; this is not represented as an upstream-authored notice and no copyright year is invented.\n\n${text.slice(start)}`)
 item.notices.push('PUBLISHER-DECLARATION.json','DECLARED-LICENCE-NOTICE.txt');item.publisherLicenceTextUnavailable=true;report.publisherDeclarationsUsed.push(pkg.name+'@'+pkg.version)
}
report.missingNoticeText=packages.filter(pkg=>!pkg.notices.length).map(pkg=>pkg.name+'@'+pkg.version)
fs.writeFileSync(path.join(out,'npm-inventory.json'),JSON.stringify(report,null,2))
fs.copyFileSync(path.resolve(app,'../../../license.md'),path.join(out,'HADRON-AGPL-3.0.md'))
for(const name of ['LICENSE','LICENSES.chromium.html']){const file=path.join(app,'release/win-unpacked',name);if(fs.existsSync(file))fs.copyFileSync(file,path.join(out,'Electron-'+name))}
for(const [directory,name] of [['codex','LICENSE'],['codex','NOTICE'],['claude-code','node_modules/@anthropic-ai/claude-code/LICENSE.md']])fs.copyFileSync(path.join(app,'vendor',directory,name),path.join(out,directory+'-'+path.basename(name)))
console.log(JSON.stringify({packages:packages.length,missingRequired:report.missingRequired,reviewRequired:report.reviewRequired,missingNoticeCount:report.missingNoticeText.length,output:out},null,2))
