import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ambient, ambientVolume, chime, unlockAudio } from './audio'
import { defaults, formatTime, initial, phaseNames } from './model'
import type { Settings, Snapshot } from './model'
import './App.css'

const desktop = isTauri()
function App() {
  const [state, setState] = useState<Snapshot>(initial)
  const [ready, setReady] = useState(!desktop)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState<'settings' | 'audio' | null>(null)
  const [tab, setTab] = useState('Sessions')
  const [editing, setEditing] = useState(false)
  const [minutes, setMinutes] = useState('25')
  const [draft, setDraft] = useState<Settings>(defaults)
  const [saving, setSaving] = useState(false)
  const [soundscape, setSoundscape] = useState('off')
  const [ambientLevel, setAmbientLevel] = useState(.35)
  const [duringBreaks, setDuringBreaks] = useState(true)
  const dialog = useRef<HTMLDialogElement>(null)
  const current = useRef(state)
  const seenRevision = useRef<number | null>(null)
  const previewDeadline = useRef(0)
  const { settings, timer } = state
  const report = useCallback((e: unknown) => setError(String(e)), [])
  const accept = useCallback((next: Snapshot) => {
    current.current = next
    setState(next)
    if (seenRevision.current !== null && next.timer.revision > seenRevision.current) {
      void chime(next.settings.sound, next.settings.volume).catch(report)
    }
    seenRevision.current = next.timer.revision
  }, [report])
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      try {
        if (desktop) {
          const next = await invoke<Snapshot>('get_state')
          if (alive) { accept(next); setReady(true) }
        } else {
          const next = structuredClone(current.current)
          if (next.timer.running) {
            next.timer.remaining = Math.max(0, Math.ceil((previewDeadline.current - Date.now()) / 1000))
            if (!next.timer.remaining) {
              if (next.timer.phase === 'focus') { next.timer.completed++; next.timer.phase = next.timer.completed % next.settings.rounds === 0 ? 'long' : 'short' }
              else next.timer.phase = 'focus'
              next.timer.total = (next.timer.phase === 'focus' ? next.settings.focus : next.timer.phase === 'short' ? next.settings.shortBreak : next.settings.longBreak) * 60
              next.timer.remaining = next.timer.total
              next.timer.running = next.timer.phase === 'focus' ? next.settings.autoFocus : next.settings.autoBreak
              next.timer.revision++
              previewDeadline.current = Date.now() + next.timer.total * 1000
            }
            if (alive) accept(next)
          }
        }
      } catch (e) { if (alive) report(e) }
    }
    void refresh()
    const interval = setInterval(() => void refresh(), 500)
    return () => { alive = false; clearInterval(interval) }
  }, [accept, report])
  useEffect(() => {
    if (!desktop) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void listen('open-settings', () => { setDraft(current.current.settings); setPanel('settings') })
      .then(fn => { if (disposed) fn(); else unlisten = fn }).catch(report)
    return () => { disposed = true; unlisten?.() }
  }, [report])
  useEffect(() => {
    if (panel || editing) dialog.current?.showModal()
    else dialog.current?.close()
  }, [panel, editing])
  useEffect(() => {
    const audible = duringBreaks || timer.phase === 'focus'
    ambientVolume(audible ? ambientLevel : 0)
  }, [duringBreaks, timer.phase, ambientLevel])
  const handleAction = useCallback(async (action: string, value?: number) => {
    try {
      void unlockAudio().catch(report)
      if (desktop) accept(await invoke<Snapshot>('timer_action', { action, value: value ?? null }))
      else {
        const next = structuredClone(current.current), t = next.timer, s = next.settings
        if (action === 'toggle') { t.running = !t.running; previewDeadline.current = Date.now() + t.remaining * 1000 }
        else if (action === 'reset') { t.running = false; t.remaining = t.total }
        else if (action === 'duration') { t.running = false; t.remaining = t.total = value! * 60 }
        else {
          t.phase = action === 'skip' ? (t.phase === 'focus' ? 'short' : 'focus') : action
          t.running = false
          t.remaining = t.total = (t.phase === 'focus' ? s.focus : t.phase === 'short' ? s.shortBreak : s.longBreak) * 60
        }
        accept(next)
      }
    } catch (e) { report(e) }
  }, [accept, report])
  const close = () => { setPanel(null); setEditing(false) }
  const save = async () => {
    setSaving(true)
    try {
      if (desktop) accept(await invoke<Snapshot>('save_settings', { settings: draft }))
      else accept({ ...current.current, settings: draft })
      close()
    } catch (e) { report(e) } finally { setSaving(false) }
  }
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft(prev => ({ ...prev, [key]: value }))
  const toggle = (key: keyof Settings, label: string, hint?: string) => <label className="setting-row">
    <span>{label}{hint && <small>{hint}</small>}</span><input type="checkbox" checked={Boolean(draft[key])} onChange={e => change(key, e.target.checked)} />
  </label>
  return <div className="app" data-theme={settings.theme}>
    <header><div className="brand"><span className="brand-mark">◷</span> pho-cus</div><button className="icon-button" aria-label="Open settings" onClick={() => { setDraft(settings); setPanel('settings') }}>⚙</button></header>
    {!desktop && <p className="preview-note">Browser preview · tray and notifications are available in the desktop app</p>}
    <main>
      <nav className="phase-tabs" aria-label="Session type">{Object.entries(phaseNames).map(([key, name]) => <button key={key} aria-pressed={timer.phase === key} onClick={() => void handleAction(key)} disabled={!ready}>{name}</button>)}</nav>
      <div className="timer-orbit" style={{ '--progress': `${360 * (1 - timer.remaining / timer.total)}deg` } as React.CSSProperties}>
        <div className="timer-inner"><span className="eyebrow">{timer.running ? 'A little space to ' + (timer.phase === 'focus' ? 'focus' : 'breathe') : 'At your own pace'}</span>
          <button className="time" disabled={!ready} aria-label={`Timer ${formatTime(timer.remaining)}. Adjust duration`} onClick={() => { setMinutes(String(Math.ceil(timer.total / 60))); setEditing(true) }}>{formatTime(timer.remaining)}</button>
          <span className="timer-hint">{timer.running ? 'One moment at a time' : 'Click the time to adjust'}</span>
        </div>
      </div>
      <div className="presets" aria-label="Quick durations">{(timer.phase === 'focus' ? [15, 25, 50] : [5, 10, 15]).map(n => <button key={n} disabled={!ready} aria-pressed={timer.total === n * 60} onClick={() => void handleAction('duration', n)}>{n} min</button>)}</div>
      <div className="actions"><button className="quiet" disabled={!ready} onClick={() => void handleAction('reset')}>↺ <span>Reset</span></button><button className="primary" disabled={!ready} onClick={() => void handleAction('toggle')}>{timer.running ? 'Ⅱ Pause' : '▷ Start ' + (timer.phase === 'focus' ? 'focus' : 'break')}</button><button className="quiet" disabled={!ready} onClick={() => void handleAction('skip')}><span>Skip</span> →</button></div>
      <div className="rounds" aria-label={`${timer.completed} focus sessions completed`}>
        {Array.from({ length: settings.rounds }, (_, i) => <span key={i} className={i < timer.completed % settings.rounds ? 'filled' : ''} />)}
        <p>{timer.completed === 0 ? 'A fresh start. Make it yours.' : `${timer.completed} focus ${timer.completed === 1 ? 'session' : 'sessions'} completed`}</p>
      </div>
      {timer.phase !== 'focus' && settings.tips && <p className="tip">Let your shoulders drop. Stretch gently.<br />Give your eyes a moment in the distance.</p>}
    </main>
    <footer><button className="ambient-button" onClick={() => setPanel('audio')}><span>≋</span> {soundscape === 'off' ? 'Set the atmosphere' : soundscape === 'brown' ? 'Soft brown noise' : 'Gentle white noise'} <span>⌃</span></button><span className="footer-note">Less noise. More presence.</span></footer>
    {error && <div role="alert" className="error">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    <dialog ref={dialog} onCancel={close} onClick={e => { if (e.target === dialog.current) close() }}>
      <div className="dialog-content"><div className="dialog-header"><div><span className="eyebrow">MAKE YOURSELF AT HOME</span><h1>{editing ? 'Your next moment' : panel === 'audio' ? 'A softer background' : 'Settings'}</h1></div><button className="icon-button" onClick={close} aria-label="Close dialog">×</button></div>
      {editing ? <form onSubmit={e => { e.preventDefault(); const n = Number(minutes); if (Number.isInteger(n) && n >= 1 && n <= 180) { void handleAction('duration', n); close() } }}><label className="duration-input">Duration in minutes<input autoFocus required type="number" min="1" max="180" step="1" value={minutes} onChange={e => setMinutes(e.target.value)} /></label><p className="helper">Applying a duration pauses and resets this session.</p><button className="primary wide" type="submit">Set duration</button></form>
      : panel === 'audio' ? <div className="audio-panel"><p className="helper">Simple, synthesized soundscapes. No account, no connection, no interruptions.</p>{[['off', 'Quiet', 'Just you and your focus.'], ['brown', 'Brown noise', 'Low, soft, and enveloping.'], ['white', 'White noise', 'A light, even hush.']].map(([key, title, detail]) => <button key={key} className="sound-card" aria-pressed={soundscape === key} onClick={() => { void ambient(key, duringBreaks || timer.phase === 'focus' ? ambientLevel : 0).then(() => setSoundscape(key)).catch(report) }}><span>{title}<small>{detail}</small></span><span>{soundscape === key ? '●' : '○'}</span></button>)}<label className="setting-row">Ambient volume<input aria-label="Ambient volume" type="range" min="0" max="1" step=".01" value={ambientLevel} onChange={e => setAmbientLevel(Number(e.target.value))} /></label><label className="setting-row">Continue during breaks<input type="checkbox" checked={duringBreaks} onChange={e => setDuringBreaks(e.target.checked)} /></label></div>
      : <form onSubmit={e => { e.preventDefault(); void save() }}><nav className="settings-tabs" aria-label="Settings sections">{['Sessions', 'Appearance', 'Sounds', 'Desktop'].map(name => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</nav><div className="settings-body">
        {tab === 'Sessions' && <><div className="duration-grid">{([['focus', 'Focus'], ['shortBreak', 'Short break'], ['longBreak', 'Long break']] as const).map(([key, label]) => <label key={key}>{label}<input required type="number" min="1" max="180" value={draft[key]} onChange={e => change(key, Number(e.target.value))} /><small>minutes</small></label>)}</div><label className="setting-row">Long break every<input aria-label="Sessions before long break" required type="number" min="1" max="12" value={draft.rounds} onChange={e => change('rounds', Number(e.target.value))} /><span>sessions</span></label>{toggle('autoBreak', 'Start breaks automatically')}{toggle('autoFocus', 'Start focus automatically')}{toggle('tips', 'Gentle break reminders', 'A little encouragement to stretch and rest your eyes.')}</>}
        {tab === 'Appearance' && <><p className="helper">Choose a space that feels like you.</p><div className="theme-grid">{['sand', 'light', 'forest', 'dark'].map(theme => <button type="button" key={theme} className="theme-card" aria-pressed={draft.theme === theme} onClick={() => change('theme', theme)}><span className={`swatch ${theme}`}>Aa</span>{theme}</button>)}</div></>}
        {tab === 'Sounds' && <>{toggle('notifications', 'Desktop notifications', 'Delivery also depends on your system notification settings.')}<label className="setting-row">Session chime<select value={draft.sound} onChange={e => change('sound', e.target.value)}><option value="bowl">Singing bowl</option><option value="bell">Soft bell</option><option value="none">Silent</option></select></label><label className="setting-row">Chime volume<input aria-label="Chime volume" type="range" min="0" max="1" step=".01" value={draft.volume} onChange={e => change('volume', Number(e.target.value))} /></label><button type="button" className="secondary" onClick={() => void chime(draft.sound, draft.volume).catch(report)}>♫ Preview chime</button></>}
        {tab === 'Desktop' && <><p className="helper">Find pho-cus in the Mac menu bar or Windows system tray. Start, pause, reset, or skip without opening the window.</p>{toggle('closeToTray', 'Keep running when the window closes', 'Use Quit pho-cus in the tray menu to exit completely.')}{toggle('startHidden', 'Open in the tray', 'Next launch starts with the main window hidden.')}{toggle('trayTime', 'Show time in the Mac menu bar', 'Windows shows the remaining time in the tray tooltip and menu.')}{toggle('alwaysOnTop', 'Keep the window on top')}{!desktop && <p className="helper">Desktop options take effect in the installed app.</p>}</>}
      </div><div className="dialog-footer"><span>{desktop ? 'Saved on this device' : 'Preview only · not saved'}</span><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form>}
      </div>
    </dialog>
  </div>
}
export default App
