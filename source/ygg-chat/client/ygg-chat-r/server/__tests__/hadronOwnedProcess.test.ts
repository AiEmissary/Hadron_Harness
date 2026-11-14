import {spawn,type ChildProcess} from 'node:child_process'
import {EventEmitter} from 'node:events'
import {expect,it,vi} from 'vitest'
import {captureOwnedProcess} from '../auth/hadronOwnedProcess.js'

function fixture(){
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),kill:vi.fn(()=>false)})
 return {child,capture:(options={})=>captureOwnedProcess(child as unknown as ChildProcess,{timeout:10000,...options})}
}
const tick=async()=>{await Promise.resolve();await Promise.resolve()}
it('does not publish completion on an error or exit event before actual close',async()=>{
 const f=fixture();let settled=false
 const result=f.capture().catch(error=>error).finally(()=>{settled=true})
 f.child.emit('error',Error('synthetic error'));f.child.emit('exit',1);await tick()
 expect(settled).toBe(false);expect(f.child.kill).toHaveBeenCalledOnce()
 f.child.emit('close',1)
 expect(await result).toBeInstanceOf(Error);expect(settled).toBe(true)
})
it('turns a throwing output observer into a stopped, joined failure',async()=>{
 const f=fixture();let settled=false
 const result=f.capture({onText:()=>{throw Error('private observer detail')}}).catch(error=>error).finally(()=>{settled=true})
 expect(()=>f.child.stdout.emit('data',Buffer.from('response'))).not.toThrow()
 await tick();expect(settled).toBe(false);expect(f.child.kill).toHaveBeenCalledOnce()
 f.child.emit('close',0)
 const error=await result;expect(error).toBeInstanceOf(Error);expect(error.message).not.toContain('private observer detail')
})
it.each(['stdout','stderr','stdin'] as const)('joins after an error in the %s pipe',async(pipe)=>{
 const f=fixture();let settled=false
 const result=f.capture().catch(error=>error).finally(()=>{settled=true})
 f.child[pipe].emit('error',Error('synthetic pipe failure'));await tick()
 expect(settled).toBe(false);f.child.emit('close',1);expect(await result).toBeInstanceOf(Error)
})
it('does not mistake a thrown or unsuccessful kill for termination',async()=>{
 const f=fixture(),controller=new AbortController();let settled=false
 f.child.kill.mockImplementation(()=>{throw Error('synthetic kill denial')})
 const result=f.capture({signal:controller.signal}).catch(error=>error).finally(()=>{settled=true})
 expect(()=>controller.abort()).not.toThrow();await tick();expect(settled).toBe(false)
 f.child.emit('close',0);expect(await result).toBeInstanceOf(Error)
})
it('bounds output and waits for close after exceeding the byte budget',async()=>{
 const f=fixture();let settled=false
 const result=f.capture({maxBytes:4}).finally(()=>{settled=true})
 f.child.stdout.emit('data',Buffer.from('abcd'));f.child.stdout.emit('data',Buffer.from('overflow'));await tick()
 expect(settled).toBe(false);expect(f.child.kill).toHaveBeenCalledOnce()
 f.child.emit('close',0);expect(await result).toMatchObject({code:null,text:'abcd',category:'output_limit'})
})
it('waits for close after a deadline instead of claiming a successful kill',async()=>{
 vi.useFakeTimers()
 try{
  const f=fixture();let settled=false
  const result=f.capture({timeout:50}).finally(()=>{settled=true})
  await vi.advanceTimersByTimeAsync(50);expect(settled).toBe(false);expect(f.child.kill).toHaveBeenCalledOnce()
  f.child.emit('close',0);expect(await result).toMatchObject({code:null,category:'timeout'})
 }finally{vi.useRealTimers()}
})
it('joins when stdin submission throws and never retries it',async()=>{
 const f=fixture();let settled=false
 f.child.stdin.end.mockImplementation(()=>{throw Error('synthetic write failure')})
 const result=f.capture({input:'synthetic input'}).catch(error=>error).finally(()=>{settled=true})
 await tick();expect(settled).toBe(false);expect(f.child.stdin.end).toHaveBeenCalledOnce()
 f.child.emit('close',1);expect(await result).toBeInstanceOf(Error)
})
it('keeps JSON stdout separate from configuration warnings',async()=>{
 const f=fixture(),result=f.capture({jsonOutput:true})
 f.child.stdout.emit('data',Buffer.from('{"answer":"ok"}\n'))
 f.child.stderr.emit('data',Buffer.from('invalid config synthetic warning'))
 f.child.emit('close',0)
 expect(await result).toEqual({code:0,text:'{"answer":"ok"}\n',category:'configuration'})
})
it('joins a real local process after cancellation triggered by its output',async()=>{
 const controller=new AbortController(),child=spawn(process.execPath,['-e','process.stdout.write("ready");setInterval(()=>{},1000)'],{windowsHide:true,shell:false,stdio:'pipe'})
 let closed=false;child.once('close',()=>{closed=true})
 try{
  const result=await captureOwnedProcess(child,{signal:controller.signal,timeout:5000,onText:()=>controller.abort()})
  expect(result.code).toBeNull();expect(closed).toBe(true);expect(result.text).toBe('ready')
 }finally{if(!closed)child.kill()}
})
it('joins a real failed spawn without exposing platform error details',async()=>{
 const child=spawn(process.execPath+'-hadron-no-such-binary',[],{windowsHide:true,shell:false,stdio:'pipe'})
 let closed=false;child.once('close',()=>{closed=true})
 await expect(captureOwnedProcess(child,{timeout:5000})).rejects.toThrow('process closure was observed')
 expect(closed).toBe(true)
})
