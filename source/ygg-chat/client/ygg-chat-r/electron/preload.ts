import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    completionAlerts:{notify:(input:import('../../../shared/hadronCompletion').CompletionAlert,mode:'ping'|'voice')=>ipcRenderer.invoke('completion-alert:notify',input,mode),ping:()=>ipcRenderer.invoke('completion-alert:ping'),onOpen:(callback:(input:{projectId:string;chatId:string})=>void)=>{const listener=(_event:Electron.IpcRendererEvent,input:{projectId:string;chatId:string})=>callback(input);ipcRenderer.on('completion-alert:open',listener);return()=>ipcRenderer.removeListener('completion-alert:open',listener)}},
    workspaceArchive:{copyNew:(input:unknown)=>ipcRenderer.invoke('workspace-archive:copy-new',input),load:(id:string)=>ipcRenderer.invoke('workspace-archive:load',id),save:(chat:unknown,revision:number)=>ipcRenderer.invoke('workspace-archive:save',chat,revision),copy:(input:unknown)=>ipcRenderer.invoke('workspace-archive:copy',input),trash:(id:string,ids:string[],revision:number,excerpts?:unknown)=>ipcRenderer.invoke('workspace-archive:trash',id,ids,revision,excerpts),note:(id:string,ids:string[],text:string,revision:number)=>ipcRenderer.invoke('workspace-archive:note',id,ids,text,revision)},
    recycleBin:{list:()=>ipcRenderer.invoke('recycle-bin:list'),restore:(kind:'project'|'conversation'|'branch',id:string)=>ipcRenderer.invoke('recycle-bin:restore',kind,id)},
    chatArchive:{export:()=>ipcRenderer.invoke('chat-archive:export'),import:()=>ipcRenderer.invoke('chat-archive:import')},
    contextCopy:{list:(workspace:string)=>ipcRenderer.invoke('context-copy:list',workspace),copy:(input:any)=>ipcRenderer.invoke('context-copy:copy',input),copyMany:(input:any)=>ipcRenderer.invoke('context-copy:copy-many',input)},
    helpers:{list:(workspace:string)=>ipcRenderer.invoke('helpers:list',workspace),preference:(enabled?:boolean)=>ipcRenderer.invoke('helpers:preference',enabled)},
    hadronSetup:()=>ipcRenderer.invoke('hadron:setup'),
    continuousChat:{
      claudeModels:()=>ipcRenderer.invoke('continuous:claude-models'),
      start:(input:import('../../../shared/continuousChat.js').ContinuousChatInput)=>ipcRenderer.invoke('continuous:start',input),
      continueSaved:(id:string,input:import('../../../shared/continuousChat.js').ContinuousContinuationInput)=>ipcRenderer.invoke('continuous:continue',id,input),
      status:(id:string)=>ipcRenderer.invoke('continuous:status',id),list:(workspace:string)=>ipcRenderer.invoke('continuous:list',workspace),
      check:(workspace:string,id:string)=>ipcRenderer.invoke('continuous:check',workspace,id),
      pause:(id:string)=>ipcRenderer.invoke('continuous:pause',id),stop:(id:string)=>ipcRenderer.invoke('continuous:stop',id),
      resume:(id:string,revision:number,extraTurns:number)=>ipcRenderer.invoke('continuous:resume',id,revision,extraTurns),
      inject:(id:string,messageId:string,text:string)=>ipcRenderer.invoke('continuous:inject',id,messageId,text),
    },
    projectDraft: {
      fromFolder:(workspace:string,slot:'a'|'b'|'shared'|'continuous',grantId:string)=>ipcRenderer.invoke('project-draft:from-folder',workspace,slot,grantId),
      asRead:(workspace:string,grantId:string,target:'a'|'b'|'shared'|'continuous')=>ipcRenderer.invoke('project-draft:as-read',workspace,grantId,target),
      milestones:(workspace:string)=>ipcRenderer.invoke('project-draft:milestones',workspace),
      accept:(id:string,checked:string[],testsWaived:boolean)=>ipcRenderer.invoke('project-draft:accept',id,checked,testsWaived),
      nextMilestone:(id:string)=>ipcRenderer.invoke('project-draft:next',id),
      availability:()=>ipcRenderer.invoke('project-draft:availability'),
      choose:(workspace:string)=>ipcRenderer.invoke('project-draft:choose',workspace),
      sources:(grantId:string)=>ipcRenderer.invoke('project-draft:sources',grantId),
      clearSources:(grantId:string)=>ipcRenderer.invoke('project-draft:clear-sources',grantId),
      start:(grantId:string,input:import('../../../shared/projectBuild.js').ProjectDraftInput)=>ipcRenderer.invoke('project-draft:start',grantId,input),
      status:(id:string)=>ipcRenderer.invoke('project-draft:status',id),
      check:(workspace:string,id:string)=>ipcRenderer.invoke('project-draft:check',workspace,id),
      list:(workspace:string)=>ipcRenderer.invoke('project-draft:list',workspace),
      stop:(id:string)=>ipcRenderer.invoke('project-draft:stop',id),
      close:(id:string)=>ipcRenderer.invoke('project-draft:close',id),
    journal:(id:string,role:'a'|'b')=>ipcRenderer.invoke('project-draft:journal',id,role),
    inspect:(id:string)=>ipcRenderer.invoke('project-draft:inspect',id),
    apply:(id:string)=>ipcRenderer.invoke('project-draft:apply',id),
    runChecks:(id:string)=>ipcRenderer.invoke('project-draft:checks',id),
    runBuild:(id:string)=>ipcRenderer.invoke('project-draft:build',id),
    repair:(id:string)=>ipcRenderer.invoke('project-draft:repair',id),
    automate:(id:string)=>ipcRenderer.invoke('project-draft:automate',id),
    } satisfies import('../../../shared/projectBuild.js').ProjectDraftApi,
  collaboration: {
    projectAgent:(workspace:string,slot:'a'|'b'|'shared',readGrantId:string)=>ipcRenderer.invoke('collaboration:project-agent',workspace,slot,readGrantId),
    agentRevoke:(id:string)=>ipcRenderer.invoke('collaboration:agent-revoke',id),
    projectUse:(workspace:string,source:'a'|'b'|'shared'|'continuous',id:string,target:'a'|'b'|'shared'|'continuous')=>ipcRenderer.invoke('collaboration:project-use',workspace,source,id,target),
    providerAllowance:(provider:string)=>ipcRenderer.invoke('collaboration:provider-allowance',provider),
    projectRestore:(workspace:string,slot:'a'|'b'|'shared'|'continuous')=>ipcRenderer.invoke('collaboration:project-restore',workspace,slot),
    projectSelect: (workspace:string,slot:'a'|'b'|'shared'|'continuous',options?:{mode?:'add'|'replace';existingId?:string;source?:'a'|'b'|'shared'|'continuous'})=>ipcRenderer.invoke('collaboration:project-select',workspace,slot,options),
    projectRetain:(workspace:string,source:'a'|'b'|'shared'|'continuous',id:string,target:'a'|'b'|'shared'|'continuous',indexes:number[])=>ipcRenderer.invoke('collaboration:project-retain',workspace,source,id,target,indexes),
    projectRevoke: (id:string)=>ipcRenderer.invoke('collaboration:project-revoke',id),
    setup: () => ipcRenderer.invoke('collaboration:setup'),
    availability: () => ipcRenderer.invoke('collaboration:availability'),
    capability: () => ipcRenderer.invoke('collaboration:capability'),
    claudeStatus: () => ipcRenderer.invoke('collaboration:claude-status'),
    claudeSignIn: () => ipcRenderer.invoke('collaboration:claude-sign-in'),
    claudeCancelSignIn: () => ipcRenderer.invoke('collaboration:claude-cancel-sign-in'),
      chatgptStatus: () => ipcRenderer.invoke('collaboration:chatgpt-status'),
      codexStatus: () => ipcRenderer.invoke('collaboration:codex-status'),
      codexSignIn: (method?: 'browser' | 'device') => ipcRenderer.invoke('collaboration:codex-sign-in', method),
      codexCancelSignIn: () => ipcRenderer.invoke('collaboration:codex-cancel-sign-in'),
      codexOpenSignIn: () => ipcRenderer.invoke('collaboration:codex-open-sign-in'),
      codexDisconnect: () => ipcRenderer.invoke('collaboration:codex-disconnect'),
      codexTest: () => ipcRenderer.invoke('collaboration:codex-test'),
      chatgptTestModels: () => ipcRenderer.invoke('collaboration:chatgpt-test-models'),
      chatgptTest: (model: string) => ipcRenderer.invoke('collaboration:chatgpt-test', model),
      chatgptSignIn: () => ipcRenderer.invoke('collaboration:chatgpt-sign-in'),
      chatgptCancelSignIn: () => ipcRenderer.invoke('collaboration:chatgpt-cancel-sign-in'),
      chatgptDisconnect: () => ipcRenderer.invoke('collaboration:chatgpt-disconnect'),
  },
  dev: {
    codexDevLogsEnabled: /^(1|true|yes|on)$/i.test(process.env.YGG_CODEX_DEV_LOGS || ''),
  },
  auth: {
    onLoginError: (callback: (message: string) => void) => {
      const listener = (_event: unknown, message: string) => callback(message)
      ipcRenderer.on('auth:login-error', listener)
      return () => { ipcRenderer.removeListener('auth:login-error', listener) }
    },
    status: () => ipcRenderer.invoke('auth:status'),
    start: (provider: string, oob = false) => ipcRenderer.invoke('auth:start', provider, oob),
    code: (code: string) => ipcRenderer.invoke('auth:code', code),
    cancel: () => ipcRenderer.invoke('auth:cancel'),
    migrate: (values: unknown) => ipcRenderer.invoke('auth:migrate', values),
    check: () => ipcRenderer.invoke('auth:check'),
    onChanged: (callback: (state: any) => void) => {
      const listener = (_event: unknown, state: any) => callback(state)
      ipcRenderer.on('auth:changed', listener)
      void ipcRenderer.invoke('auth:subscribe').then(callback)
      return () => { ipcRenderer.removeListener('auth:changed', listener) }
    },
    login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
    logout: () => ipcRenderer.invoke('auth:logout'),

    openExternal: (url: string) => ipcRenderer.invoke('auth:openExternal', url),
    openOAuthWindow: (url: string) => ipcRenderer.invoke('auth:openOAuthWindow', url),
    onOAuthCallback: (callback: (url: string) => void) => {
      const listener = (_event: any, url: string) => callback(url)
      ipcRenderer.on('oauth:callback', listener)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('oauth:callback', listener)
      }
    },
  },
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
    clear: () => ipcRenderer.invoke('storage:clear'),
  },
  secrets: {
    consolidate: () => ipcRenderer.invoke('secrets:consolidate'),
    braveSearch: {
      get: () => ipcRenderer.invoke('secrets:braveSearch:get'),
      has: () => ipcRenderer.invoke('secrets:braveSearch:has'),
      set: (value: string) => ipcRenderer.invoke('secrets:braveSearch:set', value),
      delete: () => ipcRenderer.invoke('secrets:braveSearch:delete'),
    },
  },
  platformInfo: {
    get: () => ipcRenderer.invoke('platform:info'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    // Floating window controls
    openFloating: () => ipcRenderer.invoke('window:openFloating'),
    closeFloating: () => ipcRenderer.invoke('window:closeFloating'),
    toggleFloating: () => ipcRenderer.invoke('window:toggleFloating'),
    isFloatingOpen: () => ipcRenderer.invoke('window:isFloatingOpen'),
    // Compact mode controls
    toggleCompact: () => ipcRenderer.invoke('window:toggleCompact'),
    isCompact: () => ipcRenderer.invoke('window:isCompact'),
    getState: () => ipcRenderer.invoke('window:getState'),
    onStateChanged: (callback: (payload: { isMaximized: boolean; isFullScreen: boolean }) => void) => {
      const listener = (_event: any, payload: { isMaximized: boolean; isFullScreen: boolean }) => callback(payload)
      ipcRenderer.on('window:state-changed', listener)
      return () => ipcRenderer.removeListener('window:state-changed', listener)
    },
  },
  theme: {
    update: (themePreference: boolean | 'light' | 'dark' | 'system') =>
      ipcRenderer.invoke('theme:update', themePreference),
  },
  sync: {
    status: () => ipcRenderer.invoke('sync:status'),
  },
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },
  browser: {
    isGuestDevToolsEnabled: () => ipcRenderer.invoke('browser:isGuestDevToolsEnabled'),
    openGuestDevTools: (webContentsId: number) => ipcRenderer.invoke('browser:openGuestDevTools', webContentsId),
  },
  dialog: {
    openFile: (options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
      properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[]
    }) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }) => ipcRenderer.invoke('dialog:saveFile', options),
    selectFolder: (options?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke('dialog:selectFolder', options),
  },
  fs: {
    readFile: (filePath: string, encoding?: BufferEncoding) => ipcRenderer.invoke('fs:readFile', filePath, encoding),
    writeFile: (filePath: string, content: string, encoding?: BufferEncoding) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content, encoding),
    mkdir: (dirPath: string) => ipcRenderer.invoke('fs:mkdir', dirPath),
    stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
    readFileStream: (
      filePath: string,
      options?: {
        encoding?: BufferEncoding
        highWaterMark?: number
      }
    ) => ipcRenderer.invoke('fs:readFileStream', filePath, options),
    abortReadFileStream: (streamId: string) => ipcRenderer.invoke('fs:abortReadFileStream', streamId),
    onReadFileStreamChunk: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('fs:readFileStream:chunk', listener)
      return () => ipcRenderer.removeListener('fs:readFileStream:chunk', listener)
    },
    onReadFileStreamProgress: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('fs:readFileStream:progress', listener)
      return () => ipcRenderer.removeListener('fs:readFileStream:progress', listener)
    },
    onReadFileStreamEnd: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('fs:readFileStream:end', listener)
      return () => ipcRenderer.removeListener('fs:readFileStream:end', listener)
    },
    onReadFileStreamError: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('fs:readFileStream:error', listener)
      return () => ipcRenderer.removeListener('fs:readFileStream:error', listener)
    },
    onReadFileStreamAborted: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('fs:readFileStream:aborted', listener)
      return () => ipcRenderer.removeListener('fs:readFileStream:aborted', listener)
    },
  },
  logs: {
    appendClientError: (content: string) => ipcRenderer.invoke('logs:appendClientError', content),
    getClientErrorLogPath: () => ipcRenderer.invoke('logs:getClientErrorLogPath'),
  },
  exec: {
    run: (command: string, options?: { cwd?: string; timeout?: number }) =>
      ipcRenderer.invoke('shell:exec', command, options),
  },
  terminal: {
    create: (options?: { cwd?: string; cols?: number; rows?: number; title?: string }) =>
      ipcRenderer.invoke('terminal:create', options),
    write: (sessionId: string, data: string) => ipcRenderer.invoke('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke('terminal:kill', sessionId),
    onData: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },
  },
  http: {
    request: (options: {
      url: string
      method?: string
      headers?: Record<string, string>
      body?: string
      timeout?: number
    }) => ipcRenderer.invoke('http:request', options),
  },
  openaiChatGPT: {
    streamStart: (payload: any) => ipcRenderer.invoke('openai:chatgpt:stream-start', payload),
    streamAbort: (streamId: string) => ipcRenderer.invoke('openai:chatgpt:stream-abort', streamId),
    isAuthenticated: () => ipcRenderer.invoke('openai:chatgpt:isAuthenticated'),
    clearTokens: () => ipcRenderer.invoke('openai:chatgpt:clearTokens'),
    usage: () => ipcRenderer.invoke('openai:chatgpt:usage'),
    onStreamEvent: (callback: (payload: any) => void) => {
      const listener = (_event: any, payload: any) => callback(payload)
      ipcRenderer.on('openai:chatgpt:stream-event', listener)
      return () => ipcRenderer.removeListener('openai:chatgpt:stream-event', listener)
    },
  },
  titleBar: {
    setOverlay: (payload: { color?: string; symbolColor?: string; height?: number }) =>
      ipcRenderer.invoke('titlebar:set-overlay', payload),
  },
  customTool: {
    execute: (toolPath: string, args?: Record<string, any>) =>
      ipcRenderer.invoke('customTool:execute', toolPath, args),
    clearCache: (toolPath?: string) => ipcRenderer.invoke('customTool:clearCache', toolPath),
  },
  autoUpdater: {
    check: () => ipcRenderer.invoke('autoUpdater:check'),
    installNow: () => ipcRenderer.invoke('autoUpdater:installNow'),
    onChecking: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('autoUpdater:checking', listener)
      return () => ipcRenderer.removeListener('autoUpdater:checking', listener)
    },
    onUpdateAvailable: (callback: (info: any) => void) => {
      const listener = (_event: any, info: any) => callback(info)
      ipcRenderer.on('autoUpdater:update-available', listener)
      return () => ipcRenderer.removeListener('autoUpdater:update-available', listener)
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
      const listener = (_event: any, info: any) => callback(info)
      ipcRenderer.on('autoUpdater:update-not-available', listener)
      return () => ipcRenderer.removeListener('autoUpdater:update-not-available', listener)
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
      const listener = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('autoUpdater:download-progress', listener)
      return () => ipcRenderer.removeListener('autoUpdater:download-progress', listener)
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      const listener = (_event: any, info: any) => callback(info)
      ipcRenderer.on('autoUpdater:update-downloaded', listener)
      return () => ipcRenderer.removeListener('autoUpdater:update-downloaded', listener)
    },
    onError: (callback: (error: string) => void) => {
      const listener = (_event: any, error: string) => callback(error)
      ipcRenderer.on('autoUpdater:error', listener)
      return () => ipcRenderer.removeListener('autoUpdater:error', listener)
    },
  },
  platform: process.platform,
})

// Log that preload script has loaded
console.log('[Electron Preload] Script loaded, electronAPI exposed')
