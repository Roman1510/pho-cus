let context: AudioContext | undefined
let noise: AudioBufferSourceNode | undefined
let noiseGain: GainNode | undefined
export async function unlockAudio() {
  context ??= new AudioContext()
  if (context.state === 'suspended') await context.resume()
  return context
}
export async function chime(sound: string, volume: number) {
  if (sound === 'none' || volume === 0) return
  const ctx = await unlockAudio()
  const base = sound === 'bell' ? 660 : 220
  ;[1, 2.01, 3.02].forEach((ratio, i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain()
    oscillator.frequency.value = base * ratio
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume * .22 / (i + 1), ctx.currentTime + .02)
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + 3.5)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(); oscillator.stop(ctx.currentTime + 4)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  })
}
export async function ambient(kind: string, volume: number) {
  noise?.stop(); noise?.disconnect(); noiseGain?.disconnect(); noise = undefined
  if (kind === 'off') return
  const ctx = await unlockAudio()
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate)
  const samples = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < samples.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + .02 * white) / 1.02
    samples[i] = kind === 'brown' ? last * 3.5 : white * .16
  }
  noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true
  noiseGain = ctx.createGain(); noiseGain.gain.value = volume
  noise.connect(noiseGain).connect(ctx.destination); noise.start()
}
export function ambientVolume(volume: number) {
  if (noiseGain && context) noiseGain.gain.setTargetAtTime(volume, context.currentTime, .08)
}
