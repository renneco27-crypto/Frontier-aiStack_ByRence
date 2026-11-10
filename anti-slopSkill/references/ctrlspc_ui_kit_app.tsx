import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Plus, Check, ChevronDown, ChevronLeft, ChevronRight,
  Volume2, VolumeX, Flame, Bell, Clock, Sparkles, Play, Pause,
  RotateCcw, Copy, Code2, Eye, Layers, Sliders, Image as ImageIcon,
  Smartphone, Sun, Moon, X, Share2, Pin, Palette, Trash2, Info,
  Calendar, MapPin, Music, Mic, Bold, PenTool, Tag, MoreHorizontal,
  Gamepad2, Keyboard, Archive, Trophy, Zap, CheckCircle2, AlertCircle,
  ArrowUpRight, Filter, RefreshCw, Download, Heart, Star
} from 'lucide-react';

// ============================================================================
// 1. DESIGN TOKENS & CHARACTER / SWITCH DATA
// ============================================================================
const COLORS = {
  creamBg: '#F4F3EE',
  creamSecondary: '#EAE8E0',
  cardLight: '#FFFFFF',
  charcoal: '#1C1C1E',
  charcoalElevated: '#262629',
  coral: '#C84B44',
  coralHover: '#B33E38',
  mint: '#7CE0D3',
  sakura: '#F3A8BC',
  fuji: '#8ECAE6',
  koi: '#F4A261',
  silo: '#F2C94C',
  melon: '#7BD389',
  sumi: '#9B82F3',
  poppy: '#E76F51',
};

const CHARACTERS = [
  { id: 'sakura', name: 'SAKURA', label: 'Sakura', color: '#F3A8BC', lip: '#C97A90', text: '#3D1E26', mood: 'happy', set: 'Kubo set' },
  { id: 'fuji', name: 'FUJI', label: 'Fuji', color: '#8ECAE6', lip: '#5B9AB8', text: '#163240', mood: 'chill', set: 'Kubo set' },
  { id: 'koi', name: 'KOI', label: 'Koi', color: '#F4A261', lip: '#C47638', text: '#3B200B', mood: 'surprised', set: 'Kubo set' },
  { id: 'silo', name: 'SILO', label: 'Silo', color: '#F2C94C', lip: '#C49B23', text: '#3B2E05', mood: 'wink', set: 'Kubo set' },
  { id: 'melon', name: 'MELON', label: 'Melon', color: '#7BD389', lip: '#4CA35A', text: '#123318', mood: 'smile', set: 'Kubo set' },
  { id: 'sumi', name: 'SUMI', label: 'Sumi', color: '#9B82F3', lip: '#6C53C4', text: '#1F1442', mood: 'sleepy', set: 'Kubo set' },
  { id: 'poppy', name: 'POPPY', label: 'Poppy', color: '#E76F51', lip: '#B5482D', text: '#3B1107', mood: 'grin', set: 'Kubo set' },
  { id: 'mint', name: 'MINT', label: 'Mint', color: '#7CE0D3', lip: '#4BAE9F', text: '#103833', mood: 'happy', set: 'Kubo set' },
];

const SWITCH_FAMILIES = [
  { id: 'none', name: 'No sound', desc: 'Mute the click', badge: '', color: '#52525B', freq: 0, type: 'mute', force: '—', feel: 'Silent' },
  { id: 'thocky', name: 'Thocky', desc: 'Deep, soft, premium', badge: 'Boba U4T', color: '#C84B44', freq: 145, type: 'thock', force: '62g', feel: 'Tactile' },
  { id: 'clicky', name: 'Clicky', desc: 'Sharp, blue-switch', badge: '3 switches', color: '#8ECAE6', freq: 920, type: 'click', force: '50g', feel: 'Clicky' },
  { id: 'clacky', name: 'Clacky', desc: 'Bright, mechanical', badge: '4 switches', color: '#F2C94C', freq: 420, type: 'clack', force: '55g', feel: 'Tactile' },
  { id: 'creamy', name: 'Creamy', desc: 'Smooth, rounded', badge: '3 switches', color: '#F4A261', freq: 210, type: 'creamy', force: '45g', feel: 'Linear' },
  { id: 'poppy', name: 'Poppy', desc: 'Light, bouncy', badge: '3 switches', color: '#F3A8BC', freq: 310, type: 'poppy', force: '48g', feel: 'Linear' },
  { id: 'silent', name: 'Silent', desc: 'Dampened midnight', badge: '2 switches', color: '#7CE0D3', freq: 90, type: 'silent', force: '42g', feel: 'Silent Linear' },
];

// ============================================================================
// 2. WEB AUDIO API MECHANICAL SWITCH SYNTHESIZER
// ============================================================================
class KeycapSoundEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.profile = 'thocky';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(customProfile = null, pitchOffset = 0) {
    const activeProfile = customProfile || this.profile;
    if (activeProfile === 'none' || this.volume <= 0) return;

    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.connect(this.ctx.destination);

      // Base body oscillator (keycap bottom-out resonance)
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();

      let baseFreq = 150;
      let duration = 0.065;
      let oscType = 'triangle';

      if (activeProfile === 'thocky') {
        baseFreq = 135 + pitchOffset;
        duration = 0.075;
        oscType = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);
      } else if (activeProfile === 'clicky') {
        baseFreq = 880 + pitchOffset;
        duration = 0.045;
        oscType = 'square';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1600, now);
      } else if (activeProfile === 'clacky') {
        baseFreq = 390 + pitchOffset;
        duration = 0.055;
        oscType = 'triangle';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950, now);
      } else if (activeProfile === 'creamy') {
        baseFreq = 205 + pitchOffset;
        duration = 0.07;
        oscType = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(520, now);
      } else if (activeProfile === 'poppy') {
        baseFreq = 310 + pitchOffset;
        duration = 0.05;
        oscType = 'sine';
        filter.type = 'peaking';
        filter.frequency.setValueAtTime(700, now);
      } else if (activeProfile === 'silent') {
        baseFreq = 85 + pitchOffset;
        duration = 0.035;
        oscType = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
      } else if (activeProfile === 'bell') {
        baseFreq = 660;
        duration = 0.35;
        oscType = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);
      }

      osc.type = oscType;
      osc.frequency.setValueAtTime(baseFreq * 1.4, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq * 0.45), now + duration);

      const peakGain = Math.min(1, this.volume * (activeProfile === 'silent' ? 0.25 : 0.55));
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      osc.start(now);
      osc.stop(now + duration);

      // Tactile transient noise burst for mechanical stem impact
      const bufferSize = this.ctx.sampleRate * 0.018;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(activeProfile === 'thocky' ? 450 : 1400, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(peakGain * 0.6, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.018);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      whiteNoise.start(now);
    } catch (e) {
      // Ignore audio errors if blocked by browser autoplay before interaction
    }
  }
}

const soundEngine = new KeycapSoundEngine();

// ============================================================================
// 3. REUSABLE 3D KEYCAP & MASCOT PRIMITIVES
// ============================================================================

/** Renders the signature cute 2D vector face on sculpted keycaps */
const KeycapFace = ({ mood = 'happy', color = '#1C1C1E', size = 'md' }) => {
  const eyeSize = size === 'sm' ? 4 : size === 'lg' ? 8 : 5.5;
  const gap = size === 'sm' ? 8 : size === 'lg' ? 18 : 12;

  return (
    <div className="inline-flex flex-col items-center justify-center select-none pointer-events-none">
      <div className="flex items-center" style={{ gap: `${gap}px` }}>
        {/* Left Eye */}
        {mood === 'sleepy' ? (
          <div style={{ width: eyeSize * 1.4, height: 2.5, backgroundColor: color, borderRadius: 99 }} />
        ) : (
          <div style={{ width: eyeSize, height: eyeSize, backgroundColor: color, borderRadius: '50%' }} />
        )}
        {/* Left/Right Mouth or Center Mouth */}
        {mood === 'wink' ? (
          <div style={{ width: eyeSize * 1.4, height: 2.5, backgroundColor: color, borderRadius: 99 }} />
        ) : mood === 'sleepy' ? (
          <div style={{ width: eyeSize * 1.4, height: 2.5, backgroundColor: color, borderRadius: 99 }} />
        ) : (
          <div style={{ width: eyeSize, height: eyeSize, backgroundColor: color, borderRadius: '50%' }} />
        )}
      </div>
      {/* Mouth */}
      <div className="mt-1 flex items-center justify-center">
        {mood === 'surprised' ? (
          <div style={{ width: eyeSize * 0.9, height: eyeSize * 0.9, border: `2px solid ${color}`, borderRadius: '50%' }} />
        ) : mood === 'chill' ? (
          <div style={{ width: eyeSize * 1.6, height: 2.2, backgroundColor: color, borderRadius: 99 }} />
        ) : mood === 'grin' ? (
          <div
            style={{
              width: eyeSize * 2,
              height: eyeSize,
              backgroundColor: color,
              borderBottomLeftRadius: 99,
              borderBottomRightRadius: 99,
            }}
          />
        ) : (
          <svg width={eyeSize * 2.2} height={eyeSize * 1.2} viewBox="0 0 20 11" fill="none">
            <path
              d="M3 2.5C4.5 8 15.5 8 17 2.5"
              stroke={color}
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
};

/** Physical 3D PBT Keycap Component with top bevel, side wall, and press physics */
const Keycap3D = ({
  children,
  bg = '#FFFFFF',
  lipColor = '#D4D2C8',
  textColor = '#1C1C1E',
  className = '',
  size = 'md',
  onClick,
  soundProfile = null,
  pitch = 0,
  active = false,
  title,
}) => {
  const [pressed, setPressed] = useState(false);

  const sizeStyles = {
    xs: 'min-w-[30px] h-[32px] px-1.5 rounded-lg text-xs',
    sm: 'min-w-[38px] h-[40px] px-2 rounded-xl text-xs',
    md: 'min-w-[48px] h-[48px] px-3 rounded-2xl text-sm',
    lg: 'min-w-[84px] h-[84px] px-4 rounded-[22px] text-base',
    xl: 'min-w-[128px] h-[116px] px-6 rounded-[28px] text-lg',
    space: 'w-full h-[52px] px-6 rounded-2xl text-sm',
  }[size] || 'min-w-[48px] h-[48px] px-3 rounded-2xl text-sm';

  const isDown = pressed || active;

  const handleTrigger = (e) => {
    soundEngine.play(soundProfile, pitch);
    if (onClick) onClick(e);
  };

  return (
    <button
      type="button"
      title={title}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={handleTrigger}
      style={{
        backgroundColor: bg,
        color: textColor,
        boxShadow: isDown
          ? `0 1px 0 0 ${lipColor}, inset 0 1px 0 0 rgba(255,255,255,0.45), 0 2px 4px rgba(0,0,0,0.12)`
          : `0 5px 0 0 ${lipColor}, inset 0 2px 0 0 rgba(255,255,255,0.65), 0 7px 14px rgba(0,0,0,0.14)`,
        transform: isDown ? 'translateY(4px)' : 'translateY(0px)',
      }}
      className={`relative inline-flex flex-col items-center justify-center font-semibold select-none transition-all duration-75 border border-black/10 focus:outline-none ${sizeStyles} ${className}`}
    >
      {/* Subtle sculpted keycap dish inner border */}
      <div
        className="w-full h-full flex flex-col items-center justify-center rounded-[inherit]"
        style={{
          boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.05)',
        }}
      >
        {children}
      </div>
    </button>
  );
};

/** The signature 3D Black CTRLSPC Mascot Keycap from 0:03 & 0:07 of the video */
const CtrlSpcKeycapLogo = ({ size = 'md', onClick }) => {
  const dims = size === 'lg'
    ? 'w-28 h-28 rounded-[28px]'
    : size === 'sm'
    ? 'w-11 h-11 rounded-xl'
    : 'w-16 h-16 rounded-2xl';

  return (
    <button
      type="button"
      onClick={() => {
        soundEngine.play('thocky', -20);
        if (onClick) onClick();
      }}
      className={`relative group select-none transition-transform active:translate-y-1 ${dims}`}
      style={{
        background: 'linear-gradient(180deg, #3A3A3F 0%, #18181B 100%)',
        boxShadow: '0 6px 0 0 #09090B, 0 10px 20px rgba(0,0,0,0.28), inset 0 2px 1px rgba(255,255,255,0.25)',
        padding: size === 'sm' ? '4px' : '7px',
      }}
    >
      {/* Top dished surface */}
      <div
        className="w-full h-full rounded-[inherit] flex flex-col items-center justify-center gap-1 border border-white/10"
        style={{
          background: 'linear-gradient(145deg, #222226 0%, #2E2E33 100%)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
        }}
      >
        {/* Two white rounded-rectangle eyes */}
        <div className="flex items-center justify-center gap-1.5">
          <div className={`${size === 'sm' ? 'w-1.5 h-1.5 rounded-[2px]' : size === 'lg' ? 'w-4 h-3.5 rounded-md' : 'w-2.5 h-2 rounded-sm'} bg-white shadow-sm`} />
          <div className={`${size === 'sm' ? 'w-1.5 h-1.5 rounded-[2px]' : size === 'lg' ? 'w-4 h-3.5 rounded-md' : 'w-2.5 h-2 rounded-sm'} bg-white shadow-sm`} />
        </div>
        {/* White pill mouth with CTRLSPC text */}
        <div
          className={`bg-white text-[#1C1C1E] font-black tracking-tighter rounded-sm flex items-center justify-center ${
            size === 'sm' ? 'px-1 py-0 text-[5px]' : size === 'lg' ? 'px-2.5 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[7px]'
          }`}
        >
          CTRLSPC
        </div>
      </div>
    </button>
  );
};

/** Cute Pixel/Vector Blue Bear Mascot from the Focus Screen (0:23 in video) */
const BlueBearMascot = ({ size = 84, animated = true }) => (
  <div className={`relative inline-flex flex-col items-center justify-center ${animated ? 'animate-bounce' : ''}`} style={{ animationDuration: '3.2s' }}>
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      {/* Ears */}
      <rect x="16" y="14" width="18" height="18" rx="6" fill="#6EC3D4" stroke="#4799AA" strokeWidth="3" />
      <rect x="21" y="19" width="8" height="8" rx="2" fill="#4799AA" />
      <rect x="62" y="14" width="18" height="18" rx="6" fill="#6EC3D4" stroke="#4799AA" strokeWidth="3" />
      <rect x="67" y="19" width="8" height="8" rx="2" fill="#4799AA" />
      {/* Head Keycap */}
      <rect x="18" y="24" width="60" height="48" rx="14" fill="#8CD7E6" stroke="#53A8B9" strokeWidth="3" />
      {/* Inner Dish */}
      <rect x="24" y="29" width="48" height="36" rx="10" fill="#A3E4F0" />
      {/* Eyes */}
      <rect x="34" y="41" width="6" height="6" rx="3" fill="#1C1C1E" />
      <rect x="56" y="41" width="6" height="6" rx="3" fill="#1C1C1E" />
      {/* Snout & Nose */}
      <rect x="42" y="46" width="12" height="9" rx="4" fill="#E6FAFD" />
      <rect x="45" y="48" width="6" height="4" rx="2" fill="#2A6B78" />
      {/* Body & Paws */}
      <rect x="26" y="68" width="44" height="18" rx="8" fill="#6EC3D4" />
      <rect x="22" y="72" width="12" height="12" rx="5" fill="#4799AA" />
      <rect x="62" y="72" width="12" height="12" rx="5" fill="#4799AA" />
      <rect x="36" y="71" width="24" height="11" rx="5" fill="#C4F0F7" />
    </svg>
  </div>
);

// ============================================================================
// 4. INTERACTIVE MOBILE APP PREVIEW (393x852 FRAME FROM VIDEO)
// ============================================================================
const MobileAppPreview = ({
  activeScreen,
  setActiveScreen,
  selectedChar,
  setSelectedChar,
  selectedSwitch,
  setSelectedSwitch,
  volume,
  setVolume,
  triggerToast,
}) => {
  // Weekly habit tracker state on Home screen
  const [weekDays, setWeekDays] = useState([
    { day: 'M', color: '#F3A8BC', done: true, mood: 'happy' },
    { day: 'T', color: '#8ECAE6', done: true, mood: 'chill' },
    { day: 'W', color: '#7CE0D3', done: true, mood: 'smile' },
    { day: 'T', color: '#F3A8BC', done: true, mood: 'wink' },
    { day: 'F', color: '#F2C94C', done: true, mood: 'happy' },
    { day: 'S', color: '#8ECAE6', done: true, mood: 'grin' },
    { day: 'S', color: '#E76F51', done: true, mood: 'happy' },
  ]);

  // Keycap sub-tab ('keyboard' | 'character')
  const [keycapSubView, setKeycapSubView] = useState('keyboard');
  const [charTab, setCharTab] = useState('ORIGINALS');
  const [typedPreview, setTypedPreview] = useState('CTRLSPC');

  // Alarm screen state
  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMin, setAlarmMin] = useState(0);
  const [alarmPeriod, setAlarmPeriod] = useState('AM');
  const [alarmLabel, setAlarmLabel] = useState('Wake up');
  const [alarmRepeat, setAlarmRepeat] = useState('Week');
  const [alarmDays, setAlarmDays] = useState([true, true, true, true, true, false, false]);
  const [alarmSound, setAlarmSound] = useState('Classic Bell');

  // Focus timer state
  const [focusSeconds, setFocusSeconds] = useState(12 * 60 + 30);
  const [focusRunning, setFocusRunning] = useState(true);

  useEffect(() => {
    if (!focusRunning || activeScreen !== 'focus') return;
    const timer = setInterval(() => {
      setFocusSeconds((prev) => (prev > 0 ? prev - 1 : 1500));
    }, 1000);
    return () => clearInterval(timer);
  }, [focusRunning, activeScreen]);

  // Memory Jar state
  const [jarFilter, setJarFilter] = useState('All');
  const [jarSearch, setJarSearch] = useState('');
  const [memories, setMemories] = useState([
    {
      id: 1,
      type: 'Quotes',
      tag: '“ QUOTE',
      text: 'Done is a gift you give yourself tomorrow.',
      bg: '#C84B44',
      textColor: '#FFFFFF',
      rot: '-6deg',
    },
    {
      id: 2,
      type: 'Notes',
      tag: 'VOICE • 0:42',
      text: '0:42',
      isAudio: true,
      bg: '#7CE0D3',
      textColor: '#103833',
      rot: '5deg',
    },
    {
      id: 3,
      type: 'Photos',
      tag: 'PHOTO',
      text: ' Sunset over Lisbon rooftops',
      isPhoto: true,
      bg: '#D8E2DC',
      textColor: '#1C1C1E',
      rot: '-3deg',
    },
    {
      id: 4,
      type: 'Notes',
      tag: '✎ NOTE',
      text: 'Pack the film camera for Lisbon',
      bg: '#F4F3EE',
      textColor: '#1C1C1E',
      rot: '4deg',
    },
  ]);

  // Brain game interactive mini-state
  const [reactionState, setReactionState] = useState('idle'); // idle | waiting | click | done
  const [reactionMs, setReactionMs] = useState(242);
  const reactionStartRef = useRef(0);

  const handleReactionTap = () => {
    soundEngine.play('poppy', 40);
    if (reactionState === 'idle' || reactionState === 'done') {
      setReactionState('waiting');
      setTimeout(() => {
        reactionStartRef.current = performance.now();
        setReactionState('click');
      }, 1100 + Math.random() * 1200);
    } else if (reactionState === 'click') {
      const elapsed = Math.round(performance.now() - reactionStartRef.current);
      setReactionMs(elapsed);
      setReactionState('done');
      triggerToast(`Reaction time: ${elapsed} ms!`);
    }
  };

  const activeCharObj = CHARACTERS.find((c) => c.id === selectedChar) || CHARACTERS[7];
  const activeSwitchObj = SWITCH_FAMILIES.find((s) => s.id === selectedSwitch) || SWITCH_FAMILIES[1];

  const formatFocusTime = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m} ${s}`;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Screen Quick-Jump Pill Strip above Phone */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4 bg-[#EAE8E0] p-1.5 rounded-2xl border border-black/5">
        {[
          { id: 'home', label: '1. Home Space' },
          { id: 'keycaps', label: '2. Keycaps & Char' },
          { id: 'sound', label: '3. Sound Studio' },
          { id: 'alarm', label: '4. Wake Alarm' },
          { id: 'focus', label: '5. Focus Bear' },
          { id: 'jar', label: '6. Memory Jar' },
          { id: 'games', label: '7. Brain Games' },
          { id: 'widgets', label: '8. Widgets & Splash' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              soundEngine.play('thocky', 15);
              setActiveScreen(tab.id);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeScreen === tab.id
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 393 x 852 iPhone Frame */}
      <div
        className="relative w-[385px] sm:w-[393px] h-[820px] sm:h-[852px] rounded-[54px] p-[11px] shadow-2xl select-none transition-colors duration-300"
        style={{
          background: 'linear-gradient(145deg, #2C2C30 0%, #121214 100%)',
          boxShadow: '0 30px 70px -15px rgba(0,0,0,0.45), inset 0 1px 2px rgba(255,255,255,0.25)',
        }}
      >
        {/* Inner Bezel & Screen Surface */}
        <div
          className={`relative w-full h-full rounded-[44px] overflow-hidden flex flex-col justify-between transition-colors duration-300 ${
            activeScreen === 'sound' || activeScreen === 'widgets'
              ? 'bg-[#18181B] text-white'
              : 'bg-[#F4F3EE] text-[#1C1C1E]'
          }`}
        >
          {/* iOS Status Bar + Dynamic Island */}
          <div className="relative pt-3 px-7 pb-2 flex items-center justify-between text-xs font-bold z-30 shrink-0">
            <span>9:41</span>
            <div className="w-[106px] h-[28px] bg-black rounded-full flex items-center justify-end px-2.5 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a2e] border border-white/10" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-end gap-0.5 h-2.5">
                <span className="w-0.5 h-1 bg-current rounded-full" />
                <span className="w-0.5 h-1.5 bg-current rounded-full" />
                <span className="w-0.5 h-2 bg-current rounded-full" />
                <span className="w-0.5 h-2.5 bg-current rounded-full" />
              </div>
              <div className="w-5 h-2.5 border border-current rounded-[3px] p-[1px] flex items-center">
                <div className="w-full h-full bg-current rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SCREEN 1: HOME BENTO DASHBOARD (0:07 in video)                 */}
          {/* ============================================================== */}
          {activeScreen === 'home' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
              {/* Header: 3D CTRLSPC keycap + Title + 12 Streak */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  <CtrlSpcKeycapLogo size="sm" onClick={() => setActiveScreen('widgets')} />
                  <span className="text-xl font-black tracking-tight text-[#1C1C1E]">CTRLSPC</span>
                </div>
                <button
                  onClick={() => {
                    soundEngine.play('poppy', 60);
                    triggerToast('🔥 12-day personal space streak!');
                  }}
                  className="flex items-center gap-1.5 bg-[#EAE8E0] hover:bg-[#e2dfd5] px-3 py-1.5 rounded-full text-xs font-extrabold text-[#C84B44] transition"
                >
                  <Flame className="w-4 h-4 fill-[#C84B44] text-[#C84B44]" />
                  <span className="text-[#1C1C1E]">12</span>
                </button>
              </div>

              {/* 7-Day Mini Keycap Face Tracker (M T W T F S S) */}
              <div className="bg-[#EAE8E0]/80 rounded-2xl p-2.5 flex items-center justify-between">
                {weekDays.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-stone-400">{item.day}</span>
                    <Keycap3D
                      size="xs"
                      bg={item.done ? item.color : '#DCD9CE'}
                      lipColor={item.done ? 'rgba(0,0,0,0.22)' : '#BDB9AC'}
                      onClick={() => {
                        const next = [...weekDays];
                        next[idx].done = !next[idx].done;
                        setWeekDays(next);
                      }}
                    >
                      <KeycapFace mood={item.mood} size="sm" />
                    </Keycap3D>
                  </div>
                ))}
              </div>

              {/* Full-Width Dark Bento Card: Keycaps */}
              <div
                onClick={() => {
                  soundEngine.play('thocky');
                  setKeycapSubView('keyboard');
                  setActiveScreen('keycaps');
                }}
                className="relative bg-[#1C1C1E] text-white rounded-[28px] p-4 h-[172px] overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all"
              >
                <div className="relative z-10">
                  <h3 className="text-base font-extrabold tracking-tight">Keycaps</h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Switch sound • <span className="text-stone-200">{activeSwitchObj.badge || activeSwitchObj.name}</span>
                  </p>
                  <p className="text-xs text-stone-400">
                    Character • <span className="text-stone-200">{activeCharObj.label}</span>
                  </p>
                </div>

                {/* Tilted 3D Mini Keyboard Illustration at Bottom */}
                <div
                  className="absolute -bottom-3 -right-3 left-3 bg-[#E6E4DC] p-2 rounded-2xl shadow-2xl border-b-4 border-stone-400 transition-transform duration-300 group-hover:-translate-y-1"
                  style={{ transform: 'rotate(-4deg)' }}
                >
                  <div className="grid grid-cols-10 gap-1 mb-1">
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
                      <div
                        key={k}
                        className="h-5 bg-[#F4F3EE] rounded text-[8px] font-bold text-[#1C1C1E] flex items-center justify-center shadow-[0_2px_0_#C7C4B8]"
                      >
                        {k}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="px-2 h-6 bg-[#262629] text-white rounded text-[8px] font-bold flex items-center justify-center shadow-[0_2px_0_#000]">
                      123
                    </div>
                    <div
                      className="flex-1 h-6 rounded flex items-center justify-center shadow-[0_2px_0_rgba(0,0,0,0.2)]"
                      style={{ backgroundColor: activeCharObj.color }}
                    >
                      <KeycapFace mood={activeCharObj.mood} size="sm" />
                    </div>
                    <div className="px-2.5 h-6 bg-[#C84B44] text-white rounded text-[8px] font-bold flex items-center justify-center shadow-[0_2px_0_#8F2E29]">
                      return
                    </div>
                  </div>
                </div>
              </div>

              {/* 2x2 Dark Bento Grid: Alarms, Focus, Memory Jar, Games */}
              <div className="grid grid-cols-2 gap-3">
                {/* Alarms Card */}
                <div
                  onClick={() => {
                    soundEngine.play('thocky');
                    setActiveScreen('alarm');
                  }}
                  className="relative bg-[#1C1C1E] text-white rounded-[26px] p-4 h-[156px] overflow-hidden cursor-pointer group hover:scale-[1.01] transition"
                >
                  <h4 className="text-sm font-extrabold">Alarms</h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {alarmHour}:{String(alarmMin).padStart(2, '0')} {alarmPeriod} • in 9 hours
                  </p>
                  <p className="text-[11px] text-stone-500">{alarmSound}</p>
                  {/* Rotary Dial Preview Graphic */}
                  <div className="absolute -bottom-5 -right-5 w-24 h-24 rounded-full bg-[#F4F3EE] text-[#1C1C1E] flex flex-col items-center justify-center shadow-lg border-4 border-[#EAE8E0] group-hover:scale-105 transition">
                    <span className="text-[10px] font-bold text-stone-400">07</span>
                    <span className="text-lg font-black text-[#C84B44] leading-none">08</span>
                    <span className="text-[10px] font-bold text-stone-400">09</span>
                  </div>
                </div>

                {/* Focus Card */}
                <div
                  onClick={() => {
                    soundEngine.play('thocky');
                    setActiveScreen('focus');
                  }}
                  className="relative bg-[#1C1C1E] text-white rounded-[26px] p-4 h-[156px] overflow-hidden cursor-pointer group hover:scale-[1.01] transition"
                >
                  <h4 className="text-sm font-extrabold">Focus</h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">Today • 40 min</p>
                  {/* Tilted 40:00 Timer Card */}
                  <div
                    className="absolute -bottom-3 -right-2 w-28 h-20 bg-[#F4F3EE] text-[#1C1C1E] rounded-2xl p-3 flex items-center justify-center shadow-lg group-hover:-translate-y-1 transition"
                    style={{ transform: 'rotate(-8deg)' }}
                  >
                    <span className="text-xl font-black tracking-tight">40:00</span>
                  </div>
                </div>

                {/* Memory Jar Card */}
                <div
                  onClick={() => {
                    soundEngine.play('thocky');
                    setActiveScreen('jar');
                  }}
                  className="relative bg-[#1C1C1E] text-white rounded-[26px] p-4 h-[156px] overflow-hidden cursor-pointer group hover:scale-[1.01] transition"
                >
                  <h4 className="text-sm font-extrabold">Memory Jar</h4>
                  <p className="text-[11px] text-stone-400 mt-0.5">Last drop • 2h ago</p>
                  {/* Mini Glass Jar Graphic */}
                  <div className="absolute -bottom-3 right-3 w-16 h-20 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm p-1.5 flex flex-col items-center justify-end gap-1 group-hover:-translate-y-1 transition">
                    <div className="w-10 h-2 bg-white/30 rounded-full -mt-2.5 mb-1" />
                    <div className="w-11 h-6 bg-[#C84B44] rounded-md rotate-[-6deg]" />
                    <div className="w-11 h-5 bg-[#7CE0D3] rounded-md rotate-[5deg]" />
                  </div>
                </div>

                {/* Games Card */}
                <div
                  onClick={() => {
                    soundEngine.play('thocky');
                    setActiveScreen('games');
                  }}
                  className="relative bg-[#1C1C1E] text-white rounded-[26px] p-4 h-[156px] overflow-hidden cursor-pointer group hover:scale-[1.01] transition"
                >
                  <h4 className="text-sm font-extrabold">Games</h4>
                  <p className="text-[11px] text-stone-400 mt-0.5 leading-tight">Quick tests for your brain</p>
                  {/* Mini Handheld + 3x3 Grid Graphic */}
                  <div className="absolute bottom-2 right-2 flex items-end gap-1.5 group-hover:scale-105 transition">
                    <div className="w-11 h-14 bg-[#C84B44] rounded-lg p-1.5 flex flex-col justify-between shadow-md rotate-[-6deg]">
                      <div className="w-full h-6 bg-[#1C1C1E] rounded-sm" />
                      <div className="flex justify-between items-center px-0.5">
                        <div className="w-2.5 h-2.5 bg-white/80 rounded-full" />
                        <div className="w-2 h-2 bg-amber-300 rounded-full" />
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-[#EAE8E0] rounded-lg p-1 grid grid-cols-3 gap-0.5 rotate-[6deg] shadow-md">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <div
                          key={n}
                          className={`rounded-[2px] ${n % 2 === 0 ? 'bg-[#7CE0D3]' : 'bg-white'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 2: KEYCAPS & CHARACTER CUSTOMIZER (0:09 - 0:12 in video) */}
          {/* ============================================================== */}
          {activeScreen === 'keycaps' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col">
              {/* Top Nav Bar */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={() => {
                    soundEngine.play('thocky');
                    if (keycapSubView === 'character') setKeycapSubView('keyboard');
                    else setActiveScreen('home');
                  }}
                  className="w-9 h-9 rounded-full bg-[#EAE8E0] flex items-center justify-center hover:bg-stone-300 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex bg-[#EAE8E0] p-1 rounded-full text-xs font-bold">
                  <button
                    onClick={() => setKeycapSubView('keyboard')}
                    className={`px-3 py-1 rounded-full transition ${
                      keycapSubView === 'keyboard' ? 'bg-[#1C1C1E] text-white' : 'text-stone-600'
                    }`}
                  >
                    Keycaps
                  </button>
                  <button
                    onClick={() => setKeycapSubView('character')}
                    className={`px-3 py-1 rounded-full transition ${
                      keycapSubView === 'character' ? 'bg-[#1C1C1E] text-white' : 'text-stone-600'
                    }`}
                  >
                    Character
                  </button>
                </div>
                <button
                  onClick={() => triggerToast('Keyboard extension enabled!')}
                  className="flex items-center gap-1 bg-[#EAE8E0] px-3 py-1.5 rounded-full text-xs font-bold"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Set up</span>
                </button>
              </div>

              {keycapSubView === 'keyboard' ? (
                <div className="space-y-3 mt-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black tracking-tight">Keycaps</h2>
                    <span className="text-xs font-mono bg-[#EAE8E0] px-2.5 py-1 rounded-lg text-stone-600">
                      {typedPreview || 'Type below...'}|
                    </span>
                  </div>

                  {/* Interactive 3D QWERTY Keyboard Preview */}
                  <div className="bg-[#E5E3DA] p-2.5 rounded-[26px] shadow-inner space-y-1.5 border border-black/5">
                    <div className="grid grid-cols-10 gap-1">
                      {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k, i) => (
                        <Keycap3D
                          key={k}
                          size="xs"
                          bg="#F7F6F2"
                          lipColor="#C8C5B8"
                          pitch={i * 12}
                          onClick={() => setTypedPreview((p) => (p.length > 12 ? k : p + k))}
                        >
                          <span className="text-xs font-bold">{k}</span>
                        </Keycap3D>
                      ))}
                    </div>
                    <div className="grid grid-cols-9 gap-1 px-3">
                      {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k, i) => (
                        <Keycap3D
                          key={k}
                          size="xs"
                          bg="#F7F6F2"
                          lipColor="#C8C5B8"
                          pitch={i * 10}
                          onClick={() => setTypedPreview((p) => (p.length > 12 ? k : p + k))}
                        >
                          <span className="text-xs font-bold">{k}</span>
                        </Keycap3D>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Keycap3D size="xs" bg="#E0DDD3" lipColor="#B8B4A6" className="px-2">
                        <span className="text-xs">⇧</span>
                      </Keycap3D>
                      <div className="grid grid-cols-7 gap-1 flex-1">
                        {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k, i) => (
                          <Keycap3D
                            key={k}
                            size="xs"
                            bg="#F7F6F2"
                            lipColor="#C8C5B8"
                            pitch={i * 14}
                            onClick={() => setTypedPreview((p) => (p.length > 12 ? k : p + k))}
                          >
                            <span className="text-xs font-bold">{k}</span>
                          </Keycap3D>
                        ))}
                      </div>
                      <Keycap3D
                        size="xs"
                        bg="#E0DDD3"
                        lipColor="#B8B4A6"
                        className="px-2"
                        onClick={() => setTypedPreview((p) => p.slice(0, -1))}
                      >
                        <span className="text-xs">⌫</span>
                      </Keycap3D>
                    </div>
                    {/* Bottom row: 123 + Character Spacebar + Coral Return */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Keycap3D size="sm" bg="#262629" lipColor="#09090B" textColor="#FFF" className="px-3">
                        <span className="text-xs font-bold">123</span>
                      </Keycap3D>
                      <div className="flex-1">
                        <Keycap3D
                          size="sm"
                          bg={activeCharObj.color}
                          lipColor={activeCharObj.lip}
                          className="w-full"
                          pitch={-35}
                          onClick={() => setTypedPreview((p) => p + ' ')}
                        >
                          <KeycapFace mood={activeCharObj.mood} size="sm" />
                        </Keycap3D>
                      </div>
                      <Keycap3D
                        size="sm"
                        bg="#C84B44"
                        lipColor="#8F2E29"
                        textColor="#FFF"
                        className="px-4"
                        onClick={() => triggerToast(`Typed: ${typedPreview}`)}
                      >
                        <span className="text-xs font-bold">return</span>
                      </Keycap3D>
                    </div>
                  </div>

                  {/* Customization Stack Rows (Kubo, Mint, Color, Boba U4T) */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => triggerToast('Kubo PBT Keycap Set selected')}
                      className="w-full bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm border border-black/5 hover:bg-stone-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-xl bg-[#EAE8E0] flex items-center justify-center font-bold text-xs shadow-inner">
                          A
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-extrabold">Kubo</div>
                          <div className="text-xs text-stone-400">Set</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>

                    <button
                      onClick={() => {
                        soundEngine.play('poppy');
                        setKeycapSubView('character');
                      }}
                      className="w-full bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm border border-black/5 hover:bg-stone-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-10 rounded-xl flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: activeCharObj.color }}
                        >
                          <KeycapFace mood={activeCharObj.mood} size="sm" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-extrabold">{activeCharObj.label}</div>
                          <div className="text-xs text-stone-400">Character • Spacebar</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>

                    <button
                      onClick={() => {
                        const nextIdx = (CHARACTERS.findIndex((c) => c.id === selectedChar) + 1) % CHARACTERS.length;
                        setSelectedChar(CHARACTERS[nextIdx].id);
                        soundEngine.play('clacky');
                      }}
                      className="w-full bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm border border-black/5 hover:bg-stone-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-xl bg-[#E76F51] flex items-center justify-center shadow-sm" />
                        <div className="text-left">
                          <div className="text-sm font-extrabold">Color</div>
                          <div className="text-xs text-stone-400">6 keys</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>

                    <button
                      onClick={() => {
                        soundEngine.play('thocky');
                        setActiveScreen('sound');
                      }}
                      className="w-full bg-white rounded-2xl p-3 flex items-center justify-between shadow-sm border border-black/5 hover:bg-stone-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-xl bg-[#EAE8E0] flex items-center justify-center text-stone-600">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-extrabold">{activeSwitchObj.badge || activeSwitchObj.name}</div>
                          <div className="text-xs text-stone-400">{activeSwitchObj.name} • Medium tap</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </button>
                  </div>
                </div>
              ) : (
                /* CHARACTER PICKER VIEW (0:11 in video) */
                <div className="space-y-3 mt-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Character</h2>
                    <p className="text-xs text-stone-400">Set 1 • 8 characters</p>

                    {/* Underline Category Tabs */}
                    <div className="flex items-center gap-4 border-b border-black/10 mt-2 text-[11px] font-extrabold tracking-wider overflow-x-auto">
                      {['ORIGINALS', 'CORE', 'CRITTERS', 'SNACKS', 'ARCADE'].map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            soundEngine.play('clicky');
                            setCharTab(t);
                          }}
                          className={`pb-2 transition whitespace-nowrap ${
                            charTab === t
                              ? 'text-[#1C1C1E] border-b-2 border-[#1C1C1E]'
                              : 'text-stone-400 hover:text-stone-600'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    {/* Large 3D Sculpted Keycap Mascot Showcase */}
                    <div className="py-4 flex flex-col items-center justify-center">
                      <Keycap3D
                        size="xl"
                        bg={activeCharObj.color}
                        lipColor={activeCharObj.lip}
                        soundProfile="poppy"
                      >
                        <KeycapFace mood={activeCharObj.mood} size="lg" />
                      </Keycap3D>
                      <div className="mt-3 text-sm">
                        <span className="font-extrabold">{activeCharObj.label}</span>
                        <span className="text-stone-400"> • on the {activeCharObj.set}</span>
                      </div>
                    </div>

                    {/* 4x2 Character Tile Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {CHARACTERS.map((char) => {
                        const isSelected = char.id === selectedChar;
                        return (
                          <button
                            key={char.id}
                            onClick={() => {
                              soundEngine.play('poppy');
                              setSelectedChar(char.id);
                            }}
                            className={`p-2 rounded-2xl flex flex-col items-center gap-1.5 transition border-2 ${
                              isSelected
                                ? 'bg-white border-[#1C1C1E] shadow-sm'
                                : 'bg-[#EAE8E0]/70 border-transparent hover:bg-white/60'
                            }`}
                          >
                            <div
                              className="w-11 h-10 rounded-xl flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.18)]"
                              style={{ backgroundColor: char.color }}
                            >
                              <KeycapFace mood={char.mood} size="sm" />
                            </div>
                            <span className="text-[10px] font-extrabold tracking-wider">{char.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Full-width Coral CTA */}
                  <button
                    onClick={() => {
                      soundEngine.play('thocky');
                      triggerToast(`${activeCharObj.label} applied to your keyboard!`);
                      setKeycapSubView('keyboard');
                    }}
                    className="w-full py-3.5 bg-[#C84B44] hover:bg-[#b53f38] active:translate-y-0.5 text-white font-extrabold text-sm rounded-2xl shadow-md transition"
                  >
                    Put {activeCharObj.label} on my keyboard
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 3: SOUND & SWITCH STUDIO (0:13 in video - DARK MODE)    */}
          {/* ============================================================== */}
          {activeScreen === 'sound' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
              {/* Top Nav */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={() => setActiveScreen('keycaps')}
                  className="w-9 h-9 rounded-full bg-[#262629] flex items-center justify-center text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    triggerToast(`Saved ${activeSwitchObj.name} sound profile!`);
                    setActiveScreen('home');
                  }}
                  className="px-4 py-1.5 rounded-full bg-[#262629] text-xs font-bold text-white hover:bg-stone-700"
                >
                  Save
                </button>
              </div>

              <h2 className="text-2xl font-black tracking-tight">Sound</h2>

              {/* Interactive Spacebar + Vertical 70% Volume Slider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#262629] p-4 rounded-[26px] flex flex-col justify-between">
                  <Keycap3D
                    size="space"
                    bg="#7CE0D3"
                    lipColor="#4BAE9F"
                    soundProfile={selectedSwitch}
                    className="h-16"
                  >
                    <KeycapFace mood="happy" size="md" />
                  </Keycap3D>
                  <span className="text-xs text-stone-400 mt-3">
                    Playing {activeSwitchObj.badge || activeSwitchObj.name}… (Tap spacebar!)
                  </span>
                </div>

                {/* Vertical Volume Slider */}
                <div className="w-14 h-[132px] bg-[#262629] rounded-[24px] p-2 flex flex-col items-center justify-between">
                  <span className="text-[11px] font-bold text-stone-300">{Math.round(volume * 100)}%</span>
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                      setVolume(ratio);
                      soundEngine.volume = ratio;
                      soundEngine.play(selectedSwitch);
                    }}
                    className="relative w-3 flex-1 my-1.5 bg-stone-700 rounded-full overflow-hidden cursor-pointer flex flex-col justify-end"
                  >
                    <div
                      className="w-full bg-white rounded-full transition-all"
                      style={{ height: `${volume * 100}%` }}
                    />
                  </div>
                  <Volume2 className="w-4 h-4 text-stone-400" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold">Switch</h3>
                <p className="text-xs text-stone-400 mb-2.5">Tap a family to hear & equip it</p>

                <div className="space-y-2">
                  {SWITCH_FAMILIES.map((sw) => {
                    const isSelected = sw.id === selectedSwitch;
                    return (
                      <button
                        key={sw.id}
                        onClick={() => {
                          setSelectedSwitch(sw.id);
                          soundEngine.profile = sw.id;
                          soundEngine.play(sw.id);
                        }}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between transition border ${
                          isSelected
                            ? 'bg-[#2E2E32] border-white/30 shadow-md'
                            : 'bg-[#222225] border-transparent hover:bg-[#28282C]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${sw.color}25`, color: sw.color }}
                          >
                            {sw.id === 'none' ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-extrabold text-white">{sw.name}</div>
                            <div className="text-xs text-stone-400">{sw.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {sw.badge && (
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                sw.id === 'thocky'
                                  ? 'bg-[#C84B44]/25 text-[#F0716A]'
                                  : 'bg-white/10 text-stone-300'
                              }`}
                            >
                              {sw.badge}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-stone-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 4: WAKE / NEW ALARM ROTARY WHEEL (0:15 in video)        */}
          {/* ============================================================== */}
          {activeScreen === 'alarm' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col justify-between">
              {/* Top Header */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={() => setActiveScreen('home')}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  Cancel
                </button>
                <span className="text-xs font-extrabold tracking-widest uppercase">NEW ALARM</span>
                <button
                  onClick={() => {
                    soundEngine.play('bell');
                    triggerToast(`Alarm set for ${alarmHour}:${String(alarmMin).padStart(2, '0')} ${alarmPeriod}`);
                    setActiveScreen('home');
                  }}
                  className="text-xs font-extrabold text-[#C84B44]"
                >
                  Save
                </button>
              </div>

              {/* Dual Curved Rotary Time Picker + Center Controls */}
              <div className="relative my-auto py-2">
                {/* Left Curved Hour Wheel & Right Curved Minute Wheel */}
                <div className="flex items-center justify-between pointer-events-auto">
                  {/* Left Wheel (Hours) */}
                  <div className="flex flex-col items-start space-y-1 select-none">
                    {[-2, -1, 0, 1, 2].map((offset) => {
                      const val = ((alarmHour - 1 + offset + 12) % 12) + 1;
                      const isCenter = offset === 0;
                      return (
                        <button
                          key={offset}
                          onClick={() => {
                            soundEngine.play('clicky', offset * 30);
                            setAlarmHour(val);
                          }}
                          className={`transition-all font-black leading-none ${
                            isCenter
                              ? 'text-4xl text-[#C84B44] scale-105'
                              : Math.abs(offset) === 1
                              ? 'text-2xl text-stone-300 pl-1'
                              : 'text-xl text-stone-200 pl-3'
                          }`}
                        >
                          {String(val).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {/* Center Form Stack */}
                  <div className="flex-1 px-2 flex flex-col items-center space-y-2.5 z-10">
                    <span className="text-[10px] font-extrabold tracking-widest text-stone-400">HOUR</span>

                    {/* AM / PM Segmented Pill */}
                    <div className="bg-[#EAE8E0] p-1 rounded-full flex items-center text-xs font-extrabold">
                      {['AM', 'PM'].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            soundEngine.play('thocky');
                            setAlarmPeriod(p);
                          }}
                          className={`px-3.5 py-1 rounded-full transition ${
                            alarmPeriod === p ? 'bg-[#1C1C1E] text-white' : 'text-stone-500'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {/* LABEL Input */}
                    <div className="w-full text-center">
                      <span className="text-[9px] font-extrabold tracking-widest text-stone-400">LABEL</span>
                      <input
                        type="text"
                        value={alarmLabel}
                        onChange={(e) => setAlarmLabel(e.target.value)}
                        className="mt-0.5 w-full bg-white rounded-xl py-1.5 px-3 text-center text-xs font-bold shadow-sm border border-black/5 focus:outline-none"
                      />
                    </div>

                    {/* SOON Quick Chips */}
                    <div className="text-center">
                      <span className="text-[9px] font-extrabold tracking-widest text-stone-400">SOON</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {['10 min', '30 min', '1 hour'].map((chip) => (
                          <button
                            key={chip}
                            onClick={() => {
                              soundEngine.play('poppy');
                              triggerToast(`Quick nap offset: +${chip}`);
                            }}
                            className="bg-white hover:bg-stone-100 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm border border-black/5"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* REPEAT Segmented Control */}
                    <div className="text-center">
                      <span className="text-[9px] font-extrabold tracking-widest text-stone-400">REPEAT</span>
                      <div className="bg-[#EAE8E0] p-1 rounded-full flex items-center text-[11px] font-extrabold mt-0.5">
                        {['Week', 'Once', 'Date'].map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              soundEngine.play('thocky');
                              setAlarmRepeat(r);
                            }}
                            className={`px-3 py-1 rounded-full transition ${
                              alarmRepeat === r ? 'bg-[#1C1C1E] text-white' : 'text-stone-500'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* M T W T F S S Circular Toggles */}
                    <div className="flex items-center gap-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            soundEngine.play('clicky');
                            const next = [...alarmDays];
                            next[i] = !next[i];
                            setAlarmDays(next);
                          }}
                          className={`w-6 h-6 rounded-full text-[10px] font-extrabold transition ${
                            alarmDays[i] ? 'bg-[#1C1C1E] text-white' : 'bg-[#EAE8E0] text-stone-400'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>

                    {/* SOUND Pill Dropdown */}
                    <div className="text-center">
                      <span className="text-[9px] font-extrabold tracking-widest text-stone-400">SOUND</span>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <button
                          onClick={() => soundEngine.play('bell')}
                          className="w-7 h-7 rounded-full bg-[#EAE8E0] flex items-center justify-center"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const nextSound = alarmSound === 'Classic Bell' ? 'Payday Rooster' : 'Classic Bell';
                            setAlarmSound(nextSound);
                            soundEngine.play('bell');
                          }}
                          className="bg-white px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm border border-black/5 flex items-center gap-1.5"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#C84B44]" />
                          <span>{alarmSound}</span>
                          <ChevronDown className="w-3 h-3 text-stone-400" />
                        </button>
                      </div>
                    </div>

                    <span className="text-[9px] font-extrabold tracking-widest text-stone-400 pt-1">
                      CTRLSPC ORIGINAL • MINUTE
                    </span>
                  </div>

                  {/* Right Wheel (Minutes) */}
                  <div className="flex flex-col items-end space-y-1 select-none">
                    {[-2, -1, 0, 1, 2].map((offset) => {
                      const val = (alarmMin + offset + 60) % 60;
                      const isCenter = offset === 0;
                      return (
                        <button
                          key={offset}
                          onClick={() => {
                            soundEngine.play('clicky', offset * 35);
                            setAlarmMin(val);
                          }}
                          className={`transition-all font-black leading-none ${
                            isCenter
                              ? 'text-4xl text-[#C84B44] scale-105'
                              : Math.abs(offset) === 1
                              ? 'text-2xl text-stone-300 pr-1'
                              : 'text-xl text-stone-200 pr-3'
                          }`}
                        >
                          {String(val).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Coral Primary CTA */}
              <button
                onClick={() => {
                  soundEngine.play('bell');
                  triggerToast(`Alarm set for ${alarmHour}:${String(alarmMin).padStart(2, '0')} ${alarmPeriod}!`);
                  setActiveScreen('home');
                }}
                className="w-full py-3.5 bg-[#C84B44] hover:bg-[#b53f38] text-white rounded-2xl text-xs font-extrabold shadow-md transition"
              >
                Set for {alarmHour}:{String(alarmMin).padStart(2, '0')} {alarmPeriod} • in 22h 51m
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 5: FOCUS SESSION WITH BLUE BEAR MASCOT (0:23 in video)  */}
          {/* ============================================================== */}
          {activeScreen === 'focus' && (
            <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col justify-between items-center">
              <div className="w-full pt-1">
                <h2 className="text-2xl font-black tracking-tight">Focus</h2>
              </div>

              {/* Circular Progress Ring */}
              <div className="relative w-56 h-56 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
                  <circle
                    cx="110"
                    cy="110"
                    r="94"
                    fill="none"
                    stroke="#EAE8E0"
                    strokeWidth="12"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="94"
                    fill="none"
                    stroke="#A3E4F0"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 94}
                    strokeDashoffset={2 * Math.PI * 94 * (1 - focusSeconds / 1500)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black tracking-tight text-[#1C1C1E]">
                    {formatFocusTime(focusSeconds)}
                  </span>
                  <span className="text-xs font-semibold text-stone-400 mt-1">Ends 10:41 PM</span>
                </div>
              </div>

              {/* Cute Vector Blue Bear Mascot + Rain on the window Chip */}
              <div className="flex flex-col items-center">
                <BlueBearMascot size={88} animated={focusRunning} />
                <button
                  onClick={() => {
                    soundEngine.play('silent');
                    triggerToast('Ambient sound: Rain on the window');
                  }}
                  className="mt-1 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAE8E0] text-xs font-bold text-stone-700"
                >
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 h-2 bg-[#4799AA] animate-pulse" />
                    <span className="w-0.5 h-3 bg-[#4799AA] animate-pulse" />
                    <span className="w-0.5 h-1.5 bg-[#4799AA] animate-pulse" />
                  </div>
                  <span>Rain on the window</span>
                </button>
              </div>

              {/* Dual Action Buttons: Pause + Coral End early */}
              <div className="w-full grid grid-cols-2 gap-3 pb-2">
                <button
                  onClick={() => {
                    soundEngine.play('thocky');
                    setFocusRunning((r) => !r);
                  }}
                  className="py-3.5 rounded-2xl bg-[#EAE8E0] hover:bg-stone-300 font-extrabold text-xs text-[#1C1C1E] transition"
                >
                  {focusRunning ? 'Pause' : 'Resume'}
                </button>
                <button
                  onClick={() => {
                    soundEngine.play('clacky');
                    triggerToast('Focus session logged (+25m)');
                    setActiveScreen('home');
                  }}
                  className="py-3.5 rounded-2xl bg-[#C84B44] hover:bg-[#b53f38] font-extrabold text-xs text-white shadow-md transition"
                >
                  End early
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 6: MEMORY JAR SCREEN (0:26 in video)                    */}
          {/* ============================================================== */}
          {activeScreen === 'jar' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col justify-between relative">
              <div className="space-y-2.5">
                {/* Header */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight leading-none">Memory Jar</h2>
                    <span className="text-xs text-stone-400 font-semibold">{memories.length + 20} Drops</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        soundEngine.play('clacky');
                        setMemories((prev) => [...prev].reverse());
                      }}
                      className="px-3 py-1.5 rounded-full bg-[#EAE8E0] text-xs font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Shuffle</span>
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-[#EAE8E0] text-xs font-bold flex items-center gap-1">
                      <Archive className="w-3 h-3" />
                      <span>Jar</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={jarSearch}
                    onChange={(e) => setJarSearch(e.target.value)}
                    placeholder="Search this jar"
                    className="w-full bg-[#EAE8E0] rounded-2xl py-2 pl-9 pr-4 text-xs font-semibold placeholder:text-stone-400 focus:outline-none"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {['All', 'Photos', 'Notes', 'Drawings', 'Links', 'Quotes'].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        soundEngine.play('clicky');
                        setJarFilter(chip);
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                        jarFilter === chip ? 'bg-[#1C1C1E] text-white' : 'bg-[#EAE8E0] text-stone-600'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Glass Memory Jar Container */}
              <div className="my-auto flex flex-col items-center">
                {/* Jar Neck / Lid */}
                <div className="w-44 h-4 bg-white/80 border border-stone-300 rounded-t-xl shadow-sm" />
                {/* Jar Body */}
                <div
                  className="w-64 h-[290px] rounded-[38px] p-4 grid grid-cols-2 gap-2.5 items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(160deg, rgba(255,255,255,0.85) 0%, rgba(234,232,224,0.65) 100%)',
                    boxShadow: 'inset 0 2px 12px rgba(255,255,255,0.9), 0 12px 30px rgba(0,0,0,0.06)',
                    border: '2px solid rgba(255,255,255,0.9)',
                  }}
                >
                  {memories
                    .filter((m) => jarFilter === 'All' || m.type === jarFilter)
                    .slice(0, 4)
                    .map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          soundEngine.play('poppy');
                          triggerToast(`${m.tag}: "${m.text}"`);
                        }}
                        style={{
                          backgroundColor: m.bg,
                          color: m.textColor,
                          transform: `rotate(${m.rot})`,
                        }}
                        className="p-3 rounded-2xl shadow-md cursor-pointer hover:scale-105 transition flex flex-col justify-between h-28 border border-black/5"
                      >
                        <span className="text-[9px] font-extrabold opacity-75 tracking-wider">{m.tag}</span>
                        {m.isAudio ? (
                          <div className="my-auto flex flex-col items-center">
                            <div className="flex items-center gap-0.5 h-6">
                              {[4, 9, 14, 7, 16, 10, 6, 12, 8, 5].map((h, idx) => (
                                <span
                                  key={idx}
                                  style={{ height: `${h}px` }}
                                  className="w-1 bg-[#103833] rounded-full"
                                />
                              ))}
                            </div>
                            <span className="text-[11px] font-extrabold mt-1">0:42</span>
                          </div>
                        ) : (
                          <p className="text-[11px] font-bold leading-snug line-clamp-3">{m.text}</p>
                        )}
                      </div>
                    ))}
                </div>

                <div className="text-center mt-2">
                  <div className="text-xs font-extrabold">Tap a memory</div>
                  <div className="text-[11px] text-stone-400">Last drop • 2h ago • Note</div>
                </div>
              </div>

              {/* Floating Coral Action Button (+) */}
              <button
                onClick={() => {
                  soundEngine.play('thocky');
                  const newDrop = {
                    id: Date.now(),
                    type: 'Notes',
                    tag: '✎ NOTE',
                    text: 'New tactile memory dropped in jar ✨',
                    bg: '#F2C94C',
                    textColor: '#1C1C1E',
                    rot: '-4deg',
                  };
                  setMemories([newDrop, ...memories]);
                  triggerToast('Added a new memory drop to your Jar!');
                }}
                className="absolute bottom-24 right-5 w-12 h-12 rounded-full bg-[#C84B44] hover:bg-[#b53f38] text-white shadow-lg flex items-center justify-center active:scale-95 transition"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 7: BRAIN GAMES 2x3 BENTO GRID (0:29 in video)           */}
          {/* ============================================================== */}
          {activeScreen === 'games' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setActiveScreen('home')}
                  className="w-9 h-9 rounded-full bg-[#EAE8E0] flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-black tracking-tight">Games</h2>
              </div>

              {/* Interactive Mini Reaction Tester Banner */}
              <div
                onClick={handleReactionTap}
                className={`p-3.5 rounded-2xl cursor-pointer transition flex items-center justify-between text-white ${
                  reactionState === 'waiting'
                    ? 'bg-[#C84B44]'
                    : reactionState === 'click'
                    ? 'bg-[#4CA35A]'
                    : 'bg-[#1C1C1E]'
                }`}
              >
                <div>
                  <div className="text-xs font-extrabold">
                    {reactionState === 'idle' && '⚡ Live Reaction Time Mini-Test'}
                    {reactionState === 'waiting' && 'Wait for Green...'}
                    {reactionState === 'click' && 'TAP NOW!'}
                    {reactionState === 'done' && `Great reflex! ${reactionMs} ms (Tap to retry)`}
                  </div>
                  <div className="text-[11px] opacity-75">Tap anywhere on this card to test your keycap speed</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-black">{reactionMs} ms</span>
              </div>

              {/* 2x3 Dark Bento Grid from Video */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: 'Sequence Memory', sub: 'Best • Level 9', type: 'grid-mint' },
                  { title: 'Typing', sub: 'Best • 78 wpm', type: 'keyboard' },
                  { title: 'Visual Memory', sub: 'Best • Level 7', type: 'grid-visual' },
                  { title: 'Verbal Memory', sub: 'Best • 41 words', type: 'cards' },
                  { title: 'Reaction Time', sub: `Best • ${reactionMs} ms`, type: 'bolt' },
                  { title: 'Chimp Test', sub: 'Best • 11 numbers', type: 'numbers' },
                ].map((g, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      soundEngine.play('poppy', i * 18);
                      triggerToast(`Launching ${g.title}...`);
                    }}
                    className="relative bg-[#1C1C1E] text-white rounded-[26px] p-4 h-[152px] overflow-hidden cursor-pointer group hover:scale-[1.02] transition"
                  >
                    <h4 className="text-sm font-extrabold leading-tight">{g.title}</h4>
                    <p className="text-[11px] text-stone-400 mt-0.5">{g.sub}</p>

                    {/* Unique Vector Mini-Illustration per Game */}
                    {g.type === 'grid-mint' && (
                      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-[#EAE8E0] rounded-xl p-1.5 grid grid-cols-3 gap-1 rotate-[-6deg]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <div key={n} className={`rounded ${n === 5 || n === 6 ? 'bg-[#7CE0D3]' : 'bg-white'}`} />
                        ))}
                      </div>
                    )}
                    {g.type === 'keyboard' && (
                      <div className="absolute -bottom-2 -right-2 w-24 h-16 bg-[#EAE8E0] rounded-xl p-1.5 flex flex-col gap-1 rotate-[-6deg]">
                        <div className="grid grid-cols-4 gap-1 flex-1">
                          {[1, 2, 3, 4].map((n) => (
                            <div key={n} className="bg-white rounded" />
                          ))}
                        </div>
                        <div className="h-5 bg-[#7CE0D3] rounded flex items-center justify-center">
                          <KeycapFace size="sm" />
                        </div>
                      </div>
                    )}
                    {g.type === 'grid-visual' && (
                      <div className="absolute -bottom-2 -right-2 w-20 h-20 bg-[#EAE8E0] rounded-xl p-1.5 grid grid-cols-3 gap-1 rotate-[-6deg]">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <div key={n} className={`rounded ${n % 3 === 0 ? 'bg-[#7CE0D3]' : 'bg-white'}`} />
                        ))}
                      </div>
                    )}
                    {g.type === 'cards' && (
                      <div className="absolute bottom-2 right-2 flex items-center">
                        <div className="px-2.5 py-2 bg-[#EAE8E0] text-[#1C1C1E] rounded-lg text-[9px] font-black rotate-[-8deg] shadow">
                          NEW
                        </div>
                        <div className="px-2.5 py-2 bg-[#7CE0D3] text-[#1C1C1E] rounded-lg text-[9px] font-black rotate-[6deg] -ml-2 shadow">
                          SEEN
                        </div>
                      </div>
                    )}
                    {g.type === 'bolt' && (
                      <div className="absolute -bottom-2 right-3 text-[#7CE0D3] group-hover:scale-110 transition">
                        <Zap className="w-16 h-16 fill-[#7CE0D3]" />
                      </div>
                    )}
                    {g.type === 'numbers' && (
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        {['1', '2', '3'].map((num) => (
                          <div
                            key={num}
                            className="w-7 h-8 bg-[#EAE8E0] text-[#1C1C1E] rounded-lg font-black text-xs flex items-center justify-center shadow"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* SCREEN 8: iOS WIDGETS & SPLASH LOGO (0:04 & 0:32 in video)     */}
          {/* ============================================================== */}
          {activeScreen === 'widgets' && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-extrabold tracking-widest uppercase text-stone-400">
                  iOS HOME WIDGETS
                </span>
                <button
                  onClick={() => setActiveScreen('home')}
                  className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold"
                >
                  Back to App
                </button>
              </div>

              {/* Full-Width Streak Contribution Grid Widget */}
              <div className="bg-[#F4F3EE] text-[#1C1C1E] rounded-[28px] p-4 flex items-center justify-between shadow-lg">
                <div>
                  <div className="text-3xl font-black">12</div>
                  <div className="text-xs font-semibold text-stone-500 mt-1">40 min • keep it going</div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 28 }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-[3px] ${
                        idx > 16 ? 'bg-[#7CE0D3]' : idx % 3 === 0 ? 'bg-[#7CE0D3]/50' : 'bg-stone-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* 2x1 Square Widgets: 16:24 Focus + 6:30 Next Alarm */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F4F3EE] text-[#1C1C1E] rounded-[28px] p-4 h-36 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="text-2xl font-black text-[#C84B44]">16:24</div>
                    <div className="text-xs text-stone-400 font-semibold">left</div>
                  </div>
                  <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="w-2/3 h-full bg-[#C84B44] rounded-full" />
                  </div>
                </div>

                <div className="bg-[#F4F3EE] text-[#1C1C1E] rounded-[28px] p-4 h-36 flex flex-col justify-between shadow-lg">
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-stone-400">
                    <span className="px-1.5 py-0.5 rounded bg-[#C84B44] text-white">AM</span>
                    <span>NEXT ALARM</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black">6:30</div>
                    <div className="text-xs text-stone-400 font-semibold">Wake up • in 7h</div>
                  </div>
                </div>
              </div>

              {/* App Icon + Splash Card */}
              <div className="bg-[#F4F3EE] text-[#1C1C1E] rounded-[28px] p-5 flex flex-col items-center text-center shadow-lg">
                <CtrlSpcKeycapLogo size="lg" />
                <div className="mt-3 text-2xl font-black tracking-tight flex items-center">
                  <span>CTRLSPC</span>
                  <span className="text-[#C84B44] animate-pulse">|</span>
                </div>
                <p className="text-xs text-stone-500 mt-1">Your Tactile Personal Space</p>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* FLOATING DARK PILL BOTTOM NAVIGATION BAR (Seen across screens) */}
          {/* ============================================================== */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <div className="pointer-events-auto bg-[#1C1C1E]/95 backdrop-blur-md text-white p-1.5 rounded-full shadow-2xl border border-white/10 flex items-center gap-1">
              {[
                { id: 'home', icon: Keyboard, label: 'Space' },
                { id: 'alarm', icon: Bell, label: 'Wake' },
                { id: 'focus', icon: Clock, label: 'Focus' },
                { id: 'jar', icon: Archive, label: 'Jar' },
                { id: 'games', icon: Gamepad2, label: 'Play' },
              ].map((nav) => {
                const Icon = nav.icon;
                const isActive = activeScreen === nav.id || (nav.id === 'home' && activeScreen === 'keycaps');
                return (
                  <button
                    key={nav.id}
                    onClick={() => {
                      soundEngine.play('thocky');
                      setActiveScreen(nav.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-extrabold transition-all ${
                      isActive
                        ? 'bg-[#C84B44] text-white shadow-sm'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {isActive && <span>{nav.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. COMPLETE 49-COMPONENT UI KIT CATALOG REGISTRY
// ============================================================================
const COMPONENT_META = [
  // CONTROL (17)
  { id: 1, name: 'Accordion', category: 'Control', desc: 'Mechanical switch family expandable groups with smooth chevron and switch specs.', code: `<Accordion title="Thocky • Boba U4T" force="62g" />` },
  { id: 2, name: 'Button', category: 'Control', desc: 'Coral primary CTA, Warm Stone secondary pill, Dark action pill, and 3D PBT Keycap button.', code: `<button className="bg-[#C84B44] text-white rounded-2xl py-3.5 px-6 font-extrabold">Put Sakura on my keyboard</button>` },
  { id: 3, name: 'Checkbox', category: 'Control', desc: 'Tactile mini-keycap checkboxes that physically depress and show a vector check or cute face.', code: `<KeycapCheckbox checked={true} label="Daily typing habit" />` },
  { id: 4, name: 'Color Picker', category: 'Control', desc: 'Pastel keycap colorway swatch grid (Sakura, Mint, Silo, Sumi, Koi) + hex pill.', code: `<KeycapColorPicker value="#F3A8BC" />` },
  { id: 5, name: 'Date Picker', category: 'Control', desc: 'Minimalist calendar grid with 3D keycap day cells and coral active selection.', code: `<KeycapDatePicker selected={14} />` },
  { id: 6, name: 'Floating Action Button', category: 'Control', desc: 'Circular coral-red + FAB (#C84B44) from the Memory Jar screen + extended pill variant.', code: `<button className="w-12 h-12 rounded-full bg-[#C84B44] text-white shadow-lg"><Plus /></button>` },
  { id: 7, name: 'Radio Button', category: 'Control', desc: 'Tactile keycap-bezel radio options for alarm sound selection (Classic Bell, Boba Thock).', code: `<KeycapRadio options={['Classic Bell', 'Morning Chime', 'Thock Loop']} />` },
  { id: 8, name: 'Rating Control', category: 'Control', desc: '5-keycap tactile rating bar where clicking lights up keycap faces from sleepy to ecstatic.', code: `<KeycapRating value={4} max={5} />` },
  { id: 9, name: 'Search Bar', category: 'Control', desc: 'Rounded warm-stone search input ("Search this jar") with magnifying glass and clear trigger.', code: `<SearchBar placeholder="Search this jar" />` },
  { id: 10, name: 'Segmented Control', category: 'Control', desc: 'Pill-shaped switches from the Alarm screen (AM / PM and Week / Once / Date).', code: `<SegmentedControl options={['Week', 'Once', 'Date']} value="Week" />` },
  { id: 11, name: 'Slider', category: 'Control', desc: 'Vertical 70% volume slider from Sound Studio + horizontal tactile keycap-thumb slider.', code: `<SoundSlider value={70} orientation="vertical" />` },
  { id: 12, name: 'Stepper', category: 'Control', desc: 'Tactile - / + mechanical keycap counter for Pomodoro intervals (25 min, 4 sessions).', code: `<KeycapStepper value={25} unit="min" />` },
  { id: 13, name: 'Switch', category: 'Control', desc: 'Toggle switch styled like a mechanical switch housing with sliding keycap thumb.', code: `<KeycapSwitch checked={true} />` },
  { id: 14, name: 'Tab', category: 'Control', desc: 'Horizontal underline tabs from Character screen (ORIGINALS, CORE, CRITTERS, SNACKS).', code: `<UnderlineTabs tabs={['ORIGINALS', 'CORE', 'CRITTERS']} />` },
  { id: 15, name: 'Text Field', category: 'Control', desc: 'Clean rounded input field ("Wake up" alarm label input) with uppercase micro-label.', code: `<TextField label="LABEL" defaultValue="Wake up" />` },
  { id: 16, name: 'Tile', category: 'Control', desc: 'Selectable 3D Character tiles (SAKURA, FUJI, KOI, SILO) with dark active border ring.', code: `<CharacterTile name="SAKURA" color="#F3A8BC" selected />` },
  { id: 17, name: 'Time Picker', category: 'Control', desc: 'Dual curved rotary wheel drum picker (07 : 00) in coral red from the New Alarm screen.', code: `<RotaryTimePicker hour={7} minute={0} />` },

  // VIEW (18)
  { id: 18, name: 'Badge', category: 'View', desc: 'Streak counter pill (🔥 12), switch tag badge (Boba U4T), and drop count badge.', code: `<Badge variant="streak">🔥 12</Badge>` },
  { id: 19, name: 'Banner', category: 'View', desc: 'Top streak reminder bar ("Keep your 12-day typing streak alive!") with mini keycap mascot.', code: `<StreakBanner streak={12} />` },
  { id: 20, name: 'Card', category: 'View', desc: 'Dark Charcoal Bento Cards (Keycaps, Alarms, Focus) & Pastel Memory Jar Note Cards.', code: `<BentoCard title="Focus" subtitle="Today • 40 min" />` },
  { id: 21, name: 'Carousel', category: 'View', desc: 'Horizontal swipeable showcase of 3D Keycap Sets (Kubo Set, Matcha Set, Cyber Set).', code: `<KeycapCarousel sets={['Kubo', 'Matcha', 'Cyber']} />` },
  { id: 22, name: 'Chip', category: 'View', desc: 'Filter chips (All, Photos, Notes), quick-time chips (10 min, 30 min), and audio status chip.', code: `<Chip active>All</Chip>` },
  { id: 23, name: 'Divider', category: 'View', desc: 'Subtle hairline dividers and labeled micro-typography dividers (CTRLSPC ORIGINAL).', code: `<LabeledDivider text="CTRLSPC ORIGINAL" />` },
  { id: 24, name: 'Gallery', category: 'View', desc: 'Masonry bento grid of Memory Jar polaroids, voice waveforms, and keycap snapshots.', code: `<MemoryGallery items={4} />` },
  { id: 25, name: 'Loading Indicator', category: 'View', desc: 'Bouncing 3-keycap mechanical wave loader and spinning rotary dial indicator.', code: `<KeycapWaveLoader />` },
  { id: 26, name: 'Map Pin', category: 'View', desc: 'Tactile keycap-shaped location pin with character face for location-tagged memories.', code: `<KeycapMapPin location="Lisbon, Portugal" />` },
  { id: 27, name: 'Progress Indicator', category: 'View', desc: 'Circular Focus Timer progress ring (12:30) and 7-day weekly keycap streak bar.', code: `<CircularProgress value={75} label="12:30" />` },
  { id: 28, name: 'Side Navigation', category: 'View', desc: 'Collapsible vertical workspace rail with CTRLSPC keycap logo, module links, and streak.', code: `<SideNavRail active="keycaps" />` },
  { id: 29, name: 'Skeleton', category: 'View', desc: 'Shimmering warm-stone placeholder cards and keycap grid skeletons for loading states.', code: `<BentoSkeleton />` },
  { id: 30, name: 'Stacked List', category: 'View', desc: 'Grouped list rows from Sound Studio (Thocky, Clicky, Clacky, Creamy) with icon & badge.', code: `<StackedSwitchList items={SWITCH_FAMILIES} />` },
  { id: 31, name: 'Status Dot', category: 'View', desc: 'Pulsing coral red (Classic Bell •), mint active audio dot, and amber focus dots.', code: `<StatusDot color="coral" pulse label="Classic Bell" />` },
  { id: 32, name: 'Tab Bar', category: 'View', desc: 'Floating dark pill bottom navigation bar with expanding coral-red active pill.', code: `<FloatingTabBar active="focus" />` },
  { id: 33, name: 'Table', category: 'View', desc: 'Clean mechanical switch comparison matrix (Switch Name, Feel, Force g, Sound Profile).', code: `<SwitchComparisonTable />` },
  { id: 34, name: 'Toolbar', category: 'View', desc: 'Contextual floating action bar for Memory Jar items (Bold, Draw, Voice Note, Tag, Color).', code: `<MemoryToolbar />` },
  { id: 35, name: 'Top Navigation Bar', category: 'View', desc: 'Mobile headers (< Keycaps [Set up], Cancel | NEW ALARM | Save, and CTRLSPC header).', code: `<TopNavBar title="Keycaps" action="Set up" />` },

  // OVERLAY (9)
  { id: 36, name: 'Action Sheet', category: 'Overlay', desc: 'iOS-style bottom action menu (Share Memory, Pin to Widget, Change Keycap Color, Delete).', code: `<ActionSheet title="Memory Drop Options" />` },
  { id: 37, name: 'Bottom Sheet', category: 'Overlay', desc: 'Draggable modal sheet for NEW ALARM and Switch Sound Preview with grabber handle.', code: `<BottomSheet title="Switch Sound Preview" />` },
  { id: 38, name: 'Coach Marks', category: 'Overlay', desc: 'Onboarding spotlight popover with 3D keycap mascot pointing out tactile sound features.', code: `<CoachMark step="1/3" text="Tap any keycap to test its thock sound!" />` },
  { id: 39, name: 'Dialog', category: 'Overlay', desc: 'Centered squircle confirmation modal ("End Focus Session Early?") with Blue Bear mascot.', code: `<ConfirmDialog title="End Focus Session Early?" />` },
  { id: 40, name: 'Drawer', category: 'Overlay', desc: 'Slide-over side sheet for quick widget layout customization and theme switching.', code: `<WidgetDrawer open={true} />` },
  { id: 41, name: 'Dropdown Menu', category: 'Overlay', desc: 'Compact floating popover menu for alarm sound selection (Classic Bell •, Boba Thock).', code: `<SoundDropdown selected="Classic Bell" />` },
  { id: 42, name: 'Full-Screen Overlay', category: 'Overlay', desc: 'Splash / Focus celebration screen with large animated 3D CTRLSPC keycap and typing cursor.', code: `<SplashOverlay text="CTRLSPC|" />` },
  { id: 43, name: 'Toast', category: 'Overlay', desc: 'Floating pill notification ("Sakura applied to your Kubo keyboard!") with keycap icon.', code: `<Toast message="Sakura applied to your keyboard!" />` },
  { id: 44, name: 'Tooltip', category: 'Overlay', desc: 'Crisp dark micro-popover above keycaps and icons ("Boba U4T • 62g Tactile").', code: `<Tooltip content="Boba U4T • 62g Tactile" />` },

  // IMAGERY (5)
  { id: 45, name: 'Avatar', category: 'Imagery', desc: 'Rounded-square 3D keycap character avatars (Sakura, Mint, CtrlSpc Black) with status dots.', code: `<KeycapAvatar character="sakura" status="online" />` },
  { id: 46, name: 'Icon', category: 'Imagery', desc: 'Custom minimalist stroke + duotone icon set (Keyboard, Bell, Focus, Jar, Gamepad, Flame).', code: `<CtrlSpcIconSet />` },
  { id: 47, name: 'Illustration', category: 'Imagery', desc: 'Pixel/vector Blue Bear Focus Mascot, 3D Isometric Keyboard Deck, and Handheld Game Grids.', code: `<BlueBearMascot size={84} />` },
  { id: 48, name: 'Logo', category: 'Imagery', desc: 'Signature 3D sculpted black CTRLSPC keycap mark with cute eyes and typing cursor CTRLSPC|.', code: `<CtrlSpcKeycapLogo size="lg" />` },
  { id: 49, name: 'Photo', category: 'Imagery', desc: 'Framed Memory Jar photo card with squircle mask, date stamp badge, and tilt hover physics.', code: `<MemoryPhotoCard location="Lisbon" />` },
];

// ============================================================================
// 6. INDIVIDUAL INTERACTIVE SHOWCASE RENDERER FOR ALL 49 COMPONENTS
// ============================================================================
const ComponentShowcaseRender = ({ comp, triggerToast, selectedChar, setSelectedChar }) => {
  // Local interactive states for the 49 component demos
  const [openAcc, setOpenAcc] = useState(0);
  const [checks, setChecks] = useState([true, true, false]);
  const [pickedColor, setPickedColor] = useState('#F3A8BC');
  const [pickedDate, setPickedDate] = useState(14);
  const [radioVal, setRadioVal] = useState('Classic Bell');
  const [rating, setRating] = useState(4);
  const [searchVal, setSearchVal] = useState('Lisbon');
  const [segPeriod, setSegPeriod] = useState('AM');
  const [segRepeat, setSegRepeat] = useState('Week');
  const [sliderVal, setSliderVal] = useState(70);
  const [stepperVal, setStepperVal] = useState(25);
  const [switchOn, setSwitchOn] = useState(true);
  const [activeTab, setActiveTab] = useState('ORIGINALS');
  const [textVal, setTextVal] = useState('Wake up');
  const [wheelHour, setWheelHour] = useState(7);
  const [wheelMin, setWheelMin] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [activeChip, setActiveChip] = useState('All');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  switch (comp.id) {
    // 1. ACCORDION
    case 1:
      return (
        <div className="space-y-2 w-full">
          {SWITCH_FAMILIES.slice(1, 4).map((sw, idx) => (
            <div key={sw.id} className="bg-[#1C1C1E] text-white rounded-2xl overflow-hidden border border-white/10">
              <button
                onClick={() => {
                  soundEngine.play(sw.id);
                  setOpenAcc(openAcc === idx ? -1 : idx);
                }}
                className="w-full p-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sw.color }} />
                  <span className="text-xs font-extrabold">{sw.name}</span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-stone-300">{sw.badge}</span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${openAcc === idx ? 'rotate-180' : ''}`} />
              </button>
              {openAcc === idx && (
                <div className="px-3 pb-3 pt-1 text-[11px] text-stone-400 border-t border-white/5 flex justify-between">
                  <span>{sw.desc}</span>
                  <span className="text-white font-bold">{sw.force} • {sw.feel}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );

    // 2. BUTTON
    case 2:
      return (
        <div className="space-y-2.5 w-full">
          <button
            onClick={() => {
              soundEngine.play('thocky');
              triggerToast('Primary Coral CTA clicked!');
            }}
            className="w-full py-2.5 bg-[#C84B44] hover:bg-[#b53f38] active:translate-y-0.5 text-white rounded-2xl text-xs font-extrabold shadow-sm transition"
          >
            Put Sakura on my keyboard
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => soundEngine.play('creamy')}
              className="flex-1 py-2 bg-[#EAE8E0] hover:bg-stone-300 text-[#1C1C1E] rounded-xl text-xs font-extrabold transition"
            >
              Pause
            </button>
            <button
              onClick={() => soundEngine.play('clicky')}
              className="px-3 py-2 bg-[#1C1C1E] text-white rounded-full text-xs font-bold flex items-center gap-1"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Set up</span>
            </button>
            <Keycap3D size="sm" bg="#C84B44" lipColor="#8F2E29" textColor="#FFF">
              <span className="text-xs font-bold">return</span>
            </Keycap3D>
          </div>
        </div>
      );

    // 3. CHECKBOX
    case 3:
      return (
        <div className="space-y-2 w-full">
          {['Morning 7:00 AM wake up', '40 min Rain Focus session', 'Drop 1 note in Memory Jar'].map((label, i) => (
            <div
              key={i}
              onClick={() => {
                soundEngine.play('poppy', i * 25);
                const next = [...checks];
                next[i] = !next[i];
                setChecks(next);
              }}
              className="flex items-center gap-3 p-2 rounded-xl bg-[#F4F3EE] cursor-pointer hover:bg-[#EAE8E0]/70 transition"
            >
              <Keycap3D
                size="xs"
                bg={checks[i] ? '#7CE0D3' : '#FFFFFF'}
                lipColor={checks[i] ? '#4BAE9F' : '#C8C5B8'}
                active={checks[i]}
              >
                {checks[i] ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
              </Keycap3D>
              <span className={`text-xs font-bold ${checks[i] ? 'line-through text-stone-400' : 'text-[#1C1C1E]'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      );

    // 4. COLOR PICKER
    case 4:
      return (
        <div className="space-y-3 w-full">
          <div className="flex items-center justify-between bg-[#F4F3EE] px-3 py-2 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg shadow-inner" style={{ backgroundColor: pickedColor }} />
              <span className="text-xs font-extrabold">PBT Keycap Dye</span>
            </div>
            <span className="text-xs font-mono font-bold text-stone-500">{pickedColor}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {['#F3A8BC', '#7CE0D3', '#8ECAE6', '#F2C94C', '#9B82F3', '#C84B44'].map((hex) => (
              <button
                key={hex}
                onClick={() => {
                  soundEngine.play('poppy');
                  setPickedColor(hex);
                }}
                style={{ backgroundColor: hex }}
                className={`h-8 rounded-xl shadow-[0_3px_0_rgba(0,0,0,0.18)] transition ${
                  pickedColor === hex ? 'ring-2 ring-[#1C1C1E] scale-105' : ''
                }`}
              />
            ))}
          </div>
        </div>
      );

    // 5. DATE PICKER
    case 5:
      return (
        <div className="bg-[#F4F3EE] p-3 rounded-2xl w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold">NOVEMBER 2026</span>
            <span className="text-[10px] font-bold text-[#C84B44]">Repeat • Date</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-[9px] font-bold text-stone-400">{d}</span>
            ))}
            {[10, 11, 12, 13, 14, 15, 16].map((day) => (
              <button
                key={day}
                onClick={() => {
                  soundEngine.play('clicky');
                  setPickedDate(day);
                }}
                className={`h-7 rounded-lg text-xs font-extrabold transition shadow-[0_2px_0_rgba(0,0,0,0.12)] ${
                  pickedDate === day ? 'bg-[#C84B44] text-white' : 'bg-white text-[#1C1C1E] hover:bg-stone-100'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      );

    // 6. FLOATING ACTION BUTTON
    case 6:
      return (
        <div className="flex items-center justify-around w-full py-2 bg-[#F4F3EE] rounded-2xl">
          <button
            onClick={() => {
              soundEngine.play('thocky');
              triggerToast('New Memory Drop created!');
            }}
            className="w-12 h-12 rounded-full bg-[#C84B44] hover:bg-[#b53f38] text-white shadow-lg flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              soundEngine.play('thocky');
              triggerToast('Quick Note Drop opened!');
            }}
            className="px-4 py-3 rounded-full bg-[#C84B44] hover:bg-[#b53f38] text-white shadow-lg flex items-center gap-2 text-xs font-extrabold active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Drop Memory</span>
          </button>
        </div>
      );

    // 7. RADIO BUTTON
    case 7:
      return (
        <div className="space-y-1.5 w-full">
          {['Classic Bell', 'Boba U4T Thock Loop', 'Rain on Window'].map((opt) => (
            <button
              key={opt}
              onClick={() => {
                soundEngine.play('clicky');
                setRadioVal(opt);
              }}
              className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold border transition ${
                radioVal === opt
                  ? 'bg-white border-[#1C1C1E] shadow-sm'
                  : 'bg-[#F4F3EE] border-transparent text-stone-600'
              }`}
            >
              <span>{opt}</span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  radioVal === opt ? 'border-[#C84B44]' : 'border-stone-400'
                }`}
              >
                {radioVal === opt && <span className="w-2 h-2 rounded-full bg-[#C84B44]" />}
              </span>
            </button>
          ))}
        </div>
      );

    // 8. RATING CONTROL
    case 8:
      return (
        <div className="flex flex-col items-center gap-2 w-full bg-[#F4F3EE] p-3 rounded-2xl">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Keycap3D
                key={n}
                size="sm"
                bg={n <= rating ? '#F2C94C' : '#FFFFFF'}
                lipColor={n <= rating ? '#C49B23' : '#C8C5B8'}
                onClick={() => setRating(n)}
                pitch={n * 25}
              >
                <KeycapFace mood={n <= rating ? 'happy' : 'sleepy'} size="sm" />
              </Keycap3D>
            ))}
          </div>
          <span className="text-[11px] font-extrabold text-stone-500">
            Tactile Satisfaction: {rating} / 5 Keycaps
          </span>
        </div>
      );

    // 9. SEARCH BAR
    case 9:
      return (
        <div className="w-full space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search this jar"
              className="w-full bg-[#EAE8E0] rounded-2xl py-2.5 pl-9 pr-8 text-xs font-bold text-[#1C1C1E] focus:outline-none focus:ring-2 focus:ring-[#1C1C1E]"
            />
            {searchVal && (
              <button
                onClick={() => setSearchVal('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-stone-300 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      );

    // 10. SEGMENTED CONTROL
    case 10:
      return (
        <div className="flex flex-col items-center gap-2.5 w-full">
          <div className="bg-[#EAE8E0] p-1 rounded-full flex items-center text-xs font-extrabold">
            {['AM', 'PM'].map((p) => (
              <button
                key={p}
                onClick={() => {
                  soundEngine.play('thocky');
                  setSegPeriod(p);
                }}
                className={`px-4 py-1 rounded-full transition ${
                  segPeriod === p ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="bg-[#EAE8E0] p-1 rounded-full flex items-center text-xs font-extrabold">
            {['Week', 'Once', 'Date'].map((r) => (
              <button
                key={r}
                onClick={() => {
                  soundEngine.play('thocky');
                  setSegRepeat(r);
                }}
                className={`px-3.5 py-1 rounded-full transition ${
                  segRepeat === r ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-stone-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      );

    // 11. SLIDER
    case 11:
      return (
        <div className="w-full space-y-2 bg-[#1C1C1E] p-3.5 rounded-2xl text-white">
          <div className="flex justify-between text-xs font-extrabold">
            <span>Switch Volume</span>
            <span className="text-[#7CE0D3]">{sliderVal}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={sliderVal}
            onChange={(e) => {
              setSliderVal(Number(e.target.value));
              soundEngine.play('thocky', Number(e.target.value));
            }}
            className="w-full accent-[#7CE0D3] cursor-pointer"
          />
        </div>
      );

    // 12. STEPPER
    case 12:
      return (
        <div className="flex items-center justify-between bg-[#F4F3EE] p-2.5 rounded-2xl w-full">
          <Keycap3D size="sm" onClick={() => setStepperVal((v) => Math.max(5, v - 5))} pitch={-30}>
            <span className="text-base font-black">−</span>
          </Keycap3D>
          <div className="text-center">
            <div className="text-lg font-black">{stepperVal} min</div>
            <div className="text-[10px] font-bold text-stone-400">FOCUS INTERVAL</div>
          </div>
          <Keycap3D size="sm" onClick={() => setStepperVal((v) => v + 5)} pitch={30}>
            <span className="text-base font-black">+</span>
          </Keycap3D>
        </div>
      );

    // 13. SWITCH
    case 13:
      return (
        <div className="flex items-center justify-between bg-[#F4F3EE] p-3 rounded-2xl w-full">
          <div>
            <div className="text-xs font-extrabold">Haptic Keycap Click</div>
            <div className="text-[10px] text-stone-400">Boba U4T stem actuation</div>
          </div>
          <button
            onClick={() => {
              soundEngine.play('thocky');
              setSwitchOn(!switchOn);
            }}
            className={`w-14 h-8 rounded-xl p-1 transition-colors flex items-center ${
              switchOn ? 'bg-[#C84B44] justify-end' : 'bg-stone-300 justify-start'
            }`}
          >
            <div className="w-6 h-6 rounded-lg bg-white shadow-[0_2px_0_rgba(0,0,0,0.2)] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            </div>
          </button>
        </div>
      );

    // 14. TAB
    case 14:
      return (
        <div className="w-full">
          <div className="flex items-center gap-3 border-b border-stone-200 text-[11px] font-extrabold overflow-x-auto">
            {['ORIGINALS', 'CORE', 'CRITTERS', 'SNACKS'].map((t) => (
              <button
                key={t}
                onClick={() => {
                  soundEngine.play('clicky');
                  setActiveTab(t);
                }}
                className={`pb-2 transition ${
                  activeTab === t ? 'text-[#1C1C1E] border-b-2 border-[#1C1C1E]' : 'text-stone-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="pt-2.5 text-xs font-bold text-stone-500">
            Showing 8 keycap characters in <span className="text-[#1C1C1E]">{activeTab}</span>
          </div>
        </div>
      );

    // 15. TEXT FIELD
    case 15:
      return (
        <div className="w-full bg-[#F4F3EE] p-3 rounded-2xl text-center">
          <label className="text-[9px] font-extrabold tracking-widest text-stone-400 block">LABEL</label>
          <input
            type="text"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            className="mt-1 w-full bg-white rounded-xl py-2 px-3 text-center text-xs font-extrabold shadow-sm border border-black/5 focus:outline-none focus:ring-2 focus:ring-[#C84B44]"
          />
        </div>
      );

    // 16. TILE
    case 16:
      return (
        <div className="grid grid-cols-4 gap-1.5 w-full">
          {CHARACTERS.slice(0, 4).map((char) => {
            const active = selectedChar === char.id;
            return (
              <button
                key={char.id}
                onClick={() => {
                  soundEngine.play('poppy');
                  setSelectedChar(char.id);
                }}
                className={`p-2 rounded-2xl flex flex-col items-center gap-1 border-2 transition ${
                  active ? 'bg-white border-[#1C1C1E]' : 'bg-[#F4F3EE] border-transparent'
                }`}
              >
                <div
                  className="w-9 h-8 rounded-lg flex items-center justify-center shadow-[0_2px_0_rgba(0,0,0,0.2)]"
                  style={{ backgroundColor: char.color }}
                >
                  <KeycapFace mood={char.mood} size="sm" />
                </div>
                <span className="text-[9px] font-extrabold">{char.name}</span>
              </button>
            );
          })}
        </div>
      );

    // 17. TIME PICKER
    case 17:
      return (
        <div className="flex items-center justify-between bg-[#F4F3EE] px-5 py-2.5 rounded-2xl w-full">
          <button
            onClick={() => {
              soundEngine.play('clicky');
              setWheelHour((h) => (h % 12) + 1);
            }}
            className="flex flex-col items-center"
          >
            <span className="text-xs font-bold text-stone-300">{String(((wheelHour + 10) % 12) + 1).padStart(2, '0')}</span>
            <span className="text-3xl font-black text-[#C84B44]">{String(wheelHour).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-stone-300">{String((wheelHour % 12) + 1).padStart(2, '0')}</span>
          </button>
          <span className="text-xl font-black text-stone-400">:</span>
          <button
            onClick={() => {
              soundEngine.play('clicky');
              setWheelMin((m) => (m + 5) % 60);
            }}
            className="flex flex-col items-center"
          >
            <span className="text-xs font-bold text-stone-300">{String((wheelMin + 55) % 60).padStart(2, '0')}</span>
            <span className="text-3xl font-black text-[#C84B44]">{String(wheelMin).padStart(2, '0')}</span>
            <span className="text-xs font-bold text-stone-300">{String((wheelMin + 5) % 60).padStart(2, '0')}</span>
          </button>
        </div>
      );

    // 18. BADGE
    case 18:
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-[#EAE8E0] px-3 py-1 rounded-full text-xs font-extrabold">
            <Flame className="w-3.5 h-3.5 fill-[#C84B44] text-[#C84B44]" /> 12
          </span>
          <span className="bg-[#C84B44]/15 text-[#C84B44] px-2.5 py-1 rounded-full text-xs font-extrabold">
            Boba U4T
          </span>
          <span className="bg-[#1C1C1E] text-white px-2.5 py-1 rounded-full text-xs font-extrabold">
            24 Drops
          </span>
          <span className="bg-[#7CE0D3]/30 text-[#103833] px-2.5 py-1 rounded-full text-xs font-extrabold">
            Level 9
          </span>
        </div>
      );

    // 19. BANNER
    case 19:
      return (
        <div className="w-full bg-[#1C1C1E] text-white p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#7CE0D3] flex items-center justify-center">
              <KeycapFace size="sm" />
            </div>
            <div>
              <div className="text-xs font-extrabold">Keep your 12-day streak alive!</div>
              <div className="text-[10px] text-stone-400">Complete 1 Focus session today</div>
            </div>
          </div>
          <Flame className="w-4 h-4 text-[#C84B44] fill-[#C84B44]" />
        </div>
      );

    // 20. CARD
    case 20:
      return (
        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="bg-[#1C1C1E] text-white p-3 rounded-2xl flex flex-col justify-between h-24">
            <span className="text-xs font-extrabold">Focus</span>
            <div className="self-end bg-[#F4F3EE] text-[#1C1C1E] px-2.5 py-1 rounded-lg text-xs font-black rotate-[-6deg]">
              40:00
            </div>
          </div>
          <div className="bg-[#C84B44] text-white p-3 rounded-2xl flex flex-col justify-between h-24">
            <span className="text-[9px] font-extrabold opacity-80">“ QUOTE</span>
            <p className="text-[11px] font-bold leading-tight">Done is a gift you give yourself.</p>
          </div>
        </div>
      );

    // 21. CAROUSEL
    case 21: {
      const sets = [
        { name: 'Kubo Set', sub: 'Warm Retro PBT', bg: '#EAE8E0', key: '#7CE0D3' },
        { name: 'Sakura Set', sub: 'Pastel Blossom', bg: '#FDE8EE', key: '#F3A8BC' },
        { name: 'Sumi Dark', sub: 'Charcoal Stealth', bg: '#1C1C1E', key: '#9B82F3', dark: true },
      ];
      const cur = sets[carouselIdx];
      return (
        <div className="w-full space-y-2">
          <div
            onClick={() => {
              soundEngine.play('thocky');
              setCarouselIdx((i) => (i + 1) % sets.length);
            }}
            style={{ backgroundColor: cur.bg, color: cur.dark ? '#FFF' : '#1C1C1E' }}
            className="p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition"
          >
            <div>
              <div className="text-xs font-extrabold">{cur.name}</div>
              <div className="text-[10px] opacity-60">{cur.sub} • Tap to slide</div>
            </div>
            <div className="w-10 h-9 rounded-xl flex items-center justify-center shadow" style={{ backgroundColor: cur.key }}>
              <KeycapFace size="sm" />
            </div>
          </div>
          <div className="flex justify-center gap-1.5">
            {sets.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${carouselIdx === i ? 'w-4 bg-[#1C1C1E]' : 'w-1.5 bg-stone-300'}`} />
            ))}
          </div>
        </div>
      );
    }

    // 22. CHIP
    case 22:
      return (
        <div className="flex flex-wrap gap-1.5">
          {['All', 'Photos', 'Notes', '10 min', 'Rain on the window'].map((c) => (
            <button
              key={c}
              onClick={() => {
                soundEngine.play('clicky');
                setActiveChip(c);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                activeChip === c ? 'bg-[#1C1C1E] text-white' : 'bg-[#EAE8E0] text-stone-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      );

    // 23. DIVIDER
    case 23:
      return (
        <div className="w-full space-y-3 py-2">
          <div className="h-[1px] bg-stone-200 w-full" />
          <div className="flex items-center gap-2">
            <div className="h-[1px] bg-stone-200 flex-1" />
            <span className="text-[9px] font-extrabold tracking-widest text-stone-400">CTRLSPC ORIGINAL</span>
            <div className="h-[1px] bg-stone-200 flex-1" />
          </div>
        </div>
      );

    // 24. GALLERY
    case 24:
      return (
        <div className="grid grid-cols-3 gap-1.5 w-full">
          <div className="bg-[#C84B44] text-white p-2 rounded-xl text-[9px] font-bold h-16 flex items-end">Quote</div>
          <div className="bg-[#7CE0D3] text-[#103833] p-2 rounded-xl text-[9px] font-bold h-16 flex items-end">0:42 Audio</div>
          <div className="bg-[#F3A8BC] text-[#3D1E26] p-2 rounded-xl text-[9px] font-bold h-16 flex items-end">Sakura</div>
        </div>
      );

    // 25. LOADING INDICATOR
    case 25:
      return (
        <div className="flex items-center justify-center gap-2 py-2">
          {['#F3A8BC', '#7CE0D3', '#F2C94C'].map((c, i) => (
            <div
              key={i}
              style={{ backgroundColor: c, animationDelay: `${i * 150}ms` }}
              className="w-8 h-8 rounded-xl shadow-[0_3px_0_rgba(0,0,0,0.2)] flex items-center justify-center animate-bounce"
            >
              <KeycapFace size="sm" />
            </div>
          ))}
        </div>
      );

    // 26. MAP PIN
    case 26:
      return (
        <div className="flex flex-col items-center py-1">
          <div className="relative bg-[#C84B44] text-white px-3 py-1.5 rounded-2xl shadow-md flex items-center gap-1.5 animate-bounce">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-xs font-extrabold">Lisbon Film Drop</span>
          </div>
          <div className="w-4 h-1.5 bg-black/20 rounded-full mt-1" />
        </div>
      );

    // 27. PROGRESS INDICATOR
    case 27:
      return (
        <div className="flex items-center justify-around w-full">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="24" fill="none" stroke="#EAE8E0" strokeWidth="6" />
              <circle cx="30" cy="30" r="24" fill="none" stroke="#7CE0D3" strokeWidth="6" strokeDasharray="150" strokeDashoffset="38" strokeLinecap="round" />
            </svg>
            <span className="absolute text-[10px] font-black">12:30</span>
          </div>
          <div className="space-y-1 flex-1 max-w-[140px]">
            <div className="flex justify-between text-[10px] font-extrabold">
              <span>Daily Goal</span>
              <span>40 / 45m</span>
            </div>
            <div className="w-full h-2.5 bg-[#EAE8E0] rounded-full overflow-hidden">
              <div className="w-4/5 h-full bg-[#C84B44] rounded-full" />
            </div>
          </div>
        </div>
      );

    // 28. SIDE NAVIGATION
    case 28:
      return (
        <div className="w-full bg-[#1C1C1E] text-white p-2.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CtrlSpcKeycapLogo size="sm" />
            <div className="text-xs font-extrabold">CTRLSPC Rail</div>
          </div>
          <div className="flex gap-1">
            {[Keyboard, Bell, Clock, Archive].map((Icon, i) => (
              <span key={i} className={`p-1.5 rounded-lg ${i === 0 ? 'bg-[#C84B44]' : 'bg-white/10'}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            ))}
          </div>
        </div>
      );

    // 29. SKELETON
    case 29:
      return (
        <div className="w-full bg-[#EAE8E0]/70 p-3 rounded-2xl flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-stone-300" />
          <div className="flex-1 space-y-1.5">
            <div className="w-2/3 h-3 bg-stone-300 rounded" />
            <div className="w-1/2 h-2.5 bg-stone-300 rounded" />
          </div>
        </div>
      );

    // 30. STACKED LIST
    case 30:
      return (
        <div className="w-full space-y-1.5">
          {SWITCH_FAMILIES.slice(1, 3).map((sw) => (
            <div key={sw.id} className="bg-[#F4F3EE] p-2.5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-[#C84B44]" />
                <div>
                  <div className="text-xs font-extrabold">{sw.name}</div>
                  <div className="text-[10px] text-stone-400">{sw.desc}</div>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full">{sw.badge}</span>
            </div>
          ))}
        </div>
      );

    // 31. STATUS DOT
    case 31:
      return (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-[#F4F3EE] px-3 py-1.5 rounded-full text-xs font-extrabold">
            <span className="w-2 h-2 rounded-full bg-[#C84B44] animate-ping" />
            Classic Bell
          </span>
          <span className="inline-flex items-center gap-1.5 bg-[#F4F3EE] px-3 py-1.5 rounded-full text-xs font-extrabold">
            <span className="w-2 h-2 rounded-full bg-[#4CA35A]" />
            Boba Active
          </span>
        </div>
      );

    // 32. TAB BAR
    case 32:
      return (
        <div className="bg-[#1C1C1E] p-1.5 rounded-full flex items-center gap-1 text-white">
          <span className="p-2 rounded-full text-stone-400"><Keyboard className="w-3.5 h-3.5" /></span>
          <span className="p-2 rounded-full text-stone-400"><Bell className="w-3.5 h-3.5" /></span>
          <span className="px-3 py-1.5 rounded-full bg-[#C84B44] text-xs font-extrabold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Focus
          </span>
          <span className="p-2 rounded-full text-stone-400"><Archive className="w-3.5 h-3.5" /></span>
        </div>
      );

    // 33. TABLE
    case 33:
      return (
        <div className="w-full overflow-hidden rounded-xl border border-stone-200 text-[11px]">
          <table className="w-full text-left">
            <thead className="bg-[#EAE8E0] font-extrabold">
              <tr>
                <th className="p-2">Switch</th>
                <th className="p-2">Feel</th>
                <th className="p-2">Force</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-semibold">
              <tr><td className="p-2 font-bold">Boba U4T</td><td className="p-2">Thocky</td><td className="p-2">62g</td></tr>
              <tr><td className="p-2 font-bold">Clicky Blue</td><td className="p-2">Crisp</td><td className="p-2">50g</td></tr>
            </tbody>
          </table>
        </div>
      );

    // 34. TOOLBAR
    case 34:
      return (
        <div className="bg-[#1C1C1E] text-white px-3 py-2 rounded-2xl flex items-center gap-3 shadow-md">
          {[Bold, PenTool, Mic, Tag, Palette].map((Icon, i) => (
            <button
              key={i}
              onClick={() => soundEngine.play('clicky', i * 20)}
              className="hover:text-[#7CE0D3] transition"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      );

    // 35. TOP NAVIGATION BAR
    case 35:
      return (
        <div className="w-full bg-[#F4F3EE] px-3 py-2 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-500">Cancel</span>
          <span className="text-xs font-extrabold tracking-widest">NEW ALARM</span>
          <span className="text-xs font-extrabold text-[#C84B44]">Save</span>
        </div>
      );

    // 36. ACTION SHEET
    case 36:
      return (
        <div className="w-full bg-[#F4F3EE] p-2.5 rounded-2xl space-y-1 text-center">
          <div className="text-[10px] font-extrabold text-stone-400 pb-1">MEMORY DROP OPTIONS</div>
          <button onClick={() => triggerToast('Pinned to iOS Widget!')} className="w-full py-1.5 bg-white rounded-xl text-xs font-bold">Pin to Home Widget</button>
          <button onClick={() => triggerToast('Deleted drop')} className="w-full py-1.5 bg-white rounded-xl text-xs font-extrabold text-[#C84B44]">Delete Drop</button>
        </div>
      );

    // 37. BOTTOM SHEET
    case 37:
      return (
        <div className="w-full bg-[#1C1C1E] text-white p-3 rounded-t-3xl rounded-b-xl flex flex-col items-center">
          <div className="w-9 h-1 bg-white/25 rounded-full mb-2" />
          <span className="text-xs font-extrabold">Draggable Switch Sheet</span>
          <span className="text-[10px] text-stone-400">Swipe up to inspect 18 switches</span>
        </div>
      );

    // 38. COACH MARKS
    case 38:
      return (
        <div className="w-full bg-[#1C1C1E] text-white p-3 rounded-2xl flex items-center gap-3 relative">
          <Keycap3D size="sm" bg="#7CE0D3" lipColor="#4BAE9F">
            <KeycapFace size="sm" />
          </Keycap3D>
          <div className="text-left">
            <div className="text-[10px] font-extrabold text-[#7CE0D3]">TIP 1 OF 3</div>
            <div className="text-xs font-bold">Tap any keycap to test its thock!</div>
          </div>
        </div>
      );

    // 39. DIALOG
    case 39:
      return (
        <div className="w-full bg-[#F4F3EE] p-3 rounded-2xl text-center space-y-2 border border-black/5">
          <div className="text-xs font-extrabold">End Focus Session Early?</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="py-1.5 bg-white rounded-xl text-xs font-bold">Keep going</button>
            <button className="py-1.5 bg-[#C84B44] text-white rounded-xl text-xs font-bold">End early</button>
          </div>
        </div>
      );

    // 40. DRAWER
    case 40:
      return (
        <div className="w-full bg-[#F4F3EE] p-2.5 rounded-2xl flex items-center justify-between">
          <div className="text-xs font-extrabold">Slide-Over Widget Drawer</div>
          <span className="px-2.5 py-1 bg-[#1C1C1E] text-white rounded-lg text-[10px] font-bold">Open Rail →</span>
        </div>
      );

    // 41. DROPDOWN MENU
    case 41:
      return (
        <div className="relative w-full flex flex-col items-center">
          <button
            onClick={() => {
              soundEngine.play('clicky');
              setDropdownOpen(!dropdownOpen);
            }}
            className="bg-[#F4F3EE] px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[#C84B44]" />
            <span>{radioVal}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {dropdownOpen && (
            <div className="mt-1 w-44 bg-white rounded-2xl shadow-lg border border-black/5 p-1 z-10 text-xs font-bold">
              {['Classic Bell', 'Payday Rooster', 'Boba Thock'].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setRadioVal(item);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-[#F4F3EE]"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      );

    // 42. FULL-SCREEN OVERLAY
    case 42:
      return (
        <div className="w-full bg-[#F4F3EE] p-3 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CtrlSpcKeycapLogo size="sm" />
            <span className="text-sm font-black tracking-tight">CTRLSPC<span className="text-[#C84B44]">|</span></span>
          </div>
          <span className="text-[10px] font-extrabold bg-[#EAE8E0] px-2 py-1 rounded-md">Splash View</span>
        </div>
      );

    // 43. TOAST
    case 43:
      return (
        <button
          onClick={() => triggerToast('Sakura applied to your Kubo keyboard!')}
          className="w-full bg-[#1C1C1E] text-white px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 shadow-md"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#7CE0D3]" />
          <span>Trigger Live Toast Notification</span>
        </button>
      );

    // 44. TOOLTIP
    case 44:
      return (
        <div className="flex flex-col items-center">
          <div className="bg-[#1C1C1E] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg mb-1 shadow">
            Boba U4T • 62g Tactile
          </div>
          <Keycap3D size="sm" bg="#F3A8BC" lipColor="#C97A90">
            <KeycapFace size="sm" />
          </Keycap3D>
        </div>
      );

    // 45. AVATAR
    case 45:
      return (
        <div className="flex items-center gap-3">
          {CHARACTERS.slice(0, 3).map((c) => (
            <div key={c.id} className="relative">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.2)]"
                style={{ backgroundColor: c.color }}
              >
                <KeycapFace mood={c.mood} size="sm" />
              </div>
              <span className="w-3 h-3 rounded-full bg-[#4CA35A] border-2 border-white absolute -bottom-0.5 -right-0.5" />
            </div>
          ))}
        </div>
      );

    // 46. ICON
    case 46:
      return (
        <div className="flex items-center gap-2.5 flex-wrap">
          {[Keyboard, Bell, Clock, Archive, Gamepad2, Flame, Volume2].map((Icon, i) => (
            <div key={i} className="w-9 h-9 rounded-xl bg-[#F4F3EE] flex items-center justify-center text-[#1C1C1E]">
              <Icon className="w-4 h-4" />
            </div>
          ))}
        </div>
      );

    // 47. ILLUSTRATION
    case 47:
      return (
        <div className="flex items-center justify-center py-1">
          <BlueBearMascot size={68} animated={false} />
        </div>
      );

    // 48. LOGO
    case 48:
      return (
        <div className="flex items-center gap-3">
          <CtrlSpcKeycapLogo size="md" />
          <div>
            <div className="text-lg font-black tracking-tight">CTRLSPC<span className="text-[#C84B44]">|</span></div>
            <div className="text-[10px] font-bold text-stone-400">3D Sculpted Keycap Mark</div>
          </div>
        </div>
      );

    // 49. PHOTO
    case 49:
      return (
        <div className="w-full bg-[#EAE8E0] p-2.5 rounded-2xl flex items-center gap-3 rotate-[-1deg] hover:rotate-0 transition">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#C84B44] via-[#F4A261] to-[#F2C94C] flex items-end p-1.5 text-[8px] font-black text-white">
            LISBON
          </div>
          <div>
            <div className="text-xs font-extrabold">Memory Jar Polaroid</div>
            <div className="text-[10px] text-stone-500">Dropped 2h ago • 35mm Film</div>
          </div>
        </div>
      );

    default:
      return null;
  }
};

// ============================================================================
// 7. MAIN WORKSPACE APPLICATION
// ============================================================================
export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState('split'); // 'split' | 'kit' | 'app'
  const [activeCategory, setActiveCategory] = useState('All'); // 'All' | 'Control' | 'View' | 'Overlay' | 'Imagery'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeScreen, setActiveScreen] = useState('home');
  const [selectedChar, setSelectedChar] = useState('mint');
  const [selectedSwitch, setSelectedSwitch] = useState('thocky');
  const [volume, setVolume] = useState(0.7);
  const [inspectedComp, setInspectedComp] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const filteredComponents = useMemo(() => {
    return COMPONENT_META.filter((c) => {
      const matchesCat = activeCategory === 'All' || c.category === activeCategory;
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const categoryCounts = {
    All: COMPONENT_META.length,
    Control: COMPONENT_META.filter((c) => c.category === 'Control').length,
    View: COMPONENT_META.filter((c) => c.category === 'View').length,
    Overlay: COMPONENT_META.filter((c) => c.category === 'Overlay').length,
    Imagery: COMPONENT_META.filter((c) => c.category === 'Imagery').length,
  };

  return (
    <div className="min-h-screen bg-[#F4F3EE] text-[#1C1C1E] font-sans selection:bg-[#7CE0D3] selection:text-[#1C1C1E]">
      {/* ================================================================== */}
      {/* TOP STICKY WORKSPACE HEADER                                        */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-40 bg-[#F4F3EE]/90 backdrop-blur-md border-b border-black/5 px-4 lg:px-8 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: CTRLSPC 3D Keycap Logo + Title */}
          <div className="flex items-center gap-3">
            <CtrlSpcKeycapLogo
              size="sm"
              onClick={() => triggerToast('CTRLSPC Tactile Design System v1.0')}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">CTRLSPC</h1>
                <span className="text-[11px] font-extrabold bg-[#1C1C1E] text-white px-2.5 py-0.5 rounded-full">
                  49-Component UI Kit + App
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">
                Tactile 3D PBT Keycap Design System & Personal Space Recreation
              </p>
            </div>
          </div>

          {/* Center: Workspace Mode Switcher */}
          <div className="flex items-center bg-[#EAE8E0] p-1 rounded-2xl border border-black/5">
            {[
              { id: 'split', label: 'Split Studio', icon: Layers },
              { id: 'kit', label: 'UI Kit (49)', icon: Sliders },
              { id: 'app', label: 'Mobile App Preview', icon: Smartphone },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    soundEngine.play('thocky');
                    setWorkspaceMode(mode.id);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    workspaceMode === mode.id
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'text-stone-600 hover:text-[#1C1C1E]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Live Web Audio Mechanical Switch Selector */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 bg-[#EAE8E0] px-3 py-1.5 rounded-2xl text-xs font-bold">
              <Volume2 className="w-4 h-4 text-[#C84B44]" />
              <span className="text-stone-500">Switch Audio:</span>
              <select
                value={selectedSwitch}
                onChange={(e) => {
                  setSelectedSwitch(e.target.value);
                  soundEngine.profile = e.target.value;
                  soundEngine.play(e.target.value);
                }}
                className="bg-transparent font-extrabold text-[#1C1C1E] focus:outline-none cursor-pointer"
              >
                {SWITCH_FAMILIES.map((sw) => (
                  <option key={sw.id} value={sw.id}>
                    {sw.name} {sw.badge ? `(${sw.badge})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* MAIN CONTENT AREA                                                  */}
      {/* ================================================================== */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        <div
          className={`grid gap-8 items-start ${
            workspaceMode === 'split' ? ' grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
          }`}
        >
          {/* LEFT / STICKY COLUMN: INTERACTIVE 393x852 MOBILE APP PREVIEW */}
          {(workspaceMode === 'split' || workspaceMode === 'app') && (
            <div
              className={`${
                workspaceMode === 'split' ? 'xl:col-span-5 xl:sticky xl:top-20' : 'w-full'
              } flex flex-col items-center`}
            >
              <MobileAppPreview
                activeScreen={activeScreen}
                setActiveScreen={setActiveScreen}
                selectedChar={selectedChar}
                setSelectedChar={setSelectedChar}
                selectedSwitch={selectedSwitch}
                setSelectedSwitch={setSelectedSwitch}
                volume={volume}
                setVolume={setVolume}
                triggerToast={triggerToast}
              />
            </div>
          )}

          {/* RIGHT COLUMN: COMPLETE 49-COMPONENT UI KIT CATALOG */}
          {(workspaceMode === 'split' || workspaceMode === 'kit') && (
            <div className={`${workspaceMode === 'split' ? 'xl:col-span-7' : 'w-full'} space-y-6`}>
              {/* Design Token Swatch Banner */}
              <div className="bg-white rounded-[28px] p-5 shadow-sm border border-black/5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#C84B44]">
                      EXTRACTED DESIGN TOKENS
                    </span>
                    <h2 className="text-xl font-black tracking-tight">
                      CTRLSPC Tactile Keycap Palette & Surface System
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {CHARACTERS.map((c) => (
                      <Keycap3D
                        key={c.id}
                        size="xs"
                        bg={c.color}
                        lipColor={c.lip}
                        title={`${c.label} (${c.color})`}
                        onClick={() => {
                          setSelectedChar(c.id);
                          triggerToast(`Selected ${c.label} (${c.color})`);
                        }}
                      >
                        <KeycapFace mood={c.mood} size="sm" />
                      </Keycap3D>
                    ))}
                  </div>
                </div>

                {/* Color Swatch Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  {[
                    { name: 'Warm Cream', hex: '#F4F3EE', bg: '#F4F3EE', text: '#1C1C1E' },
                    { name: 'Matte Charcoal', hex: '#1C1C1E', bg: '#1C1C1E', text: '#FFFFFF' },
                    { name: 'Coral Accent', hex: '#C84B44', bg: '#C84B44', text: '#FFFFFF' },
                    { name: 'Mint Spacebar', hex: '#7CE0D3', bg: '#7CE0D3', text: '#103833' },
                    { name: 'Sakura Pink', hex: '#F3A8BC', bg: '#F3A8BC', text: '#3D1E26' },
                    { name: 'Silo Gold', hex: '#F2C94C', bg: '#F2C94C', text: '#3B2E05' },
                  ].map((s) => (
                    <button
                      key={s.hex}
                      onClick={() => {
                        navigator.clipboard?.writeText(s.hex);
                        soundEngine.play('clicky');
                        triggerToast(`Copied ${s.name}: ${s.hex}`);
                      }}
                      style={{ backgroundColor: s.bg, color: s.text }}
                      className="p-2.5 rounded-2xl border border-black/10 text-left transition hover:scale-[1.02]"
                    >
                      <div className="font-extrabold truncate">{s.name}</div>
                      <div className="text-[10px] opacity-75 font-mono">{s.hex}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter & Search Bar for the 49 Components */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#EAE8E0] p-2 rounded-[24px]">
                <div className="flex flex-wrap items-center gap-1">
                  {['All', 'Control', 'View', 'Overlay', 'Imagery'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        soundEngine.play('thocky');
                        setActiveCategory(cat);
                      }}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-1.5 ${
                        activeCategory === cat
                          ? 'bg-[#1C1C1E] text-white shadow-sm'
                          : 'text-stone-600 hover:text-[#1C1C1E]'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          activeCategory === cat ? 'bg-[#C84B44] text-white' : 'bg-black/10'
                        }`}
                      >
                        {categoryCounts[cat]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter 49 UI components..."
                    className="w-full bg-white rounded-2xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-stone-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Component Cards Grid */}
              <div
                className={`grid gap-4 ${
                  workspaceMode === 'kit'
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2'
                }`}
              >
                {filteredComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-white rounded-[28px] p-4 shadow-sm border border-black/5 flex flex-col justify-between hover:shadow-md transition"
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#EAE8E0] text-[11px] font-black flex items-center justify-center">
                            #{comp.id}
                          </span>
                          <h3 className="text-sm font-black tracking-tight">{comp.name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              comp.category === 'Control'
                                ? 'bg-[#C84B44]/15 text-[#C84B44]'
                                : comp.category === 'View'
                                ? 'bg-[#7CE0D3]/30 text-[#103833]'
                                : comp.category === 'Overlay'
                                ? 'bg-[#9B82F3]/20 text-[#3E2785]'
                                : 'bg-[#F2C94C]/30 text-[#594400]'
                            }`}
                          >
                            {comp.category}
                          </span>
                          <button
                            onClick={() => {
                              soundEngine.play('clicky');
                              navigator.clipboard?.writeText(comp.code);
                              setInspectedComp(comp);
                              triggerToast(`Copied <${comp.name} /> JSX snippet!`);
                            }}
                            title="Inspect & Copy JSX"
                            className="p-1.5 rounded-lg bg-[#F4F3EE] hover:bg-[#1C1C1E] hover:text-white transition"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-relaxed mb-3">{comp.desc}</p>
                    </div>

                    {/* Interactive Live Component Stage */}
                    <div className="min-h-[104px] bg-[#FAF9F6] border border-black/5 rounded-2xl p-3 flex items-center justify-center">
                      <ComponentShowcaseRender
                        comp={comp}
                        triggerToast={triggerToast}
                        selectedChar={selectedChar}
                        setSelectedChar={setSelectedChar}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================================================================== */}
      {/* CODE INSPECTOR MODAL                                               */}
      {/* ================================================================== */}
      {inspectedComp && (
        <div
          onClick={() => setInspectedComp(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1C1C1E] text-white rounded-[32px] max-w-lg w-full p-6 space-y-4 shadow-2xl border border-white/10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#C84B44] text-xs font-black">
                  #{inspectedComp.id} {inspectedComp.category}
                </span>
                <h3 className="text-lg font-black">{inspectedComp.name}</h3>
              </div>
              <button
                onClick={() => setInspectedComp(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-400">{inspectedComp.desc}</p>
            <div className="bg-black/60 p-4 rounded-2xl font-mono text-xs text-[#7CE0D3] overflow-x-auto border border-white/10">
              {inspectedComp.code}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(inspectedComp.code);
                  triggerToast('Copied JSX snippet to clipboard!');
                  setInspectedComp(null);
                }}
                className="px-4 py-2 bg-[#C84B44] rounded-xl text-xs font-extrabold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Snippet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* FLOATING TOAST NOTIFICATION                                        */}
      {/* ================================================================== */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C1C1E] text-white px-4 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-2.5 animate-bounce">
          <div className="w-6 h-6 rounded-lg bg-[#7CE0D3] flex items-center justify-center">
            <KeycapFace size="sm" />
          </div>
          <span className="text-xs font-extrabold">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}