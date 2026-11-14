/// <reference types="vite/client" />

// Build-time constants defined in vite.config.ts
declare const __BUILD_TARGET__: 'web' | 'electron' | 'local' | 'standalone'
declare const __IS_ELECTRON__: boolean
declare const __IS_WEB__: boolean
declare const __IS_LOCAL__: boolean
declare const __YGG_CODEX_DEV_LOGS__: boolean

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_ENVIRONMENT?: 'web' | 'local' | 'electron' | 'standalone'
  readonly VITE_YGG_SERVER_ORIGIN?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron API types (available when running in Electron)
interface ElectronAPI {
  completionAlerts:{notify(input:import('../../../shared/hadronCompletion').CompletionAlert,mode:'ping'|'voice'):Promise<boolean>;ping():Promise<void>;onOpen(callback:(input:{projectId:string;chatId:string})=>void):()=>void}
  chatArchive:{export:()=>Promise<{cancelled:boolean;projects?:number;chats?:number;messages?:number;alreadyImported?:boolean}>;import:()=>Promise<{cancelled:boolean;projects?:number;chats?:number;messages?:number;alreadyImported?:boolean}>}
  workspaceArchive:{
    copyNew(input:import('../server/hadronTools/workspaceArchive').NewSelectionDestination):Promise<ReturnType<import('../server/hadronTools/workspaceArchive').WorkspaceArchive['copyToNew']>>
    load(id:string):Promise<import('../server/hadronTools/workspaceArchive').ArchivedChat|null>
    save(chat:import('./features/collaboration/unifiedWorkspace').WorkspaceChat,revision:number):Promise<import('../server/hadronTools/workspaceArchive').ArchivedChat>
    copy(input:Parameters<import('../server/hadronTools/workspaceArchive').WorkspaceArchive['copy']>[1]):Promise<ReturnType<import('../server/hadronTools/workspaceArchive').WorkspaceArchive['copy']>>
    trash(id:string,ids:string[],revision:number,excerpts?:import('../server/hadronTools/workspaceArchive').MessageExcerpts):Promise<ReturnType<import('../server/hadronTools/workspaceArchive').WorkspaceArchive['trash']>>
    note(id:string,ids:string[],text:string,revision:number):Promise<import('../server/hadronTools/workspaceArchive').ArchivedChat>
  }
  recycleBin:{list:()=>Promise<import('../server/hadronTools/recycleBin').RecycleEntry[]>;restore:(kind:'project'|'conversation'|'branch',id:string)=>Promise<void>}
  projectDraft: import('../../../shared/projectBuild').ProjectDraftApi
  contextCopy:{list:(workspace:string)=>Promise<Array<{id:string;mode:string;label:string}>>;copy:(input:import('../server/hadronTools/contextCopy').ContextCopyInput)=>Promise<{conversationId:string;projectId:string;characters:number}>;copyMany:(input:import('../server/hadronTools/contextCopy').ContextCopyBatchInput)=>Promise<{projectId:string;conversations:Array<{conversationId:string;characters:number}>}>}
  helpers:{list:(workspace:string)=>Promise<Array<{id:string;job:string;role:string;parentRun:string;provider:string;model:string;task:string;state:string;runId:string|null;result:string|null}>>;preference:(enabled?:boolean)=>Promise<boolean>}
  hadronSetup:()=>Promise<import('../../../shared/hadronSetup').HadronSetupReport>
  continuousChat: import('../../../shared/continuousChat').ContinuousChatApi
  collaboration: {
    projectAgent:(workspace:string,slot:'a'|'b'|'shared',readGrantId:string)=>Promise<{id:string;label:string}>
    agentRevoke:(id:string)=>Promise<void>
    providerAllowance:(provider:string)=>Promise<import('../server/hadronTools/providerAllowance').ProviderAllowance|null>
    projectRestore:(workspace:string,slot:'a'|'b'|'shared'|'continuous')=>Promise<{id:string;label:string}|null>
    projectSelect:(workspace:string,slot:'a'|'b'|'shared'|'continuous')=>Promise<{id:string;label:string}|null>
    projectUse:(workspace:string,source:'a'|'b'|'shared'|'continuous',id:string,target:'a'|'b'|'shared'|'continuous')=>Promise<{id:string;label:string}>
    projectRevoke:(id:string)=>Promise<void>
    setup: () => Promise<{ schemaVersion: 1; liveEnabled: boolean; ownerAvailable: boolean; provider: { id: 'openaichatgpt'; connected: boolean; models: Array<{ id: string; label: string }> } }>
    availability: () => Promise<{ liveEnabled: boolean; previewEnabled: boolean }>
    capability: () => Promise<string>
    claudeStatus: () => Promise<import('../../../shared/claudeSubscription').ClaudeRuntimeStatus>
    claudeSignIn: () => Promise<{ started: boolean }>
    claudeCancelSignIn: () => Promise<{ cancelled: boolean }>
      chatgptStatus: () => Promise<import('../server/auth/hadronChatgptConnection').HadronChatgptStatus>
      codexStatus: () => Promise<import('../server/auth/hadronCodexTypes').HadronCodexStatus>
      codexSignIn: (method?: 'browser' | 'device') => Promise<{ started: boolean }>
      codexCancelSignIn: () => Promise<{ cancelled: boolean }>
      codexOpenSignIn: () => Promise<void>
      codexDisconnect: () => Promise<{ disconnected: boolean }>
      codexTest: () => Promise<{ text: string }>
      chatgptTestModels: () => Promise<Array<{ id: string; label: string }>>
      chatgptTest: (model: string) => Promise<{ model: string; text: string }>
      chatgptSignIn: () => Promise<{ started: boolean }>
      chatgptCancelSignIn: () => Promise<{ cancelled: boolean }>
      chatgptDisconnect: () => Promise<{ disconnected: boolean }>
  }
  auth: {
    onLoginError: (callback: (message: string) => void) => () => void
    status: () => Promise<any>
    start: (provider: string, oob?: boolean) => Promise<{ url: string }>
    code: (code: string) => Promise<any>
    cancel: () => Promise<void>
    migrate: (values: unknown) => Promise<any>
    check: () => Promise<any>
    onChanged: (callback: (state: any) => void) => () => void
    login: (credentials: any) => Promise<any>
    logout: () => Promise<void>
    openExternal: (url: string) => Promise<{ success: boolean; error?: string }>
    openOAuthWindow: (url: string) => Promise<{ success: boolean; error?: string }>
    onOAuthCallback: (callback: (url: string) => void) => () => void
  }
  storage: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<{ success: boolean; error?: string }>
    clear: () => Promise<{ success: boolean; error?: string }>
  }
  secrets: {
    consolidate: () => Promise<{ success: boolean; migrated?: number; removed?: number; complete?: boolean; warnings?: string[]; error?: string }>
    braveSearch: {
      get: () => Promise<{ success: boolean; value: string | null; error?: string }>
      has: () => Promise<{ success: boolean; configured: boolean; error?: string }>
      set: (value: string) => Promise<{ success: boolean; error?: string }>
      delete: () => Promise<{ success: boolean; error?: string }>
    }
  }
  platformInfo: {
    get: () => Promise<{ platform: string; version: string; isElectron: boolean }>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
    openFloating: () => Promise<{ success: boolean; error?: string }>
    closeFloating: () => Promise<{ success: boolean; error?: string }>
    toggleFloating: () => Promise<{ success: boolean; error?: string; isOpen: boolean }>
    isFloatingOpen: () => Promise<boolean>
    toggleCompact: () => Promise<{ success: boolean; error?: string; compact: boolean }>
    isCompact: () => Promise<boolean>
    getState: () => Promise<{ isMaximized: boolean; isFullScreen: boolean }>
    onStateChanged: (callback: (payload: { isMaximized: boolean; isFullScreen: boolean }) => void) => () => void
  }
  theme: {
    update: (themePreference: boolean | 'light' | 'dark' | 'system') => Promise<void>
  }
  sync: {
    status: () => Promise<{
      localServerRunning: boolean
      localServerPort: number | null
      localServerUrl: string | null
      localServerLanUrl?: string | null
      localServerError?: string | null
    }>
  }
  shell: {
    openPath: (path: string) => Promise<{ success: boolean; error?: string }>
  }
  browser: {
    isGuestDevToolsEnabled: () => Promise<boolean>
    openGuestDevTools: (webContentsId: number) => Promise<{ success: boolean; error?: string }>
  }
  logs: {
    appendClientError: (content: string) => Promise<{ success: boolean; error?: string; filePath?: string }>
    getClientErrorLogPath: () => Promise<{ success: boolean; error?: string; filePath?: string }>
  }
  terminal: {
    create: (options?: {
      cwd?: string
      cols?: number
      rows?: number
      title?: string
    }) => Promise<{ success: boolean; sessionId?: string; cwd?: string; shell?: string; cols?: number; rows?: number; title?: string; error?: string }>
    write: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>
    resize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>
    kill: (sessionId: string) => Promise<{ success: boolean; error?: string }>
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => () => void
    onExit: (callback: (payload: { sessionId: string; exitCode: number | null; signal?: number; cwd?: string; shell?: string }) => void) => () => void
  }
  dialog: {
    openFile: (options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
      properties?: ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[]
    }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; filePaths?: string[]; error?: string }>
    saveFile: (options?: {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>
    selectFolder: (options?: { title?: string; defaultPath?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
  }
  fs: {
    readFile: (filePath: string, encoding?: BufferEncoding) => Promise<{ success: boolean; content?: string; error?: string } | string>
    writeFile: (filePath: string, content: string, encoding?: BufferEncoding) => Promise<{ success: boolean; error?: string }>
  }
  openaiChatGPT: {
    streamStart: (payload: any) => Promise<{ success: boolean; streamId?: string; error?: string }>
    streamAbort: (streamId: string) => Promise<{ success: boolean; error?: string }>
    isAuthenticated: () => Promise<boolean>
    clearTokens: () => Promise<{ success: boolean; error?: string }>
    usage: () => Promise<any>
    onStreamEvent: (callback: (payload: { streamId: string; chunk: any }) => void) => () => void
  }
  autoUpdater: {
    check: () => Promise<{ success: boolean; error?: string }>
    installNow: () => Promise<{ success: boolean; error?: string }>
    onChecking: (callback: () => void) => () => void
    onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void
    onUpdateNotAvailable: (callback: (info: any) => void) => () => void
    onDownloadProgress: (
      callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void
    ) => () => void
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  customTool: {
    execute: (
      toolPath: string,
      args?: Record<string, any>
    ) => Promise<{ success: boolean; result?: any; error?: string }>
    clearCache: (toolPath?: string) => Promise<{ success: boolean; cleared?: number; error?: string }>
  }
  dev?: {
    codexDevLogsEnabled?: boolean
  }
  platform: string
}

interface Window {
  electronAPI?: ElectronAPI
}


declare namespace JSX {
  interface IntrinsicElements {
    webview: any
  }
}
