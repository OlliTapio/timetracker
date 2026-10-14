/**
 * @file What is on screen right now, via the Win32 API (koffi FFI, no compiler needed).
 * Reads window titles and process names, never content. See docs/adr/0002.
 */
import { basename } from 'node:path'
import koffi from 'koffi'
import type { Snapshot } from '../domain/types.ts'
import { Cell } from './cell.ts'

export type Sampler = () => Snapshot

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const GA_ROOT = 2

const bind = () => {
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  koffi.struct('POINT', { x: 'long', y: 'long' })
  koffi.struct('LASTINPUTINFO', { cbSize: 'uint32', dwTime: 'uint32' })
  return {
    foreground: user32.func('void *GetForegroundWindow()'),
    cursorPos: user32.func('bool GetCursorPos(_Out_ POINT *pt)'),
    windowAt: user32.func('void *WindowFromPoint(POINT pt)'),
    ancestor: user32.func('void *GetAncestor(void *hwnd, uint32_t flags)'),
    titleLength: user32.func('int GetWindowTextLengthW(void *hwnd)'),
    title: user32.func('int GetWindowTextW(void *hwnd, char16_t *buf, int max)'),
    processId: user32.func('uint32_t GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *pid)'),
    lastInput: user32.func('bool GetLastInputInfo(_Inout_ LASTINPUTINFO *info)'),
    open: kernel32.func('void *OpenProcess(uint32_t access, bool inherit, uint32_t pid)'),
    imageName: kernel32.func(
      'bool QueryFullProcessImageNameW(void *h, uint32_t flags, char16_t *buf, _Inout_ uint32_t *size)',
    ),
    close: kernel32.func('bool CloseHandle(void *h)'),
    ticks: kernel32.func('uint32_t GetTickCount()'),
  }
}

type Win32 = ReturnType<typeof bind>

/** koffi registers struct names globally, so a second bind would throw "Duplicate type name". */
const bound = new Cell<Win32 | null>(null)

const win32 = (): Win32 => {
  const existing = bound.get()
  if (existing !== null) return existing
  const fresh = bind()
  bound.swap(fresh)
  return fresh
}

const titleOf = (w: Win32, hwnd: unknown): string => {
  const length = Number(w.titleLength(hwnd))
  const buf = Buffer.alloc((length + 1) * 2)
  const copied = Number(w.title(hwnd, buf, length + 1))
  return buf.toString('utf16le', 0, copied * 2)
}

const processOf = (w: Win32, hwnd: unknown): string => {
  const pid = [0]
  w.processId(hwnd, pid)
  const handle: unknown = w.open(PROCESS_QUERY_LIMITED_INFORMATION, false, pid[0])
  if (handle === null) return ''
  try {
    const size = [1024]
    const buf = Buffer.alloc(2048)
    const found = w.imageName(handle, 0, buf, size) === true
    return found ? basename(buf.toString('utf16le', 0, Number(size[0]) * 2)) : ''
  } finally {
    w.close(handle)
  }
}

const idleSeconds = (w: Win32): number => {
  const info = { cbSize: 8, dwTime: 0 }
  // Without this, dwTime 0 would make every block look idle since boot.
  if (w.lastInput(info) !== true)
    throw new Error('GetLastInputInfo failed, so idle time is unknown. Check the koffi binding.')
  return ((Number(w.ticks()) - info.dwTime) >>> 0) / 1000
}

const describe = (w: Win32, hwnd: unknown): readonly [string, string] =>
  hwnd === null ? ['', ''] : [processOf(w, hwnd), titleOf(w, hwnd)]

/** Throws off Windows; the rest of the tracker runs anywhere. */
export const windowsSampler = (): Sampler => {
  if (process.platform !== 'win32')
    throw new Error('Sampling needs Windows (it reads Win32 windows).')
  const w = win32()
  return () => {
    const point = { x: 0, y: 0 }
    w.cursorPos(point)
    const under: unknown = w.ancestor(w.windowAt(point), GA_ROOT)
    const [fgProcess, fgTitle] = describe(w, w.foreground())
    const [cursorProcess, cursorTitle] = describe(w, under)
    return { fgProcess, fgTitle, cursorProcess, cursorTitle, idleS: idleSeconds(w) }
  }
}
