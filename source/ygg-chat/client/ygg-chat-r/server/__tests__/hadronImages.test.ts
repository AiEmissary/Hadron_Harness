import {expect,it} from 'vitest'
import {parseHadronImages,jpegDimensions,claudeImageInput} from '../../../../shared/hadronImages.js'
import {fixtureImage} from '../../../../shared/__fixtures__/hadronImage.js'
import {parseIndependentJob} from '../../../../shared/independentJobs.js'
import {parseProposalSession} from '../../../../shared/collaboration.js'
it('validates real JPEG dimensions and keeps bytes separate from text',()=>{
 expect(parseHadronImages([fixtureImage])).toEqual([fixtureImage])
 expect(jpegDimensions(Buffer.from(fixtureImage.dataUrl.slice(23),'base64'))).toEqual({width:80,height:50})
 const frame=JSON.parse(claudeImageInput('What shapes are shown?',[fixtureImage]))
 expect(frame.message.content[0]).toEqual({type:'text',text:'What shapes are shown?'})
 expect(frame.message.content[1]).toEqual({type:'image',source:{type:'base64',media_type:'image/jpeg',data:fixtureImage.dataUrl.slice(23)}})
})
it('rejects URLs, renamed files, malformed encodings, oversized images and too many pictures',()=>{
 for(const dataUrl of ['https://example.com/image.jpg','file:///private.jpg','data:image/jpeg;base64,YWJj','data:image/jpeg;base64,?','data:image/png;base64,YWJj',fixtureImage.dataUrl+'A'.repeat(1400000)])expect(()=>parseHadronImages([{...fixtureImage,dataUrl}])).toThrow()
 expect(()=>parseHadronImages(Array.from({length:21},(_,i)=>({...fixtureImage,id:String(i)})))).toThrow('20 pictures')
 expect(()=>parseHadronImages([fixtureImage,fixtureImage])).toThrow()
})
it('retains actual image payloads across strict independent and joint admission',()=>{
 const base={schemaVersion:1,task:'Describe the picture',context:'',images:[fixtureImage]}
 expect(parseIndependentJob({...base,id:'job',conversationId:'chat',anchorMessageId:'q',provider:'claudecode',modelName:'sonnet'}).images).toEqual([fixtureImage])
 expect(parseProposalSession({...base,sessionId:'session',conversationId:'chat',sourceLineageId:'lineage',anchorMessageId:'q',participants:[{id:'a',provider:'openaichatgpt',modelName:'model'},{id:'b',provider:'claudecode',modelName:'sonnet'}]}).images).toEqual([fixtureImage])
})
