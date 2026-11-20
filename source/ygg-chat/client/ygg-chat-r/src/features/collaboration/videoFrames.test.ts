import { expect, it, vi } from 'vitest'
import { videoFrameTimes, videoTimeLabel } from './videoFrames'

it('spreads frames evenly, at most one every 2 seconds and never past the end', () => {
  expect(videoFrameTimes(3)).toEqual([0.75, 2.25])
  const long = videoFrameTimes(600)
  expect(long).toHaveLength(12)
  expect(long[0]).toBe(25); expect(long.at(-1)).toBe(575)
  expect(videoFrameTimes(0.5)).toEqual([0.25])
  expect(videoFrameTimes(Number.NaN)).toEqual([0])
  expect(videoFrameTimes(600, 3)).toHaveLength(3)
})

it('labels frame times as minutes and seconds, with hours when needed', () => {
  expect(videoTimeLabel(5.9)).toBe('0:05'); expect(videoTimeLabel(125)).toBe('2:05'); expect(videoTimeLabel(3725)).toBe('1:02:05')
})

it('turns an attached video into labelled picture attachments within the attachment limit', async () => {
  vi.resetModules()
  vi.doMock('./videoFrames', async original => ({ ...(await original<typeof import('./videoFrames')>()), videoFrames: vi.fn(async (_file: File, max: number) => Array.from({ length: Math.min(max, 12) }, (_, index) => ({ time: index * 10, dataUrl: 'frame' }))) }))
  vi.doMock('../../../../../shared/hadronImages', async original => ({ ...(await original<typeof import('../../../../../shared/hadronImages')>()), parseHadronImages: (images: any[]) => images }))
  const { readSharedFiles } = await import('./attachments')
  const existing = Array.from({ length: 15 }, (_, index) => ({ id: String(index), name: `${index}.txt`, text: 'a' }))
  const result = await readSharedFiles([new File(['v'], 'clip.mp4')], existing)
  expect(result).toHaveLength(20)
  expect(result.at(-1)!.name).toBe('clip.mp4 · frame at 0:40')
  await expect(readSharedFiles([new File([new Uint8Array(1)], 'big.mov')].map(file => Object.defineProperty(file, 'size', { value: 600 * 1024 * 1024 })))).rejects.toThrow('500 MiB')
  vi.doUnmock('./videoFrames'); vi.doUnmock('../../../../../shared/hadronImages')
})
