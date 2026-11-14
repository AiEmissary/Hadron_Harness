import React, { useEffect, useRef, useState } from 'react'
import { Button } from '../index'
import { HadronAppearance } from './HadronAppearance'
import { getThemeModeColor, saveCustomChatTheme, setCustomChatThemeEnabled, useCustomChatTheme, useHtmlDarkMode } from '../ThemeManager/themeConfig'
import { AppFontSettings, applyAppFontSettings, clearStoredLocalFont, DEFAULT_GOOGLE_FONT_FAMILY, DEFAULT_GOOGLE_FONT_URL, FONT_SETTINGS_CHANGE_EVENT, hasStoredLocalFont, isSupportedLocalFontFile, loadAppFontSettings, MAX_FONT_UPLOAD_SIZE_BYTES, saveAppFontSettings, saveUploadedLocalFont, validateGoogleFontUrl } from '../../helpers/fontSettingsStorage'
import { BackgroundColorSettings, BackgroundMode, DEFAULT_BACKGROUND_COLORS, CustomVideoEntry, addCustomVideo, clearCustomVideoLibrary, loadActiveCustomVideoId, loadBackgroundColors, loadBackgroundMode, loadSavedVideos, persistActiveCustomVideoId, persistBackgroundColors, persistBackgroundMode, removeCustomVideo, updateCustomVideoTextColorMode, VIDEO_BACKGROUND_CHANGE_EVENT } from '../../helpers/videoBackgroundStorage'

const settingsSectionClass = 'rounded-2xl border bg-white/70 p-5 dark:bg-neutral-900'
const settingsInputClass = 'rounded-lg border bg-transparent px-3 py-2'
const LOCAL_FONT_ACCEPT = '.woff2,.ttf,.otf'
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024
const formatSize = (size?: number | null) => !size ? 'n/a' : size < 1024 ? `${size} bytes` : size < 1024*1024 ? `${(size/1024).toFixed(1)} KB` : `${(size/1024/1024).toFixed(1)} MB`
function SettingsSection({title, description, children, style}: {title:string; description:React.ReactNode; features?:string[]; children:React.ReactNode; style?:React.CSSProperties}) {
  return <section data-settings-section={title} className='mt-4 space-y-3 rounded-xl border p-4' style={style}><h3 className='font-semibold'>{title}</h3><p className='text-sm'>{description}</p>{children}</section>
}
export function HadronAppearanceSettings() {
  const { theme: customTheme, enabled: customThemeEnabled } = useCustomChatTheme()
  const isDarkMode = useHtmlDarkMode()
  const settingsSolidColorSectionBackground = customThemeEnabled ? getThemeModeColor(customTheme.colors.settingsSolidColorSectionBg, isDarkMode) : undefined
  const fileInputRef = useRef<HTMLInputElement | null>(null), fontFileInputRef = useRef<HTMLInputElement | null>(null)
  const [fontUploading, setFontUploading] = useState(false)
  const [fontSettings, setFontSettings] = useState<AppFontSettings>(loadAppFontSettings)
  const [googleFontUrlInput, setGoogleFontUrlInput] = useState(() => loadAppFontSettings().googleFontUrl ?? '')
  const [hasLocalFontSaved, setHasLocalFontSaved] = useState(false)
  const [videos, setVideos] = useState<CustomVideoEntry[]>(loadSavedVideos)
  const [activeVideoId, setActiveVideoId] = useState(loadActiveCustomVideoId)
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(loadBackgroundMode)
  const [backgroundColors, setBackgroundColors] = useState<BackgroundColorSettings>(loadBackgroundColors)
  const effectiveBackgroundColors = customThemeEnabled ? customTheme.colors.appBackgroundColor : backgroundColors
  const [uploading, setUploading] = useState(false)
  const [status, showStatus] = useState<{type:string;text:string}|null>(null)
  useEffect(() => {
    let mounted = true
    void hasStoredLocalFont().then(value => { if(mounted) setHasLocalFontSaved(value) }).catch(() => { if(mounted) showStatus({type:'error',text:'Stored local font could not be checked.'}) })
    const font = () => {setFontSettings(loadAppFontSettings());setGoogleFontUrlInput(loadAppFontSettings().googleFontUrl ?? '')}
    const background = () => {setVideos(loadSavedVideos());setActiveVideoId(loadActiveCustomVideoId());setBackgroundMode(loadBackgroundMode());setBackgroundColors(loadBackgroundColors())}
    window.addEventListener(FONT_SETTINGS_CHANGE_EVENT,font);window.addEventListener(VIDEO_BACKGROUND_CHANGE_EVENT,background)
    return () => {mounted=false;window.removeEventListener(FONT_SETTINGS_CHANGE_EVENT,font);window.removeEventListener(VIDEO_BACKGROUND_CHANGE_EVENT,background)}
  }, [])
  const guard = async (action: () => Promise<void>) => {try{await action()}catch{showStatus({type:'error',text:'The appearance change could not be saved. Your other settings are unchanged.'})}}
  const persistAndApplyFontSettings = async (nextSettings: AppFontSettings) => {
    const saved = saveAppFontSettings(nextSettings)
    setFontSettings(saved)
    await applyAppFontSettings(saved)
  }

  const handleGoogleFontUrlApply = async () => {
    const validation = validateGoogleFontUrl(googleFontUrlInput)
    if (!validation.valid || !validation.normalizedUrl || !validation.family) {
      showStatus({ type: 'error', text: validation.error ?? 'Invalid Google Font URL.' })
      return
    }

    await persistAndApplyFontSettings({
      ...fontSettings,
      source: 'google',
      googleFontUrl: validation.normalizedUrl,
      googleFontFamily: validation.family,
    })

    showStatus({ type: 'success', text: `Google Font "${validation.family}" applied.` })
  }

  const handleResetAppFont = async () => {
    await persistAndApplyFontSettings({
      ...fontSettings,
      source: 'google',
      googleFontUrl: DEFAULT_GOOGLE_FONT_URL,
      googleFontFamily: DEFAULT_GOOGLE_FONT_FAMILY,
    })
    showStatus({ type: 'success', text: `App font reset to ${DEFAULT_GOOGLE_FONT_FAMILY}.` })
  }

  const handleLocalFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!isSupportedLocalFontFile(file)) {
      showStatus({ type: 'error', text: 'Only .woff2, .ttf, or .otf files are supported.' })
      if (fontFileInputRef.current) {
        fontFileInputRef.current.value = ''
      }
      return
    }

    if (file.size > MAX_FONT_UPLOAD_SIZE_BYTES) {
      showStatus({
        type: 'error',
        text: `Font file must be under ${formatSize(MAX_FONT_UPLOAD_SIZE_BYTES)}.`,
      })
      if (fontFileInputRef.current) {
        fontFileInputRef.current.value = ''
      }
      return
    }

    setFontUploading(true)

    try {
      await saveUploadedLocalFont(file)
      setHasLocalFontSaved(true)

      await persistAndApplyFontSettings({
        ...fontSettings,
        source: 'local',
      })

      showStatus({ type: 'success', text: `Local font "${file.name}" uploaded and applied.` })
    } catch (error) {
      console.error('Failed to upload local font:', error)
      showStatus({ type: 'error', text: 'Unable to load this font. Choose a valid .woff2, .ttf or .otf file; the previous font is retained.' })
    } finally {
      setFontUploading(false)
      if (fontFileInputRef.current) {
        fontFileInputRef.current.value = ''
      }
    }
  }

  const handleUseLocalFont = async () => {
    if (!hasLocalFontSaved) {
      showStatus({ type: 'error', text: 'Upload a local font first.' })
      return
    }

    await persistAndApplyFontSettings({
      ...fontSettings,
      source: 'local',
    })

    showStatus({ type: 'success', text: 'Local font applied.' })
  }

  const handleRemoveLocalFont = async () => {
    try {
      await clearStoredLocalFont()
      setHasLocalFontSaved(false)

      const nextSettings: AppFontSettings = {
        ...fontSettings,
        source: fontSettings.source === 'local' ? 'google' : fontSettings.source,
        googleFontUrl: fontSettings.source === 'local' ? DEFAULT_GOOGLE_FONT_URL : fontSettings.googleFontUrl,
        googleFontFamily: fontSettings.source === 'local' ? DEFAULT_GOOGLE_FONT_FAMILY : fontSettings.googleFontFamily,
      }

      await persistAndApplyFontSettings(nextSettings)
      showStatus({ type: 'success', text: 'Stored local font removed.' })
    } catch (error) {
      console.error('Failed to remove local font:', error)
      showStatus({ type: 'error', text: 'Failed to remove local font.' })
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!['video/mp4', 'video/webm'].includes(file.type)) {
      showStatus({ type: 'error', text: 'Video must be in MP4 or WebM format.' })
      return
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      showStatus({ type: 'error', text: 'Video must be smaller than 8MB.' })
      return
    }

    setUploading(true)

    try {
      const entry = await addCustomVideo({
        mimeType: file.type,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        blob: file,
      })

      persistActiveCustomVideoId(entry.id)
      persistBackgroundMode('video')
      setBackgroundMode('video')
      setVideos(loadSavedVideos())
      setActiveVideoId(entry.id)
      showStatus({ type: 'success', text: 'Custom video saved and activated.' })
    } catch (error) {
      console.error(error)
      showStatus({ type: 'error', text: 'Unable to save the custom video. Try again.' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectVideo = (id: string) => {
    persistActiveCustomVideoId(id)
    persistBackgroundMode('video')
    setActiveVideoId(id)
    setBackgroundMode('video')
    showStatus({ type: 'success', text: 'Active background updated.' })
  }

  const handleRemoveVideo = async (id: string) => {
    await removeCustomVideo(id)
    setVideos(loadSavedVideos())
    if (activeVideoId === id) {
      setActiveVideoId(null)
    }
    showStatus({ type: 'info', text: 'Video removed from gallery.' })
  }

  const handleClearGallery = async () => {
    await clearCustomVideoLibrary()
    setVideos([])
    setActiveVideoId(null)
    showStatus({ type: 'success', text: 'Gallery cleared. Using the default app background.' })
  }

  const handleResetToDefault = () => {
    persistActiveCustomVideoId(null)
    persistBackgroundMode('color', DEFAULT_BACKGROUND_COLORS)
    setBackgroundColors({...DEFAULT_BACKGROUND_COLORS})
    if(customThemeEnabled)saveCustomChatTheme({...customTheme,colors:{...customTheme.colors,appBackgroundColor:{...DEFAULT_BACKGROUND_COLORS}}})
    setActiveVideoId(null)
    setBackgroundMode('color')
    showStatus({ type: 'success', text: 'Reverted to the default app background.' })
  }

  const handleTextColorModeChange = (id: string, mode: 'light' | 'dark' | 'auto') => {
    updateCustomVideoTextColorMode(id, mode)
    setVideos(loadSavedVideos())
    showStatus({ type: 'success', text: `Text color mode set to "${mode}".` })
  }

  const handleBackgroundModeChange = (mode: BackgroundMode) => {
    persistBackgroundMode(mode, backgroundColors)
    setBackgroundMode(mode)
    showStatus({
      type: 'success',
      text: mode === 'color' ? 'Solid color background enabled.' : 'Video wallpaper enabled.',
    })
  }

  const handleBackgroundColorChange = (variant: 'light' | 'dark', value: string) => {
    if (customThemeEnabled) {
      const nextTheme = {
        ...customTheme,
        colors: {
          ...customTheme.colors,
          appBackgroundColor: {
            ...customTheme.colors.appBackgroundColor,
            [variant]: value,
          },
        },
      }
      saveCustomChatTheme(nextTheme)
      setCustomChatThemeEnabled(true)
      return
    }

    const nextColors = { ...backgroundColors, [variant]: value }
    persistBackgroundColors(nextColors)
    setBackgroundColors(loadBackgroundColors())
  }

  return <>
    {status && <p role={status.type==='error'?'alert':'status'} className='rounded-xl border p-3 text-sm'>{status.text}</p>}
        <section aria-label='Appearance' data-settings-appearance className={settingsSectionClass}>
          <h2 className='text-2xl font-semibold'>Appearance</h2>
          <p className='my-3 text-sm'>All colour, text, font and background options are here. Colour and text choices save automatically; font controls show when to apply a change.</p>
          <HadronAppearance />
          <details className='mt-5 rounded-xl border p-4'>
            <summary className='cursor-pointer font-semibold'>Fonts and typography</summary>
        <SettingsSection
          title='Typography'
          description='Set app font from a Google Fonts URL or a local font file.'
          features={['Google Fonts URL', 'Local font upload', 'Use local font', 'Reset app font']}
        >
          <div className='flex flex-col gap-5'>
            <div className='flex flex-col gap-2'>
              <p className='text-base font-medium text-stone-900 dark:text-stone-100'>Google Fonts URL</p>
              <p className='text-sm text-stone-500 dark:text-stone-400'>
                Only <code>https://fonts.googleapis.com/css</code> and <code>/css2</code> links are accepted.
              </p>
              <input
                type='url'
                value={googleFontUrlInput}
                onChange={event => setGoogleFontUrlInput(event.target.value)}
                placeholder={DEFAULT_GOOGLE_FONT_URL}
                className={`w-full ${settingsInputClass}`}
              />
              <div className='flex flex-wrap items-center gap-2'>
                <Button variant='primary' size='small' onClick={() => void guard(handleGoogleFontUrlApply)}>
                  Apply Google Font
                </Button>
                <Button variant='outline2' size='small' onClick={() => void guard(handleResetAppFont)}>
                  Reset to {DEFAULT_GOOGLE_FONT_FAMILY}
                </Button>
              </div>
            </div>

            <div className='pt-3 pt-2 flex flex-col gap-2'>
              <input
                ref={fontFileInputRef}
                type='file'
                accept={LOCAL_FONT_ACCEPT}
                className='hidden'
                onChange={handleLocalFontUpload}
              />
              <p className='text-base font-medium text-stone-900 dark:text-stone-100'>Local Font Upload</p>
              <p className='text-sm text-stone-500 dark:text-stone-400'>
                Upload <code>.woff2</code>, <code>.ttf</code>, or <code>.otf</code> (max{' '}
                {formatSize(MAX_FONT_UPLOAD_SIZE_BYTES)}).
              </p>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  variant='acrylic'
                  size='small'
                  onClick={() => fontFileInputRef.current?.click()}
                  disabled={fontUploading}
                >
                  {fontUploading ? 'Uploading…' : 'Upload Local Font'}
                </Button>
                <Button variant='outline2' size='small' onClick={() => void guard(handleUseLocalFont)} disabled={!hasLocalFontSaved}>
                  Use Local Font
                </Button>
                <Button variant='outline2' size='small' onClick={() => void guard(handleRemoveLocalFont)} disabled={!hasLocalFontSaved}>
                  Remove Local Font
                </Button>
              </div>
              <p className='text-xs text-stone-500 dark:text-stone-400'>
                Active source:{' '}
                <span className='font-mono'>
                  {fontSettings.source === 'google'
                    ? `google (${fontSettings.googleFontFamily ?? 'unknown'})`
                    : fontSettings.source}
                </span>
              </p>
            </div>
          </div>
        </SettingsSection>


          </details>
          <details className='mt-5 rounded-xl border p-4'>
            <summary className='cursor-pointer font-semibold'>Backgrounds and wallpapers</summary>
            <p className='my-3 text-sm'>These change the backdrop behind the workspace. Opaque panels cover most of it. The Text buttons on each saved video control text over that wallpaper; use Workspace text colour above for the conversation panels.</p>
        <SettingsSection
          title='Upload a video wallpaper'
          description='Drag in an MP4 or WebM and keep it ready for motion wallpapers.'
          features={['MP4/WebM upload', '8MB limit', 'Wallpaper gallery']}
        >
          <div className='flex flex-col gap-4 lg:flex-row lg:items-center'>
            <div className='flex-1 space-y-1 py-2'>
              <p className='text-sm mb-4 text-stone-500 dark:text-stone-200'>
                Accepted formats: MP4, WebM · Max size 8MB.
              </p>
              <div className='rounded-[1.75rem] bg-white/45 p-4 text-sm text-stone-500 dark:bg-zinc-800/60 dark:text-stone-200'>
                <p>Uploaded wallpapers appear below. You can switch between them at any time.</p>
              </div>
            </div>

            <div className='flex gap-3 lg:pt-8'>
              <input
                ref={fileInputRef}
                type='file'
                accept='video/mp4,video/webm'
                className='hidden'
                onChange={handleFileChange}
              />
              <Button
                variant='outline2'
                size='large'
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className='group'
              >
                <p className='transition-transform duration-100 group-active:scale-95'>
                  {uploading ? 'Processing…' : 'Browse for video'}
                </p>
              </Button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title='Backdrop colours'
          description='Pick colors for light and dark themes.'
          features={['Video/solid mode', 'Light color', 'Dark color', 'Transparent option']}
          style={{ backgroundColor: customThemeEnabled ? settingsSolidColorSectionBackground : undefined }}
        >
          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              variant={backgroundMode === 'video' ? 'primary' : 'outline2'}
              size='small'
              onClick={() => handleBackgroundModeChange('video')}
              className='group'
            >
              <p className='transition-transform duration-100 group-active:scale-95'>Video wallpaper</p>
            </Button>
            <Button
              variant={backgroundMode === 'color' ? 'primary' : 'outline2'}
              size='small'
              onClick={() => handleBackgroundModeChange('color')}
              className='group'
            >
              <p className='transition-transform duration-100 group-active:scale-95'>Solid colors</p>
            </Button>
          </div>
          <div className='mt-5 grid gap-4 md:grid-cols-2'>
            {(['light', 'dark'] as const).map(mode => {
              const label = mode === 'light' ? 'Light mode color' : 'Dark mode color'
              const description =
                mode === 'light'
                  ? 'Used when the interface is in light theme.'
                  : 'Used when the interface is in dark theme.'
              const colorValue = effectiveBackgroundColors[mode]
              const isTransparentColor = colorValue.trim().toLowerCase() === 'transparent'
              const colorPickerValue = isTransparentColor ? (mode === 'light' ? '#ffffff' : '#111625') : colorValue
              return (
                <div
                  key={mode}
                  className='rounded-[1.75rem] bg-white/45 p-4 transition dark:bg-zinc-900/70'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-base font-semibold text-stone-900 dark:text-stone-100'>{label}</p>
                      <p className='text-xs text-stone-500 dark:text-stone-400'>{description}</p>
                    </div>
                    <span
                      className='h-10 w-10 rounded-full border border-stone-200 dark:border-stone-600'
                      style={{
                        backgroundColor: colorValue,
                        backgroundImage: isTransparentColor
                          ? 'linear-gradient(45deg, rgba(120,120,120,0.18) 25%, transparent 25%, transparent 75%, rgba(120,120,120,0.18) 75%, rgba(120,120,120,0.18)), linear-gradient(45deg, rgba(120,120,120,0.18) 25%, transparent 25%, transparent 75%, rgba(120,120,120,0.18) 75%, rgba(120,120,120,0.18))'
                          : 'none',
                        backgroundPosition: isTransparentColor ? '0 0, 6px 6px' : undefined,
                        backgroundSize: isTransparentColor ? '12px 12px' : undefined,
                      }}
                      aria-hidden='true'
                    ></span>
                  </div>
                  <div className='mt-4 flex flex-wrap items-center gap-3'>
                    <input
                      type='color'
                      value={colorPickerValue}
                      onChange={event => handleBackgroundColorChange(mode, event.target.value)}
                      aria-label={`${label} picker`}
                      className='h-10 w-10 rounded-full border border-stone-200 bg-white p-0 dark:border-stone-600'
                    />
                    <Button
                      variant={isTransparentColor ? 'primary' : 'outline2'}
                      size='small'
                      onClick={() => handleBackgroundColorChange(mode, 'transparent')}
                      className='group'
                    >
                      <p className='transition-transform duration-100 group-active:scale-95'>Transparent</p>
                    </Button>
                    <p className='text-xs font-mono text-stone-500 dark:text-stone-300'>{colorValue}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className='mt-4 text-xs text-stone-500 dark:text-stone-400'>
            {customThemeEnabled
              ? 'Custom theme background colors add a soft gradient tint over the default app backdrop. Set a color to transparent to remove its tint. Video wallpapers are unchanged.'
              : 'Solid colors automatically switch with the theme, and you can still set either theme to transparent if you want. When you’re ready for motion, switch back to video wallpapers.'}
          </p>
        </SettingsSection>

        <SettingsSection
          title='Saved video wallpapers'
          description='Select or delete any saved clip.'
          features={['Wallpaper selection', 'Video text colour', 'Reset default', 'Clear gallery']}
        >
          <div className='flex flex-wrap justify-end gap-2'>
            <Button variant='outline2' size='small' onClick={handleResetToDefault} className='group'>
              <p className='transition-transform duration-100 group-active:scale-95'>Reset to Default</p>
            </Button>
            <Button variant='outline2' size='small' onClick={() => void guard(handleClearGallery)} className='group'>
              <p className='transition-transform duration-100 group-active:scale-95'>Clear Gallery</p>
            </Button>
          </div>

          <div className='mt-5 grid gap-4 md:grid-cols-2'>
            {videos.length === 0 ? (
              <div className='col-span-full rounded-[1.75rem] border border-dashed border-stone-200 bg-stone-50/80 p-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-zinc-900/60 dark:text-stone-400'>
                No saved wallpapers yet. Upload a video to get started.
              </div>
            ) : (
              videos.map(video => {
                const isActive = video.id === activeVideoId
                return (
                  <div
                    key={video.id}
                    className={`flex flex-col gap-3 rounded-[1.75rem] p-4 transition ${
                      isActive
                        ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-500/60 dark:bg-emerald-900/40'
                        : 'border-stone-200 bg-stone-50/70 hover:border-indigo-400 dark:hover:bg-neutral-700/40 dark:border-stone-700 dark:bg-zinc-900/70 dark:hover:border-sky-600'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-base font-semibold text-stone-900 dark:text-stone-100'>
                          {video.name || 'Uploaded wallpaper'}
                        </p>
                        <p className='text-xs text-stone-500 dark:text-stone-400'>
                          {video.mimeType} · {formatSize(video.size)}
                        </p>
                        <p className='text-xs text-stone-400 dark:text-stone-500'>
                          Added {new Date(video.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {isActive && (
                        <span className='rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-200'>
                          Active
                        </span>
                      )}
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Button
                        variant={isActive ? 'primary' : 'outline2'}
                        size='small'
                        onClick={() => handleSelectVideo(video.id)}
                        className='group'
                      >
                        <p className='transition-transform duration-100 group-active:scale-95'>
                          {isActive ? 'Selected' : 'Use this wallpaper'}
                        </p>
                      </Button>
                      <Button
                        variant='outline2'
                        size='small'
                        onClick={() => void guard(() => handleRemoveVideo(video.id))}
                        className='group'
                      >
                        <p className='transition-transform duration-100 group-active:scale-95'>Remove</p>
                      </Button>
                      <div className='ml-auto flex items-center gap-1'>
                        <span className='text-xs text-stone-500 dark:text-stone-400 mr-1'>Text:</span>
                        {(['auto', 'light', 'dark'] as const).map(mode => {
                          const currentMode = video.textColorMode ?? 'auto'
                          const isSelected = currentMode === mode
                          return (
                            <button
                              key={mode}
                              onClick={() => handleTextColorModeChange(video.id, mode)}
                              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                                isSelected
                                  ? 'bg-indigo-500 text-white dark:bg-indigo-600'
                                  : 'bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-zinc-700 dark:text-stone-300 dark:hover:bg-zinc-600'
                              }`}
                              title={
                                mode === 'auto'
                                  ? 'Follow system theme'
                                  : mode === 'light'
                                    ? 'Light text (for dark videos)'
                                    : 'Dark text (for light videos)'
                              }
                            >
                              {mode === 'auto' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </SettingsSection>

          </details>
        </section>

  </>
}
