import { HADRON_IMAGE_MAX_DATA_URL_LENGTH } from '../../../../../shared/hadronImages'

/** Videos are sent as still frames: the AI cannot watch video or hear its sound. */
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v'])
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024
export const VIDEO_MAX_FRAMES = 12
const FRAME_MAX_SIDE = 1280, LOAD_TIMEOUT_MS = 30000, SEEK_TIMEOUT_MS = 15000

/** Evenly spaced frame times, at most one every 2 seconds, each taken from the middle of its segment. */
export function videoFrameTimes(duration: number, max = VIDEO_MAX_FRAMES): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [0]
  const count = Math.max(1, Math.min(max, Math.ceil(duration / 2)))
  return Array.from({ length: count }, (_, index) => Math.min(Math.max(0, duration - 0.05), duration * (index + 0.5) / count))
}

export function videoTimeLabel(seconds: number): string {
  const whole = Math.floor(seconds), hours = Math.floor(whole / 3600), minutes = Math.floor(whole / 60) % 60, rest = whole % 60
  return (hours ? `${hours}:${String(minutes).padStart(2, '0')}` : String(minutes)) + ':' + String(rest).padStart(2, '0')
}

function waitFor(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked', timeoutMs: number, failure: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (error?: Error) => { clearTimeout(timer); video.removeEventListener(event, ok); video.removeEventListener('error', bad); error ? reject(error) : resolve() }
    const ok = () => done(), bad = () => done(new Error(failure))
    const timer = setTimeout(() => done(new Error(failure)), timeoutMs)
    video.addEventListener(event, ok, { once: true }); video.addEventListener('error', bad, { once: true })
  })
}

/** Decode locally and capture JPEG frames; the video itself is never uploaded or stored. */
export async function videoFrames(file: File, maxFrames = VIDEO_MAX_FRAMES): Promise<Array<{ time: number; dataUrl: string }>> {
  const url = URL.createObjectURL(file), video = document.createElement('video')
  video.muted = true; video.preload = 'auto'; video.playsInline = true
  const unreadable = 'This video could not be opened. Try an MP4 (H.264) or WebM file.'
  try {
    const loaded = waitFor(video, 'loadedmetadata', LOAD_TIMEOUT_MS, unreadable)
    video.src = url
    await loaded
    if (!video.videoWidth || !video.videoHeight) throw new Error(unreadable)
    const scale = Math.min(1, FRAME_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight)), canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d'); if (!context) throw new Error('Video frames cannot be prepared on this computer.')
    const frames: Array<{ time: number; dataUrl: string }> = []
    for (const time of videoFrameTimes(video.duration, Math.max(1, maxFrames))) {
      const seeked = waitFor(video, 'seeked', SEEK_TIMEOUT_MS, 'A video frame could not be read.')
      video.currentTime = time
      await seeked
      context.fillStyle = '#000000'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      let dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      for (const quality of [0.65, 0.5, 0.35]) { if (dataUrl.length <= HADRON_IMAGE_MAX_DATA_URL_LENGTH) break; dataUrl = canvas.toDataURL('image/jpeg', quality) }
      if (dataUrl.length > HADRON_IMAGE_MAX_DATA_URL_LENGTH) throw new Error('A video frame is too large to prepare.')
      frames.push({ time, dataUrl })
    }
    return frames
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url)
  }
}
