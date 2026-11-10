'use client'

/**
 * Web Audio API Mechanical Switch Synthesizer & Haptic Feedback Engine
 * Ported directly from ctrlspc_ui_kit_app.tsx (KeycapSoundEngine)
 */
class KeycapSoundEngine {
  private ctx: AudioContext | null = null
  public volume = 0.65
  public profile: 'none' | 'thocky' | 'clicky' | 'clacky' | 'creamy' | 'poppy' | 'silent' | 'bell' | 'brush' | 'woosh' = 'thocky'

  private isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('studyup_sound_enabled')
    // Default on
    return saved === null ? true : saved === 'true'
  }

  public isHapticEnabled(): boolean {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('studyup_haptic_enabled')
    return saved === null ? true : saved === 'true'
  }

  public setSoundEnabled(enabled: boolean) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('studyup_sound_enabled', String(enabled))
    }
  }

  public setHapticEnabled(enabled: boolean) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('studyup_haptic_enabled', String(enabled))
    }
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) this.ctx = new AudioCtx()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  public triggerHaptic(ms = 10) {
    if (!this.isHapticEnabled()) return
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms)
      }
    } catch {
      // Ignore vibration errors
    }
  }

  /**
   * Brushing / gentle card and drawer woosh sound effect
   * Soft, air friction sliding texture clamped strictly to 50% volume (0.5).
   * Generates sound in-module via Web Audio API without requiring external MP3/WAV assets.
   */
  public playBrush(customVol = 0.5) {
    this.triggerHaptic(5)
    if (!this.isSoundEnabled()) return
    try {
      this.init()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const duration = 0.17 // Gentle, crisp brushing friction duration

      // 1. Air / friction noise buffer
      const bufferSize = Math.floor(this.ctx.sampleRate * duration)
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        // Soft windowing (tapered at start and end)
        const envelope = Math.sin(t * Math.PI)
        output[i] = (Math.random() * 2 - 1) * envelope
      }

      const noiseSource = this.ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer

      // 2. Bandpass filter: sweeps smoothly to mimic cloth / card sliding air
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(680, now)
      filter.frequency.exponentialRampToValueAtTime(1180, now + 0.06)
      filter.frequency.exponentialRampToValueAtTime(460, now + duration)
      filter.Q.setValueAtTime(1.15, now)

      // 3. Master Gain strictly clamped to 50% volume (0.5)
      const targetGain = Math.min(0.5, Math.max(0.1, customVol))
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      // 4. Subtle subtle whisper body (warmth without boomy low-end)
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(90, now + duration)

      const oscGain = this.ctx.createGain()
      oscGain.gain.setValueAtTime(0.001, now)
      oscGain.gain.linearRampToValueAtTime(targetGain * 0.1, now + 0.015)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(oscGain)
      oscGain.connect(this.ctx.destination)

      noiseSource.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(now)
      osc.stop(now + duration)
      noiseSource.start(now)
      noiseSource.stop(now + duration)
    } catch {
      // Ignore audio context error
    }
  }

  public playWoosh(customVol = 0.5) {
    this.playBrush(customVol)
  }

  public play(
    customProfile: 'none' | 'thocky' | 'clicky' | 'clacky' | 'creamy' | 'poppy' | 'silent' | 'bell' | 'brush' | 'woosh' | null = null,
    pitchOffset = 0
  ) {
    const activeProfile = customProfile || this.profile
    if (activeProfile === 'brush' || activeProfile === 'woosh') {
      this.playBrush(0.5)
      return
    }

    this.triggerHaptic(8)
    if (!this.isSoundEnabled()) return
    if (activeProfile === 'none' || this.volume <= 0) return

    try {
      this.init()
      if (!this.ctx) return

      const now = this.ctx.currentTime
      const gain = this.ctx.createGain()
      gain.connect(this.ctx.destination)

      const osc = this.ctx.createOscillator()
      const filter = this.ctx.createBiquadFilter()

      let baseFreq = 150
      let duration = 0.065
      let oscType: OscillatorType = 'triangle'

      if (activeProfile === 'thocky') {
        baseFreq = 135 + pitchOffset
        duration = 0.075
        oscType = 'sine'
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(380, now)
      } else if (activeProfile === 'clicky') {
        baseFreq = 880 + pitchOffset
        duration = 0.045
        oscType = 'square'
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(1600, now)
      } else if (activeProfile === 'clacky') {
        baseFreq = 390 + pitchOffset
        duration = 0.055
        oscType = 'triangle'
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(950, now)
      } else if (activeProfile === 'creamy') {
        baseFreq = 205 + pitchOffset
        duration = 0.07
        oscType = 'sine'
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(520, now)
      } else if (activeProfile === 'poppy') {
        baseFreq = 310 + pitchOffset
        duration = 0.05
        oscType = 'sine'
        filter.type = 'peaking'
        filter.frequency.setValueAtTime(700, now)
      } else if (activeProfile === 'silent') {
        baseFreq = 85 + pitchOffset
        duration = 0.035
        oscType = 'sine'
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(180, now)
      } else if (activeProfile === 'bell') {
        baseFreq = 660
        duration = 0.35
        oscType = 'sine'
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(2200, now)
      }

      osc.type = oscType
      osc.frequency.setValueAtTime(baseFreq * 1.4, now)
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq * 0.45), now + duration)

      const peakGain = Math.min(1, this.volume * (activeProfile === 'silent' ? 0.25 : 0.55))
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(filter)
      filter.connect(gain)
      osc.start(now)
      osc.stop(now + duration)

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.018)
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const output = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35))
      }
      const whiteNoise = this.ctx.createBufferSource()
      whiteNoise.buffer = noiseBuffer

      const noiseFilter = this.ctx.createBiquadFilter()
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.setValueAtTime(activeProfile === 'thocky' ? 450 : 1400, now)

      const noiseGain = this.ctx.createGain()
      noiseGain.gain.setValueAtTime(peakGain * 0.6, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.018)

      whiteNoise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.ctx.destination)
      whiteNoise.start(now)
    } catch {
      // Ignore audio autoplay restrictions prior to gesture
    }
  }
}

export const soundEngine = new KeycapSoundEngine()
