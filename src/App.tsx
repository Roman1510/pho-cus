import { useEffect, useState } from 'react'

function App() {
  const presets = [1, 5, 10, 15, 20, 30]
  const initialSeconds = 5 * 60
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('5')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('5')
  const [customSeconds, setCustomSeconds] = useState('0')

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const interval = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (seconds === 0) {
      setIsRunning(false)
    }
  }, [seconds])

  const handlePreset = (value: number) => {
    setSelectedPreset(String(value))
    setIsRunning(false)
    setSeconds(value * 60)
  }

  const handleCustomApply = () => {
    const minutes = Number(customMinutes) || 0
    const secondsVal = Number(customSeconds) || 0
    const total = Math.max(1, minutes * 60 + Math.min(59, secondsVal))
    setSeconds(total)
    setSelectedPreset('custom')
    setIsRunning(false)
    setShowCustomModal(false)
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0b1220',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Main card */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateRows: '1fr auto',
          padding: 0,
          borderRadius: 0,
          background: '#0b1220',
          boxShadow: 'none',
          border: 'none',
        }}
      >
        {/* Timer display */}
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            gap: 16,
            padding: '48px 32px 32px',
          }}
        >
          <div
            style={{
              fontSize: 100,
              fontWeight: 900,
              letterSpacing: '-0.06em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {minutes}:{remainingSeconds.toString().padStart(2, '0')}
          </div>
          <div
            style={{ color: '#94a3b8', fontSize: 14, letterSpacing: '0.05em' }}
          >
            {isRunning ? 'Running' : 'Paused'}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gap: 16, padding: '0 32px 48px' }}>
          {/* Preset buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {presets.map((value) => {
              const active = selectedPreset === String(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handlePreset(value)}
                  style={{
                    padding: '12px 0',
                    borderRadius: 12,
                    border: active ? '1px solid #22c55e' : '1px solid #334155',
                    background: active
                      ? 'rgba(34, 197, 94, 0.1)'
                      : 'transparent',
                    color: active ? '#22c55e' : '#cbd5e1',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 200ms ease',
                  }}
                >
                  {value}m
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              style={{
                padding: '12px 0',
                borderRadius: 12,
                border:
                  selectedPreset === 'custom'
                    ? '1px solid #60a5fa'
                    : '1px solid #334155',
                background:
                  selectedPreset === 'custom'
                    ? 'rgba(96, 165, 250, 0.1)'
                    : 'transparent',
                color: selectedPreset === 'custom' ? '#60a5fa' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
            >
              Custom
            </button>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setIsRunning(true)}
              disabled={isRunning || seconds === 0}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: '#22c55e',
                color: '#0f172a',
                fontWeight: 700,
                cursor: isRunning || seconds === 0 ? 'not-allowed' : 'pointer',
                opacity: isRunning || seconds === 0 ? 0.5 : 1,
                transition: 'all 200ms ease',
              }}
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => setIsRunning(false)}
              disabled={!isRunning}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 700,
                cursor: !isRunning ? 'not-allowed' : 'pointer',
                opacity: !isRunning ? 0.5 : 1,
                transition: 'all 200ms ease',
              }}
            >
              Stop
            </button>
            <button
              type="button"
              onClick={() => {
                setSeconds(initialSeconds)
                setIsRunning(false)
                setSelectedPreset('5')
              }}
              style={{
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: '#475569',
                color: '#f8fafc',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Custom modal */}
      {showCustomModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 50,
          }}
          onClick={() => setShowCustomModal(false)}
        >
          <div
            style={{
              width: 380,
              padding: 28,
              borderRadius: 20,
              background:
                'linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.85))',
              boxShadow: '0 40px 160px rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              display: 'grid',
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                Custom time
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cbd5e1',
                  }}
                >
                  Minutes
                </span>
                <input
                  type="number"
                  min="0"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    outline: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#cbd5e1',
                  }}
                >
                  Seconds
                </span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#f8fafc',
                    outline: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{
                  padding: '12px 0',
                  borderRadius: 10,
                  border: '1px solid #334155',
                  background: 'transparent',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomApply}
                style={{
                  padding: '12px 0',
                  borderRadius: 10,
                  border: 'none',
                  background: '#60a5fa',
                  color: '#0f172a',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
