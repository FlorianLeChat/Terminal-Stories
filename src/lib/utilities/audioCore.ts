// Shared low-level audio core. It owns the single AudioContext, the master
// gain + safety-compressor output chain, the enabled/volume state, and the
// tone/noise synthesis primitives every other audio module builds on. This
// module is intentionally free of any reactivity or persistence (the sound
// store layers those on top) and of any user-facing string. It is internal:
// it must NOT be re-exported from `src/lib/index.ts` — the public audio
// surface lives in `audioEngine.ts`.

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Cached preferences mirrored from the sound store. The core never reads
// storage itself; the engine facade pushes the current values in.
let enabled = false;
let volume = 0.5;

/**
 * Whether the Web Audio API is usable in the current runtime. Guards against
 * SSR (no `window`) and older browsers lacking `AudioContext`.
 *
 * @returns True when an AudioContext can be created.
 * @author Claude
 */
const isSupported = (): boolean =>
{
    if ( globalThis.window === undefined ) return false;

    return typeof globalThis.window.AudioContext === "function";
};

/**
 * Lazily creates the shared AudioContext and its output chain (master gain
 * into a gentle compressor), wiring the gain to the current enabled/volume
 * state. The compressor acts as a transparent safety limiter so stacked
 * music layers and effects can never clip the output.
 *
 * @returns The live AudioContext, or null when unavailable.
 * @author Claude
 */
export const ensureContext = (): AudioContext | null =>
{
    if ( !isSupported() ) return null;
    if ( context ) return context;

    context = new AudioContext();

    // Gentle settings: barely touches the normal mix, only tames peaks.
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;
    compressor.connect( context.destination );

    masterGain = context.createGain();
    masterGain.gain.value = enabled ? volume : 0;
    masterGain.connect( compressor );

    return context;
};

/**
 * Returns the already-created AudioContext without creating one. Useful for
 * teardown paths that must never spin up audio as a side effect.
 *
 * @returns The live AudioContext, or null when none exists yet.
 * @author Claude
 */
export const getAudioContext = (): AudioContext | null =>
{
    return context;
};

/**
 * Returns the master gain node every audio source must feed into.
 *
 * @returns The master gain, or null when the context does not exist yet.
 * @author Claude
 */
export const getMasterBus = (): GainNode | null =>
{
    return masterGain;
};

/**
 * Whether sound is currently allowed to play.
 *
 * @returns True when the user has enabled sound.
 * @author Claude
 */
export const isAudioEnabled = (): boolean =>
{
    return enabled;
};

/**
 * Resumes a context suspended by the browser's autoplay policy. Safe to call
 * from any user-gesture handler; a no-op when audio is unsupported.
 *
 * @author Claude
 */
export const resumeAudio = (): void =>
{
    const ctx = ensureContext();
    if ( !ctx ) return;

    const isSuspended = ctx.state === "suspended";
    if ( isSuspended ) void ctx.resume();
};

/**
 * Applies the master volume to the live graph, respecting the enabled flag.
 *
 * @author Claude
 */
const applyMasterGain = (): void =>
{
    if ( !context || !masterGain ) return;

    const target = enabled ? volume : 0;

    // Short ramp instead of a hard set to avoid an audible click on change.
    masterGain.gain.cancelScheduledValues( context.currentTime );
    masterGain.gain.setTargetAtTime( target, context.currentTime, 0.05 );
};

/**
 * Records the enabled flag and applies it to the master gain. Enabling
 * creates the context up front so playback can start immediately. Music
 * reaction (stopping/resuming the theme) is handled by the engine facade.
 *
 * @param next - True to allow sound, false to mute everything.
 * @author Claude
 */
export const setEnabledState = ( next: boolean ): void =>
{
    enabled = next;

    if ( enabled ) ensureContext();

    applyMasterGain();
};

/**
 * Sets the master volume. Takes effect immediately when sound is enabled.
 *
 * @param next - Volume in the [0, 1] range (values are clamped).
 * @author Claude
 */
export const setVolume = ( next: number ): void =>
{
    volume = Math.min( 1, Math.max( 0, next ) );

    applyMasterGain();
};

/** Options tuning a single synthesized tone. */
export interface ToneOptions {
    /** Oscillator waveform (defaults to a square). */
    wave?: OscillatorType;
    /** Peak gain of the tone (defaults to 0.12). */
    gain?: number;
    /** Target pitch in hertz: when set, the tone glides from `frequency` to it. */
    glideTo?: number;
    /** Delay in seconds before the tone starts, for sequencing multi-note SFX. */
    delay?: number;
    /** Attack time in seconds (defaults to a near-instant 0.005 for a click). */
    attack?: number;
    /** Lowpass cutoff in hertz: when set, rounds off harsh harmonics for warmth. */
    filterFreq?: number;
    /** Slight random detune in cents applied to the oscillator, for a livelier tone. */
    detune?: number;
}

/**
 * Plays a single synthesized tone through the master gain. The building block
 * for every interface sound effect. Supports an optional pitch glide, start
 * delay, shaped attack, and a lowpass filter so effects from sharp clicks to
 * warm bells can all be composed from it. No-op when disabled/unsupported.
 *
 * @param frequency - Starting pitch in hertz.
 * @param duration - Length of the tone in seconds.
 * @param options - Waveform, gain, glide, delay, attack, filter, and detune overrides.
 * @author Claude
 */
export const playTone = (
    frequency: number,
    duration: number,
    options: ToneOptions = {}
): void =>
{
    if ( !enabled ) return;

    const ctx = ensureContext();
    if ( !ctx || !masterGain ) return;

    const wave = options.wave ?? "square";
    const peak = options.gain ?? 0.12;
    const delay = options.delay ?? 0;
    const attack = options.attack ?? 0.005;

    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();

    oscillator.type = wave;
    if ( options.detune !== undefined ) oscillator.detune.value = options.detune;

    const start = ctx.currentTime + delay;
    oscillator.frequency.setValueAtTime( frequency, start );

    // Optional pitch glide gives the effect movement instead of a flat blip.
    if ( options.glideTo !== undefined )
    {
        oscillator.frequency.linearRampToValueAtTime( options.glideTo, start + duration );
    }

    // Shaped envelope: configurable attack, then exponential decay to silence.
    envelope.gain.setValueAtTime( 0.0001, start );
    envelope.gain.exponentialRampToValueAtTime( peak, start + attack );
    envelope.gain.exponentialRampToValueAtTime( 0.0001, start + duration );

    // Optional lowpass rounds off harsh edges for a warmer, softer timbre.
    let tail: AudioNode = envelope;
    oscillator.connect( envelope );

    if ( options.filterFreq !== undefined )
    {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = options.filterFreq;
        envelope.connect( filter );
        tail = filter;
    }

    tail.connect( masterGain );

    oscillator.start( start );
    oscillator.stop( start + duration + 0.05 );
};

/**
 * Plays a burst of filtered white noise — the basis for non-pitched effects
 * such as impacts and whooshes. No-op when audio is disabled/unsupported.
 *
 * @param duration - Length of the burst in seconds.
 * @param options - Peak gain, delay, lowpass cutoff, and optional cutoff glide.
 * @author Claude
 */
export const playNoise = (
    duration: number,
    options: { gain?: number; delay?: number; filterFreq?: number; filterTo?: number } = {}
): void =>
{
    if ( !enabled ) return;

    const ctx = ensureContext();
    if ( !ctx || !masterGain ) return;

    const peak = options.gain ?? 0.1;
    const delay = options.delay ?? 0;
    const start = ctx.currentTime + delay;

    // Fill a short buffer with white noise, played once.
    const frameCount = Math.ceil( ctx.sampleRate * duration );
    const buffer = ctx.createBuffer( 1, frameCount, ctx.sampleRate );
    const channel = buffer.getChannelData( 0 );
    for ( let i = 0; i < frameCount; i++ ) channel[ i ] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime( options.filterFreq ?? 1200, start );

    // Optional cutoff sweep turns a flat hiss into a whoosh/impact.
    if ( options.filterTo !== undefined )
    {
        filter.frequency.exponentialRampToValueAtTime( options.filterTo, start + duration );
    }

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime( peak, start );
    envelope.gain.exponentialRampToValueAtTime( 0.0001, start + duration );

    source.connect( filter );
    filter.connect( envelope );
    envelope.connect( masterGain );

    source.start( start );
    source.stop( start + duration + 0.05 );
};

/**
 * Returns a value randomly picked within `±spread` of `base`. Used to give
 * repeated sounds a touch of variation so they feel less robotic.
 *
 * @param base - The central value.
 * @param spread - The maximum deviation in either direction.
 * @returns A value in `[base - spread, base + spread]`.
 * @author Claude
 */
export const jitter = ( base: number, spread: number ): number =>
{
    return base + ( Math.random() * 2 - 1 ) * spread;
};

/**
 * Converts a MIDI note number to its frequency in hertz.
 *
 * @param midi - The MIDI note number (69 = A4 = 440 Hz).
 * @returns The corresponding frequency in hertz.
 * @author Claude
 */
export const midiToFrequency = ( midi: number ): number =>
{
    return 440 * Math.pow( 2, ( midi - 69 ) / 12 );
};
