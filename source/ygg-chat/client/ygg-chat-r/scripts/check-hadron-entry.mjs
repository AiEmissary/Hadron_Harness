import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const require = createRequire(import.meta.url), appDir = path.resolve(import.meta.dirname, '..')
const profile = await mkdtemp(path.join(os.tmpdir(), 'hadron-entry-'))
const output = path.join(appDir, 'node_modules/.cache/hadron/entry-fixture.js')
await mkdir(path.dirname(output), { recursive: true })
await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Entry from './src/containers/HadronEntry';
window.entryCalls=[];window.entryFail=location.search.includes('failure');window.entryFetches=0;window.fetch=()=>{window.entryFetches++;throw Error('Network blocked')};
createRoot(document.getElementById('root')).render(<MemoryRouter><Routes><Route path='/' element={<Entry/>}/><Route path='/homepage' element={<h1>Local workspace opened</h1>}/></Routes></MemoryRouter>);`,
  resolveDir: appDir, loader: 'tsx' }, outfile: output, bundle: true, platform: 'browser', jsx: 'automatic', loader: { '.jpg': 'dataurl' },
  plugins: [{ name: 'mock-local-auth', setup(builder) {
    builder.onResolve({ filter: /hooks\/useAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `const signIn=async credentials=>{window.entryCalls.push(credentials);if(window.entryFail)throw Error('fixture failure')};export const useAuth=()=>({loading:false,signIn});` }))
  } }] })
const html = path.join(profile, 'entry.html')
await writeFile(html, `<div id="root"></div><script src="${pathToFileURL(output).href}"></script>`)
const main = path.join(profile, 'entry-main.cjs')
await writeFile(main, `const {app,BrowserWindow}=require('electron');const fs=require('node:fs');app.setPath('userData',${JSON.stringify(profile)});app.whenReady().then(async()=>{let win;try{
win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true}});win.webContents.session.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('data:')}));
const run=code=>win.webContents.executeJavaScript(code);const wait=async code=>{for(let i=0;i<100;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,30))}throw Error('Entry fixture timed out')};
await win.loadFile(${JSON.stringify(html)});await wait('document.body.textContent.includes("Local workspace opened")');
if(!await run('entryCalls.length===1&&entryCalls[0].email===""&&entryCalls[0].password===""&&entryFetches===0'))throw Error('Wrong local auth');
await win.loadFile(${JSON.stringify(html)},{query:{failure:'1'}});await wait('document.body.textContent.includes("Try again")');
if(await run('document.body.textContent.includes("Sign in to Graviton")'))throw Error('Cloud login displayed');
await run('window.entryFail=false;document.querySelector("button").click()');await wait('document.body.textContent.includes("Local workspace opened")');
if(!await run('entryCalls.length===2&&entryFetches===0'))throw Error('Retry did not recover');
const report={success:true,localEntry:true,noCloudLogin:true,retryRecovery:true,networkRequests:0,realAccountsUsed:false,profile:${JSON.stringify(profile)}};fs.writeFileSync(${JSON.stringify(path.join(profile, 'entry-result.json'))},JSON.stringify(report,null,2));console.log(JSON.stringify(report));win.destroy();app.quit();
}catch(error){console.error(error);win?.destroy();app.exit(1)}});`)
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
const child = spawn(require('electron'), [main], { cwd: appDir, env, windowsHide: true, stdio: 'inherit' })
const timer = setTimeout(() => { child.kill(); process.exitCode = 1 }, 30000)
child.on('exit', code => { clearTimeout(timer); process.exitCode = code ?? 1 })
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1 })
