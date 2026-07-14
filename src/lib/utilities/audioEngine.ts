import type { EndingSoundType, MusicTheme, SceneSoundEffect } from "$lib/types/audio";

// Low-level audio engine. Every sound (interface SFX and background music) is
// synthesized on the fly with the Web Audio API — the project ships no audio
// files. This module owns the single AudioContext and the master gain; it is
// intentionally free of any reactivity or persistence (the sound store layers
// those on top) and of any user-facing string (it speaks only in codes/enums).

/** Parameters that fully describe a synthesized music ambiance. */
interface ThemeSpec {
    /** Semitone offsets (relative to the root) forming the melodic pool. */
    readonly scale: number[];
    /** MIDI note number of the root, anchoring the scale in pitch. */
    readonly root: number;
    /** Seconds between two successive notes. */
    readonly step: number;
    /** Oscillator waveform used for the melodic voice. */
    readonly wave: OscillatorType;
    /** Peak gain of a single note, kept low so music stays in the background. */
    readonly noteGain: number;
    /** Warmth lowpass cutoff in hertz (default 2200); raise it for a clearer, brighter theme. */
    readonly brightness?: number;
    /**
     * Whether to add the harmony voice and pad chords (default true). Set false
     * for a clean, single-line theme — clearer, less dense (e.g. the menu).
     */
    readonly layered?: boolean;
}

// Each theme is a small parameter set rather than a track: the scheduler below
// turns it into an endless, gently randomized arpeggio so no two loops feel
// identical while the mood stays consistent.
const THEME_SPECS: Record<MusicTheme, ThemeSpec> = {
    // Neutral, sparse backdrop for stories that declare no specific ambiance.
    default: { scale: [ 0, 3, 5, 7, 10 ], root: 50, step: 0.62, wave: "sine", noteGain: 0.06 },
    // Welcoming retro loop for the shell (boot screen and main menu): bright
    // major pentatonic, a lively step, and a wide range for a playful feel.
    // Kept as a clean single line with an open filter so it stays crisp and
    // clear on the home screen rather than muddy.
    menu: { scale: [ 0, 2, 4, 7, 9, 12 ], root: 55, step: 0.42, wave: "triangle", noteGain: 0.05, brightness: 5000, layered: false },
    // Bright, open major pentatonic.
    calm: { scale: [ 0, 2, 4, 7, 9 ], root: 52, step: 0.72, wave: "sine", noteGain: 0.06 },
    // Low, fast, dissonant — a driving unease.
    tense: { scale: [ 0, 1, 5, 6, 8 ], root: 43, step: 0.34, wave: "sawtooth", noteGain: 0.045 },
    // Whole-tone haze with no clear resolution.
    mystery: { scale: [ 0, 2, 4, 6, 8, 10 ], root: 49, step: 0.55, wave: "triangle", noteGain: 0.05 },
    // Slow natural-minor lament.
    melancholic: { scale: [ 0, 2, 3, 7, 8 ], root: 45, step: 0.85, wave: "sine", noteGain: 0.06 },
    // Bright, brassy major sixth — adventurous and uplifting.
    heroic: { scale: [ 0, 4, 7, 9, 12 ], root: 52, step: 0.4, wave: "sawtooth", noteGain: 0.05 },
    // Sparse minor-second/tritone clusters — unsettling and cold.
    eerie: { scale: [ 0, 1, 6, 7, 11 ], root: 44, step: 0.95, wave: "sine", noteGain: 0.05 },
    // Soft lydian shimmer — weightless and oneiric.
    dreamy: { scale: [ 0, 2, 4, 6, 9, 11 ], root: 57, step: 0.6, wave: "sine", noteGain: 0.05 },
    // Fast, driving minor pentatonic — chases and confrontations.
    action: { scale: [ 0, 3, 5, 7, 10 ], root: 45, step: 0.26, wave: "square", noteGain: 0.045 }
};

// Fade applied when starting or stopping music, in seconds, to avoid clicks.
const MUSIC_FADE = 0.8;

let context: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Cached preferences mirrored from the sound store. The engine never reads
// storage itself; setEnabled/setVolume push the current values in.
let enabled = false;
let volume = 0.5;

// Remembered music request, independent of `enabled`: toggling sound on
// resumes exactly this theme, toggling off stops it without forgetting it.
let currentTheme: MusicTheme | null = null;

// Live music voice: its gain node (for fades), the warmth filter it feeds, and
// the pending note timer.
let musicGain: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;

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
 * Lazily creates the shared AudioContext and master gain, wiring the gain to
 * the current enabled/volume state. Returns null when audio is unsupported.
 *
 * @returns The live AudioContext, or null when unavailable.
 * @author Claude
 */
const ensureContext = (): AudioContext | null =>
{
    if ( !isSupported() ) return null;
    if ( context ) return context;

    context = new AudioContext();
    masterGain = context.createGain();
    masterGain.gain.value = enabled ? volume : 0;
    masterGain.connect( context.destination );

    return context;
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
 * Enables or disables all audio. Enabling resumes any remembered music theme;
 * disabling silences the master gain and stops the music scheduler.
 *
 * @param next - True to allow sound, false to mute everything.
 * @author Claude
 */
export const setEnabled = ( next: boolean ): void =>
{
    enabled = next;

    if ( !enabled )
    {
        applyMasterGain();
        stopMusicVoice();
        return;
    }

    // Turning sound on: bring the master gain up and, if a story had requested
    // music while muted, start it now.
    ensureContext();
    applyMasterGain();

    if ( currentTheme ) startMusicVoice( currentTheme );
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
interface ToneOptions {
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
const playTone = (
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
const playNoise = (
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
 * repeated interface sounds a touch of variation so they feel less robotic.
 *
 * @param base - The central value.
 * @param spread - The maximum deviation in either direction.
 * @returns A value in `[base - spread, base + spread]`.
 * @author Claude
 */
const jitter = ( base: number, spread: number ): number =>
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
const midiToFrequency = ( midi: number ): number =>
{
    return 440 * Math.pow( 2, ( midi - 69 ) / 12 );
};

/**
 * Short, low key-press click. The pitch is jittered on every press and given a
 * quick downward glide so rapid typing sounds organic, like a real keyboard,
 * instead of a monotonous repeated beep. A lowpass keeps the click soft, and
 * one press in six is a brighter "clack" for extra variety.
 *
 * @author Claude
 */
export const playKeyPress = (): void =>
{
    const isClack = Math.random() < 0.16;
    const start = jitter( isClack ? 320 : 230, 25 );

    playTone( start, 0.035, {
        wave: "square",
        gain: 0.05,
        glideTo: start * 0.82,
        filterFreq: isClack ? 2600 : 1600
    } );
};

/** Soft blip that glides upward when moving the selection through a list. */
export const playNavigate = (): void =>
{
    const start = jitter( 460, 20 );

    playTone( start, 0.07, { wave: "triangle", gain: 0.07, glideTo: start * 1.3, filterFreq: 3000 } );
};

/**
 * Bright, rising two-note chirp confirming a selection/validation. The pair of
 * ascending notes gives it a satisfying "accept" feel, softened by a lowpass.
 *
 * @author Claude
 */
export const playSelect = (): void =>
{
    playTone( 540, 0.06, { wave: "square", gain: 0.08, filterFreq: 3200 } );
    playTone( 810, 0.1, { wave: "square", gain: 0.07, delay: 0.05, filterFreq: 3600 } );
};

/** Descending two-note blip for back/cancel actions. */
export const playBack = (): void =>
{
    playTone( 480, 0.06, { wave: "triangle", gain: 0.07, filterFreq: 2400 } );
    playTone( 300, 0.09, { wave: "triangle", gain: 0.06, delay: 0.05, filterFreq: 1800 } );
};

/**
 * Plays a short arpeggiated sting when the player reaches an ending. The chord
 * shape encodes the outcome: major (good), minor+low (bad), or open (neutral).
 *
 * @param type - The kind of ending reached.
 * @author Claude
 */
export const playEnding = ( type: EndingSoundType ): void =>
{
    if ( !enabled ) return;

    // Root note and chord intervals chosen to read as uplifting/dark/plain.
    const chords: Record<EndingSoundType, { root: number; intervals: number[] }> = {
        good: { root: 60, intervals: [ 0, 4, 7, 12 ] },
        bad: { root: 48, intervals: [ 0, 3, 6, 10 ] },
        neutral: { root: 57, intervals: [ 0, 5, 7, 12 ] }
    };

    const chord = chords[ type ];

    chord.intervals.forEach( ( interval, index ) =>
    {
        const frequency = midiToFrequency( chord.root + interval );

        // Stagger the notes into a warm, bell-like arpeggio (soft attack, lowpass).
        playTone( frequency, 0.7, {
            wave: "triangle",
            gain: 0.1,
            delay: index * 0.14,
            attack: 0.02,
            filterFreq: 2600
        } );
    } );

    // A good ending resolves with a sparkling octave above the root.
    if ( type === "good" )
    {
        playTone( midiToFrequency( chord.root + 19 ), 0.9, {
            wave: "sine",
            gain: 0.08,
            delay: chord.intervals.length * 0.14,
            attack: 0.03,
            filterFreq: 4000
        } );
    }
};

/**
 * Plays a warm, bell-like startup fanfare when the app boots — an original
 * homage to the cosy chime of early-2000s desktop operating systems: a soft
 * rising major arpeggio over a sustained pad, all rounded off by a lowpass.
 *
 * @author Claude
 */
export const playBoot = (): void =>
{
    if ( !enabled ) return;

    // Rising major arpeggio (F major-ish), played as mellow bells.
    const melody = [ 65, 69, 72, 77 ];
    melody.forEach( ( midi, index ) =>
    {
        playTone( midiToFrequency( midi ), 1.1, {
            wave: "triangle",
            gain: 0.09,
            delay: index * 0.16,
            attack: 0.03,
            filterFreq: 3200,
            detune: jitter( 0, 6 )
        } );
    } );

    // Sustained low pad chord swelling underneath for warmth and body.
    const pad = [ 41, 48, 53 ];
    pad.forEach( ( midi ) =>
    {
        playTone( midiToFrequency( midi ), 1.8, {
            wave: "sine",
            gain: 0.05,
            attack: 0.25,
            filterFreq: 1400
        } );
    } );
};

/**
 * Plays a bright, triumphant three-note flourish when an achievement unlocks,
 * layered over whatever ambiance is playing.
 *
 * @author Claude
 */
export const playAchievement = (): void =>
{
    if ( !enabled ) return;

    // Ascending major triad plus an octave, quick and celebratory.
    const notes = [ 72, 76, 79, 84 ];
    notes.forEach( ( midi, index ) =>
    {
        playTone( midiToFrequency( midi ), 0.5, {
            wave: "triangle",
            gain: 0.09,
            delay: index * 0.08,
            attack: 0.01,
            filterFreq: 4200
        } );
    } );
};

/**
 * Plays a low, dissonant descending "denied" buzz to signal an error or a
 * failed action.
 *
 * @author Claude
 */
export const playError = (): void =>
{
    if ( !enabled ) return;

    // Two close, clashing low tones sliding down together read as "wrong".
    playTone( 200, 0.35, { wave: "sawtooth", gain: 0.08, glideTo: 120, filterFreq: 900 } );
    playTone( 190, 0.35, { wave: "square", gain: 0.06, glideTo: 114, filterFreq: 900 } );
};

/**
 * Fires a one-shot scene sound effect, layered over the background music to
 * punctuate a moment. No-op when audio is disabled/unsupported.
 *
 * @param effect - The effect to synthesize.
 * @author Claude
 */
export const playSceneEffect = ( effect: SceneSoundEffect ): void =>
{
    if ( !enabled ) return;

    switch ( effect )
    {
        case "heartbeat":
            // Two low "lub-dub" thumps.
            playTone( 60, 0.22, { wave: "sine", gain: 0.16, attack: 0.01, filterFreq: 200 } );
            playTone( 55, 0.26, { wave: "sine", gain: 0.13, delay: 0.24, attack: 0.01, filterFreq: 200 } );
            break;

        case "alarm":
            // Three urgent two-tone klaxon cycles.
            for ( let cycle = 0; cycle < 3; cycle++ )
            {
                const base = cycle * 0.34;
                playTone( 740, 0.15, { wave: "sawtooth", gain: 0.08, delay: base, filterFreq: 2000 } );
                playTone( 587, 0.15, { wave: "sawtooth", gain: 0.08, delay: base + 0.17, filterFreq: 2000 } );
            }
            break;

        case "chime":
            // Bright ascending bell arpeggio for a discovery or a good turn.
            [ 76, 81, 84, 88 ].forEach( ( midi, index ) =>
            {
                playTone( midiToFrequency( midi ), 0.6, {
                    wave: "sine",
                    gain: 0.08,
                    delay: index * 0.1,
                    attack: 0.01,
                    filterFreq: 5000
                } );
            } );
            break;

        case "impact":
            // A short, dull thud: low noise burst plus a sub-bass drop.
            playNoise( 0.25, { gain: 0.22, filterFreq: 900, filterTo: 120 } );
            playTone( 90, 0.28, { wave: "sine", gain: 0.18, glideTo: 40, attack: 0.002, filterFreq: 400 } );
            break;

        case "suspense":
            // Slow low drone that swells and rises, for creeping dread.
            playTone( 110, 2.4, { wave: "sawtooth", gain: 0.07, glideTo: 175, attack: 0.8, filterFreq: 600 } );
            break;

        case "glitch":
            // A rapid scatter of random-pitched digital blips.
            for ( let i = 0; i < 7; i++ )
            {
                playTone( jitter( 900, 600 ), 0.05, {
                    wave: "square",
                    gain: 0.06,
                    delay: i * 0.05,
                    filterFreq: 4000
                } );
            }
            break;

        case "whoosh":
            // Noise sweeping open then shut, for a transition or passing rush.
            playNoise( 0.35, { gain: 0.14, filterFreq: 300, filterTo: 3500 } );
            playNoise( 0.35, { gain: 0.12, delay: 0.3, filterFreq: 3500, filterTo: 300 } );
            break;

        case "thunder":
            // A long low rumble under an initial sharp crack.
            playNoise( 0.12, { gain: 0.24, filterFreq: 5000, filterTo: 800 } );
            playNoise( 1.6, { gain: 0.2, delay: 0.05, filterFreq: 400, filterTo: 90 } );
            playTone( 55, 1.6, { wave: "sine", gain: 0.12, delay: 0.05, glideTo: 32, attack: 0.05, filterFreq: 200 } );
            break;

        case "bell":
            // A single resonant toll: fundamental plus inharmonic partials that
            // decay at different rates, the hallmark of a real bell.
            [ { ratio: 1, gain: 0.12, len: 1.6 }, { ratio: 2.76, gain: 0.06, len: 1.1 }, { ratio: 5.4, gain: 0.03, len: 0.7 } ]
                .forEach( ( partial ) =>
                {
                    playTone( 330 * partial.ratio, partial.len, {
                        wave: "sine",
                        gain: partial.gain,
                        attack: 0.005,
                        filterFreq: 6000
                    } );
                } );
            break;

        case "static":
            // A burst of harsh, bright interference (high cutoff = hiss).
            playNoise( 0.6, { gain: 0.1, filterFreq: 6000 } );
            break;

        case "reveal":
            // A quick rising shimmer of bright sines, for an unveiling.
            for ( let i = 0; i < 6; i++ )
            {
                playTone( midiToFrequency( 72 + i * 3 ), 0.7, {
                    wave: "sine",
                    gain: 0.06,
                    delay: i * 0.06,
                    attack: 0.02,
                    filterFreq: 6000
                } );
            }
            break;

        case "wind":
            // A long, soft gust: low-passed noise with a slow swell.
            playNoise( 3, { gain: 0.09, filterFreq: 500, filterTo: 350 } );
            break;
    }
};

/**
 * Stops and tears down the live music voice, fading it out to avoid a click.
 *
 * @author Claude
 */
const stopMusicVoice = (): void =>
{
    if ( musicTimer !== null )
    {
        clearTimeout( musicTimer );
        musicTimer = null;
    }

    if ( musicGain && context )
    {
        const gainToFade = musicGain;
        const filterToDrop = musicFilter;
        musicGain = null;
        musicFilter = null;

        gainToFade.gain.cancelScheduledValues( context.currentTime );
        gainToFade.gain.setTargetAtTime( 0, context.currentTime, MUSIC_FADE / 3 );

        // Disconnect the whole chain after the fade so the nodes can be freed.
        globalThis.window.setTimeout( () =>
        {
            gainToFade.disconnect();
            if ( filterToDrop ) filterToDrop.disconnect();
        }, MUSIC_FADE * 1000 + 100 );
    }
};

/**
 * Starts the endless arpeggio scheduler for a theme, fading the voice in.
 * Assumes any previous voice has already been stopped.
 *
 * @param theme - The ambiance to synthesize.
 * @author Claude
 */
const startMusicVoice = ( theme: MusicTheme ): void =>
{
    const ctx = ensureContext();
    if ( !ctx || !masterGain ) return;

    const spec = THEME_SPECS[ theme ];

    const voice = ctx.createGain();
    voice.gain.setValueAtTime( 0.0001, ctx.currentTime );
    voice.gain.exponentialRampToValueAtTime( 1, ctx.currentTime + MUSIC_FADE );

    // Round the whole voice off with a gentle lowpass so every ambiance stays
    // warm and sits behind the story rather than competing with it. A theme can
    // open the filter up (brightness) to read clearer and crisper.
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = spec.brightness ?? 2200;
    voice.connect( warmth );
    warmth.connect( masterGain );

    musicGain = voice;
    musicFilter = warmth;

    // Counts scheduled beats so bass and pad chords can drop on a regular pulse.
    let beat = 0;

    // Sparse themes (e.g. the menu) skip the harmony voice and pad chords so the
    // melodic line stays clean and clear.
    const layered = spec.layered !== false;

    /**
     * Plays a single voiced note (melody, harmony, bass, or pad) into the warm
     * music bus, with a shaped envelope and a touch of detune for life.
     *
     * @param midi - The note's MIDI pitch.
     * @param when - Context time to start at.
     * @param gain - Peak gain of the note.
     * @param length - Total length in seconds.
     * @param attackRatio - Fraction of the length spent rising to the peak.
     * @param wave - Waveform override (defaults to the theme's melodic wave).
     * @author Claude
     */
    const voiceNote = ( midi: number, when: number, gain: number, length: number, attackRatio: number, wave: OscillatorType = spec.wave ): void =>
    {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = midiToFrequency( midi );
        osc.detune.value = jitter( 0, 7 );

        env.gain.setValueAtTime( 0.0001, when );
        env.gain.exponentialRampToValueAtTime( gain, when + length * attackRatio );
        env.gain.exponentialRampToValueAtTime( 0.0001, when + length * 0.97 );

        osc.connect( env );
        env.connect( voice );
        osc.start( when );
        osc.stop( when + length + 0.05 );
    };

    /**
     * Plays a soft, sustained chord (root, fifth, octave) two octaves down as a
     * harmonic bed under the melody, on a slow attack.
     *
     * @param now - Context time to start the pad at.
     * @author Claude
     */
    const playPad = ( now: number ): void =>
    {
        const padLength = spec.step * 6;
        [ 0, 7, 12 ].forEach( ( interval ) =>
        {
            const pad = ctx.createOscillator();
            const padEnv = ctx.createGain();
            pad.type = "sine";
            pad.frequency.value = midiToFrequency( spec.root - 12 + interval );

            padEnv.gain.setValueAtTime( 0.0001, now );
            padEnv.gain.exponentialRampToValueAtTime( spec.noteGain * 0.3, now + spec.step * 1.5 );
            padEnv.gain.exponentialRampToValueAtTime( 0.0001, now + padLength );

            pad.connect( padEnv );
            padEnv.connect( voice );
            pad.start( now );
            pad.stop( now + padLength + 0.05 );
        } );
    };

    // Recursive self-scheduling loop: play one note, then queue the next. A
    // little randomness in pitch, harmony, and timing keeps the loop alive.
    const scheduleNext = (): void =>
    {
        if ( !enabled || musicGain !== voice ) return;

        const now = ctx.currentTime;

        // A bass note every four beats anchors the melody with a steady pulse;
        // a fuller pad chord every eight beats deepens the harmony underneath.
        if ( beat % 4 === 0 ) voiceNote( spec.root - 12, now, spec.noteGain * 0.9, spec.step * 3.5, 0.15, "sine" );
        if ( layered && beat % 8 === 0 ) playPad( now );
        beat += 1;

        const degree = spec.scale[ Math.floor( Math.random() * spec.scale.length ) ];
        // Occasionally jump up an octave for melodic variety.
        const octaveLift = Math.random() < 0.25 ? 12 : 0;
        const melodyMidi = spec.root + degree + octaveLift;

        voiceNote( melodyMidi, now, spec.noteGain, spec.step, 0.3 );

        // One note in three carries a softer harmony a scale-step above it,
        // thickening the line without muddying the melody (layered themes only).
        const hasHarmony = layered && Math.random() < 0.33;
        if ( hasHarmony )
        {
            const harmonyDegree = spec.scale[ ( spec.scale.indexOf( degree ) + 2 ) % spec.scale.length ];
            voiceNote( spec.root + harmonyDegree + octaveLift, now, spec.noteGain * 0.5, spec.step * 0.9, 0.35 );
        }

        // One-in-five chance of a rest so the melody breathes, plus a small
        // timing jitter so the pulse feels played rather than sequenced.
        const isRest = Math.random() < 0.2;
        const humanize = jitter( 1, 0.08 );
        const delay = spec.step * ( isRest ? 2 : 1 ) * humanize * 1000;

        musicTimer = setTimeout( scheduleNext, delay );
    };

    scheduleNext();
};

/**
 * Requests a background-music ambiance. The request is remembered even while
 * muted, so enabling sound later resumes this exact theme. Switching to a new
 * theme cross-fades; requesting the theme already playing is a no-op.
 *
 * @param theme - The ambiance to play (defaults to `"default"`).
 * @author Claude
 */
export const startMusic = ( theme: MusicTheme = "default" ): void =>
{
    const isSameTheme = currentTheme === theme && musicGain !== null;
    if ( isSameTheme ) return;

    currentTheme = theme;

    // Only touch the audio graph when sound is on; otherwise just remember it.
    if ( !enabled ) return;

    stopMusicVoice();
    startMusicVoice( theme );
};

/**
 * Stops any background music and forgets the remembered theme. Called when the
 * player leaves a story for the menu.
 *
 * @author Claude
 */
export const stopMusic = (): void =>
{
    currentTheme = null;
    stopMusicVoice();
};
