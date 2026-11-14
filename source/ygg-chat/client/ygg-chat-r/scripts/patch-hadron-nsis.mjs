import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'

// Backport the Win8+ guard from electron-builder PR 9564 without changing the
// runtime dependency graph. The pinned 26.8.1 template can otherwise over-read
// the short SHGetKnownFolderPath buffer in System.dll (fault offset 0x1581).
export const originalTemplateHash='401ed51f541f6bfdbf8f855b026ff6708f20ed2c67569f7b89e5f6942e1e8558'
const marker='      # Hadron: upstream electron-builder PR 9564, Windows 8+ uses the standard per-user Programs path.\n'
const hash=text=>createHash('sha256').update(text).digest('hex')
export function fixNsisTemplate(input){
 const text=input.replace(/\r\n/g,'\n')
 if(text.includes(marker)){
  const original=text.replace(marker+'      ${IfNot} ${AtLeastWin8}\n','').replace('      ${EndIf} # Hadron Win7 compatibility guard\n','')
  if(hash(original)!==originalTemplateHash)throw Error('Unknown modified NSIS template; review the pinned backport')
  return text
 }
 if(hash(text)!==originalTemplateHash)throw Error('Unknown NSIS template; review the pinned backport')
 return text.replace('      System::Store S\n',marker+'      ${IfNot} ${AtLeastWin8}\n      System::Store S\n').replace('      System::Store L\n','      System::Store L\n      ${EndIf} # Hadron Win7 compatibility guard\n')
}
export function patchHadronNsis(appDir=path.resolve(import.meta.dirname,'..')){
 const require=createRequire(path.join(appDir,'package.json')),manifest=require.resolve('app-builder-lib/package.json')
 const file=fs.realpathSync(path.join(path.dirname(manifest),'templates/nsis/multiUser.nsh'))
 if(!file.startsWith(fs.realpathSync(path.resolve(appDir,'../../..'))+path.sep))throw Error('NSIS backport must stay inside the Hadron checkout')
 const before=fs.readFileSync(file,'utf8'),after=fixNsisTemplate(before)
 if(before!==after)fs.writeFileSync(file,after)
 return {templatePatched:true,upstream:'https://github.com/electron-userland/electron-builder/pull/9564',originalSha256:originalTemplateHash,patchedSha256:hash(after),scope:'Hadron-local build dependency only; no system or original application changes'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(patchHadronNsis(),null,2))
