export interface Settings {
  focus: number; shortBreak: number; longBreak: number; rounds: number
  autoBreak: boolean; autoFocus: boolean; theme: string; sound: string; volume: number
  tips: boolean; notifications: boolean; closeToTray: boolean; startHidden: boolean
  trayTime: boolean; alwaysOnTop: boolean
}
export interface Timer {
  phase: string; remaining: number; total: number; completed: number; running: boolean; revision: number
}
export interface Snapshot { settings: Settings; timer: Timer }
export const defaults: Settings = {
  focus: 25, shortBreak: 5, longBreak: 15, rounds: 4, autoBreak: true, autoFocus: false,
  theme: 'sand', sound: 'bowl', volume: .4, tips: true, notifications: true,
  closeToTray: true, startHidden: false, trayTime: true, alwaysOnTop: false,
}
export const initial: Snapshot = { settings: defaults, timer: {
  phase: 'focus', remaining: 1500, total: 1500, completed: 0, running: false, revision: 0,
} }
export const phaseNames: Record<string, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' }
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
