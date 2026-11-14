export function textExcerpt(text:string,name:string,startLine:number,maxLines:number){
 if(!Number.isSafeInteger(startLine)||startLine<1||!Number.isSafeInteger(maxLines)||maxLines<1||maxLines>200)throw Error('Choose a valid start line and 1–200 lines.')
 let totalLines=0,offset=0,part='',clipped=false,endLine=0,selected=0
 do{
  const next=text.indexOf('\n',offset),end=next<0?text.length:next;totalLines++
  if(totalLines>=startLine&&totalLines<startLine+maxLines){
   const line=text.slice(offset,end).replace(/\r$/,''),remaining=Math.max(0,8000-part.length-(selected?1:0))
   if(line.length>remaining)clipped=true
   if(part.length<8000)part+=(selected?'\n':'')+line.slice(0,remaining)
   selected++;endLine=totalLines
  }
  if(next<0)break;offset=next+1
 }while(offset<=text.length)
 if(startLine>totalLines)throw Error('The start line is after the end of the file.')
 return {text:`[Explicit excerpt from ${name}: lines ${startLine}–${endLine} of ${totalLines}${clipped?'; clipped at 8,000 characters':''}. Omitted content is not supplied.]\n${part}`,totalLines,endLine,clipped}
}
