; Probe only the executable being replaced. Do not enumerate/terminate processes,
; launch PowerShell/tasklist, or touch another Hadron installation/profile.
!macro customCheckAppRunning
  Push $R8
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ClearErrors
    ; Append access does not truncate or write bytes. Windows refuses write
    ; access to a mapped executable or a file held without write sharing.
    FileOpen $R8 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" a
    ${If} ${Errors}
      Pop $R8
      MessageBox MB_OK|MB_ICONEXCLAMATION "Hadron's program files are in use or the selected folder is not writable. Close this copy of Hadron, then run setup again. Your chats are saved separately." /SD IDOK
      SetErrorLevel 32
      Quit
    ${Else}
      FileClose $R8
    ${EndIf}
  ${EndIf}
  Pop $R8
!macroend

; A personal workspace installs for the current Windows user by default.
; Do not adopt a stale machine-wide installation during a normal setup.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; Silent setup skips the install-mode page. Apply the same default before
; electron-builder considers elevating an old machine-wide registration.
!macro customInit
  Push $R8
  Push $R9
  ${GetParameters} $R8
  ClearErrors
  ${GetOptions} $R8 "/allusers" $R9
  ${If} ${Errors}
    StrCpy $hasPerMachineInstallation "0"
    StrCpy $hasPerUserInstallation "1"
    !insertmacro setInstallModePerUser
  ${EndIf}
  Pop $R9
  Pop $R8
!macroend
