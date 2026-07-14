import type { MusicTheme } from "$lib/types/audio";
import { ensureContext, getAudioContext, getMasterBus, isAudioEnabled, jitter, midiToFrequency } from "$lib/utilities/audioCore";

// Procedural background-music engine. Every theme is a small parameter set
// rather than a track: a lookahead scheduler turns it into an endless piece
// with real long-form structure — a chord progression cycling bar after bar,
// a 16-bar intensity arc (sparse intro, build, peak, breakdown), a melodic
// random walk resolving onto chord tones, optional percussion, and a shared
// stereo echo. This module is internal: it must NOT be re-exported from
// `src/lib/index.ts` — callers go through the `audioEngine.ts` facade.

/** Parameters that fully describe a synthesized music ambiance. */
interface ThemeSpec {
    /** Semitone offsets (relative to the root) forming the melodic pool. */
    readonly scale: number[];
    /** MIDI note number of the root, anchoring the scale in pitch. */
    readonly root: number;
    /** Seconds per beat (one melody slot). */
    readonly step: number;
    /** Oscillator waveform used for the melodic voice. */
    readonly wave: OscillatorType;
    /** Peak gain of a single note, kept low so music stays in the background. */
    readonly noteGain: number;
    /** Maximum warmth lowpass cutoff in hertz (default 2200); the intensity arc opens the filter up to it. */
    readonly brightness?: number;
    /**
     * Whether to add the harmony voice and pad chords (default true). Set false
     * for a clean, single-line theme — clearer, less dense (e.g. the menu).
     */
    readonly layered?: boolean;
    /**
     * Chord progression as semitone offsets from the root, one chord per bar.
     * Bass, pads, and the melodic pool all follow the current chord, giving
     * the loop a real harmonic journey instead of a static drone.
     */
    readonly progression: readonly ( readonly number[] )[];
    /** Whether to add the kick/hat percussion layer at high intensity. */
    readonly percussion?: boolean;
    /** Echo send level in [0, 1] (default 0.2); higher values sound more spacious. */
    readonly echo?: number;
}

// Each progression cycles one chord per bar (4 beats). Offsets are semitones
// from the theme root, so `[ 0, 4, 7 ]` is the major tonic triad.
const THEME_SPECS: Record<MusicTheme, ThemeSpec> = {
    // Neutral, sparse backdrop for stories that declare no specific ambiance.
    // Minor i–VI–iv–VII: present but unobtrusive movement.
    default: {
        scale: [ 0, 3, 5, 7, 10 ],
        root: 50,
        step: 0.62,
        wave: "sine",
        noteGain: 0.06,
        progression: [ [ 0, 3, 7 ], [ 8, 12, 15 ], [ 5, 8, 12 ], [ 10, 14, 17 ] ]
    },
    // Welcoming retro loop for the shell (boot screen and main menu): bright
    // major pentatonic, a lively step, and a wide range for a playful feel.
    // Kept as a clean single line with an open filter so it stays crisp and
    // clear on the home screen rather than muddy. I–IV–V–IV keeps it sunny.
    menu: {
        scale: [ 0, 2, 4, 7, 9, 12 ],
        root: 55,
        step: 0.42,
        wave: "triangle",
        noteGain: 0.05,
        brightness: 5000,
        layered: false,
        progression: [ [ 0, 4, 7 ], [ 5, 9, 12 ], [ 7, 11, 14 ], [ 5, 9, 12 ] ],
        echo: 0.15
    },
    // Bright, open major pentatonic over the classic I–vi–IV–V.
    calm: {
        scale: [ 0, 2, 4, 7, 9 ],
        root: 52,
        step: 0.72,
        wave: "sine",
        noteGain: 0.06,
        progression: [ [ 0, 4, 7 ], [ 9, 12, 16 ], [ 5, 9, 12 ], [ 7, 11, 14 ] ],
        echo: 0.25
    },
    // Low, fast, dissonant — a driving unease. i–bII–i–bV never settles.
    tense: {
        scale: [ 0, 1, 5, 6, 8 ],
        root: 43,
        step: 0.34,
        wave: "sawtooth",
        noteGain: 0.045,
        progression: [ [ 0, 3, 7 ], [ 1, 5, 8 ], [ 0, 3, 7 ], [ 6, 10, 13 ] ],
        percussion: true,
        echo: 0.15
    },
    // Whole-tone haze with no clear resolution: drifting augmented triads.
    mystery: {
        scale: [ 0, 2, 4, 6, 8, 10 ],
        root: 49,
        step: 0.55,
        wave: "triangle",
        noteGain: 0.05,
        progression: [ [ 0, 4, 8 ], [ 2, 6, 10 ], [ 4, 8, 12 ], [ 10, 14, 18 ] ],
        echo: 0.3
    },
    // Slow natural-minor lament over i–VI–III–VII.
    melancholic: {
        scale: [ 0, 2, 3, 7, 8 ],
        root: 45,
        step: 0.85,
        wave: "sine",
        noteGain: 0.06,
        progression: [ [ 0, 3, 7 ], [ 8, 12, 15 ], [ 3, 7, 10 ], [ 10, 14, 17 ] ],
        echo: 0.3
    },
    // Bright, brassy major sixth — adventurous and uplifting, on the epic
    // I–V–vi–IV progression.
    heroic: {
        scale: [ 0, 4, 7, 9, 12 ],
        root: 52,
        step: 0.4,
        wave: "sawtooth",
        noteGain: 0.05,
        progression: [ [ 0, 4, 7 ], [ 7, 11, 14 ], [ 9, 12, 16 ], [ 5, 9, 12 ] ],
        percussion: true,
        echo: 0.2
    },
    // Sparse minor-second/tritone clusters — unsettling and cold; the chords
    // are drifting open shapes rather than functional harmony.
    eerie: {
        scale: [ 0, 1, 6, 7, 11 ],
        root: 44,
        step: 0.95,
        wave: "sine",
        noteGain: 0.05,
        progression: [ [ 0, 7, 12 ], [ 1, 7, 13 ], [ 0, 6, 11 ], [ 1, 6, 8 ] ],
        echo: 0.35
    },
    // Soft lydian shimmer — weightless and oneiric I–II colours.
    dreamy: {
        scale: [ 0, 2, 4, 6, 9, 11 ],
        root: 57,
        step: 0.6,
        wave: "sine",
        noteGain: 0.05,
        progression: [ [ 0, 4, 11 ], [ 2, 6, 9 ], [ 0, 4, 7 ], [ 2, 9, 14 ] ],
        echo: 0.35
    },
    // Fast, driving minor pentatonic riff (i–i–VI–VII) — chases and
    // confrontations, with the full percussion layer.
    action: {
        scale: [ 0, 3, 5, 7, 10 ],
        root: 45,
        step: 0.26,
        wave: "square",
        noteGain: 0.045,
        progression: [ [ 0, 3, 7 ], [ 0, 3, 7 ], [ 8, 12, 15 ], [ 10, 14, 17 ] ],
        percussion: true,
        echo: 0.12
    }
};

// Fade applied when starting or stopping music, in seconds, to avoid clicks.
const MUSIC_FADE = 0.8;

// Lookahead scheduling ("A Tale of Two Clocks" pattern): a coarse timer pump
// schedules every event up to LOOKAHEAD seconds ahead on the sample-accurate
// audio clock. The wide horizon keeps music steady even when background tabs
// throttle timers to one tick per second.
const LOOKAHEAD = 1.5;
const PUMP_INTERVAL_MS = 250;
const BEATS_PER_BAR = 4;

// Long-form intensity arc, one value per bar over a 16-bar cycle (four loops
// of a 4-chord progression): sparse intro, gradual build, peak, breakdown.
// It modulates note density, velocity, octave lifts, harmony, pad level,
// filter brightness, and percussion so the piece breathes over minutes.
const INTENSITY_CURVE = [ 0.2, 0.25, 0.3, 0.35, 0.45, 0.5, 0.6, 0.65, 0.75, 0.85, 0.95, 1, 0.9, 0.7, 0.45, 0.3 ];

// Remembered music request, independent of the enabled flag: toggling sound
// on resumes exactly this theme, toggling off stops it without forgetting it.
let currentTheme: MusicTheme | null = null;

// Live music voice: the fade gain everything music-related passes through,
// every persistent node of the voice graph (for teardown), and the pump timer.
let musicGain: GainNode | null = null;
let musicNodes: AudioNode[] = [];
let musicTimer: ReturnType<typeof setTimeout> | null = null;

// Shared 50 ms white-noise buffer for hi-hats, built once per context.
let hatBuffer: AudioBuffer | null = null;

/**
 * Returns the shared hi-hat noise buffer, (re)building it when missing or
 * when the sample rate changed (i.e. a different context).
 *
 * @param ctx - The live AudioContext.
 * @returns A short white-noise buffer.
 * @author Claude
 */
const ensureHatBuffer = ( ctx: AudioContext ): AudioBuffer =>
{
    const isCurrent = hatBuffer !== null && hatBuffer.sampleRate === ctx.sampleRate;
    if ( isCurrent && hatBuffer ) return hatBuffer;

    const frameCount = Math.ceil( ctx.sampleRate * 0.05 );
    const buffer = ctx.createBuffer( 1, frameCount, ctx.sampleRate );
    const channel = buffer.getChannelData( 0 );
    for ( let i = 0; i < frameCount; i++ ) channel[ i ] = Math.random() * 2 - 1;

    hatBuffer = buffer;

    return buffer;
};

/**
 * Connects a source to a bus through a StereoPannerNode when the browser
 * supports it (Safari < 14.1 does not), falling back to a straight connect.
 *
 * @param ctx - The live AudioContext.
 * @param source - The node to connect.
 * @param bus - The destination bus.
 * @param pan - Stereo position in [-1, 1] (values are clamped).
 * @author Claude
 */
const connectPanned = ( ctx: AudioContext, source: AudioNode, bus: AudioNode, pan: number ): void =>
{
    const canPan = typeof ctx.createStereoPanner === "function";
    if ( !canPan )
    {
        source.connect( bus );
        return;
    }

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.min( 1, Math.max( -1, pan ) );
    source.connect( panner );
    panner.connect( bus );
};

/**
 * Builds the melodic pool for a chord: the theme's scale degrees merged with
 * the chord tones (folded into one octave), duplicated an octave up so the
 * random walk has range while always having the chord's colours available.
 *
 * @param spec - The active theme.
 * @param chord - The current chord as semitone offsets from the root.
 * @returns Sorted semitone offsets spanning two octaves.
 * @author Claude
 */
const buildPool = ( spec: ThemeSpec, chord: readonly number[] ): number[] =>
{
    const degrees = new Set<number>();
    spec.scale.forEach( ( degree ) => degrees.add( degree % 12 ) );
    chord.forEach( ( tone ) => degrees.add( tone % 12 ) );

    const base = [ ...degrees ].sort( ( a, b ) => a - b );

    return [ ...base, ...base.map( ( degree ) => degree + 12 ) ];
};

/**
 * Finds the pool entry closest to `index` whose pitch class belongs to the
 * chord, searching outward in both directions. Used to resolve the melody
 * onto a chord tone on structural beats.
 *
 * @param pool - The current melodic pool.
 * @param index - The walk's current position in the pool.
 * @param chordClasses - The chord tones folded into pitch classes (mod 12).
 * @returns The index of the nearest chord tone (or `index` if none exists).
 * @author Claude
 */
const snapToChordTone = ( pool: number[], index: number, chordClasses: Set<number> ): number =>
{
    for ( let distance = 0; distance < pool.length; distance++ )
    {
        const below = index - distance;
        const above = index + distance;

        const belowIsChordTone = below >= 0 && chordClasses.has( pool[ below ] % 12 );
        if ( belowIsChordTone ) return below;

        const aboveIsChordTone = above < pool.length && chordClasses.has( pool[ above ] % 12 );
        if ( aboveIsChordTone ) return above;
    }

    return index;
};

/**
 * Stops and tears down the live music voice, fading it out to avoid a click.
 * Every persistent node — including the echo's feedback loop, which would
 * otherwise keep its nodes alive forever — is disconnected after the fade.
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

    const ctx = getAudioContext();
    const hasLiveVoice = musicGain !== null && ctx !== null;
    if ( !hasLiveVoice || !musicGain || !ctx ) return;

    const gainToFade = musicGain;
    const nodesToDrop = musicNodes;
    musicGain = null;
    musicNodes = [];

    gainToFade.gain.cancelScheduledValues( ctx.currentTime );
    gainToFade.gain.setTargetAtTime( 0, ctx.currentTime, MUSIC_FADE / 3 );

    // Disconnect the whole chain after the fade so the nodes can be freed.
    globalThis.window.setTimeout( () =>
    {
        nodesToDrop.forEach( ( node ) => node.disconnect() );
    }, MUSIC_FADE * 1000 + 100 );
};

/**
 * Starts the lookahead scheduler for a theme, fading the voice in. Builds the
 * voice graph (melodic bus, warmth filter, percussion bus, stereo echo) and
 * then schedules the piece beat by beat: chord-following bass and pads, a
 * melodic random walk resolving onto chord tones, intensity-gated percussion.
 * Assumes any previous voice has already been stopped.
 *
 * @param theme - The ambiance to synthesize.
 * @author Claude
 */
const startMusicVoice = ( theme: MusicTheme ): void =>
{
    const ctx = ensureContext();
    const master = getMasterBus();
    if ( !ctx || !master ) return;

    const spec = THEME_SPECS[ theme ];
    const maxBrightness = spec.brightness ?? 2200;
    const layered = spec.layered !== false;

    // Fade node: every music node feeds it, so starting, stopping, and
    // cross-fading only ever touch this single gain (echo tails included).
    const voice = ctx.createGain();
    voice.gain.setValueAtTime( 0.0001, ctx.currentTime );
    voice.gain.exponentialRampToValueAtTime( 1, ctx.currentTime + MUSIC_FADE );
    voice.connect( master );

    // Melodic bus → warmth lowpass → voice. The gentle lowpass keeps every
    // ambiance warm and behind the story; the intensity arc opens it up to
    // the theme's brightness at the peak and closes it again after.
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = maxBrightness * 0.7;
    warmth.connect( voice );

    const melodicBus = ctx.createGain();
    melodicBus.connect( warmth );

    // Percussion bypasses the warmth filter, which would smother the hats.
    const percussionBus = ctx.createGain();
    percussionBus.connect( voice );

    // Shared echo: melodic bus → send → delay → voice (pre-fade, so the tail
    // dies with the voice), with a damped feedback loop for a few soft
    // repeats. Created with 2 s of headroom (the default DelayNode max is 1 s).
    const delaySend = ctx.createGain();
    delaySend.gain.value = spec.echo ?? 0.2;
    const delay = ctx.createDelay( 2 );
    delay.delayTime.value = spec.step * 0.75;
    const damp = ctx.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 1800;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;

    melodicBus.connect( delaySend );
    delaySend.connect( delay );
    delay.connect( voice );
    delay.connect( damp );
    damp.connect( feedback );
    feedback.connect( delay );

    musicGain = voice;
    musicNodes = [ voice, warmth, melodicBus, percussionBus, delaySend, delay, damp, feedback ];

    /**
     * Plays a single voiced note (melody, harmony, or bass) into the melodic
     * bus, with a shaped envelope, a touch of detune, and a stereo position.
     *
     * @param midi - The note's MIDI pitch.
     * @param when - Context time to start at.
     * @param gain - Peak gain of the note.
     * @param length - Total length in seconds.
     * @param attackRatio - Fraction of the length spent rising to the peak.
     * @param wave - Waveform override (defaults to the theme's melodic wave).
     * @param pan - Stereo position in [-1, 1] (defaults to center).
     * @author Claude
     */
    const voiceNote = (
        midi: number,
        when: number,
        gain: number,
        length: number,
        attackRatio: number,
        wave: OscillatorType = spec.wave,
        pan = 0
    ): void =>
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
        connectPanned( ctx, env, melodicBus, pan );
        osc.start( when );
        osc.stop( when + length + 0.05 );
    };

    /**
     * Plays the current chord as a soft, sustained pad an octave down, on a
     * slow attack, with a per-note vibrato LFO started and stopped alongside
     * the pad so no oscillator outlives its note.
     *
     * @param when - Context time to start the pad at.
     * @param chord - The chord to voice, as semitone offsets from the root.
     * @param intensity - The current bar's intensity in [0, 1].
     * @author Claude
     */
    const playPad = ( when: number, chord: readonly number[], intensity: number ): void =>
    {
        const padLength = spec.step * 7;
        const padGain = spec.noteGain * 0.3 * ( 0.5 + intensity * 0.7 );

        chord.forEach( ( tone ) =>
        {
            const pad = ctx.createOscillator();
            const padEnv = ctx.createGain();
            pad.type = "sine";
            pad.frequency.value = midiToFrequency( spec.root - 12 + tone );

            // Slow vibrato (a few cents at ~4.5 Hz) keeps the long pad alive.
            const lfo = ctx.createOscillator();
            const lfoDepth = ctx.createGain();
            lfo.type = "sine";
            lfo.frequency.value = jitter( 4.5, 1 );
            lfoDepth.gain.value = 6;
            lfo.connect( lfoDepth );
            lfoDepth.connect( pad.detune );

            padEnv.gain.setValueAtTime( 0.0001, when );
            padEnv.gain.exponentialRampToValueAtTime( padGain, when + spec.step * 1.5 );
            padEnv.gain.exponentialRampToValueAtTime( 0.0001, when + padLength );

            pad.connect( padEnv );
            padEnv.connect( melodicBus );
            pad.start( when );
            pad.stop( when + padLength + 0.05 );
            lfo.start( when );
            lfo.stop( when + padLength + 0.05 );
        } );
    };

    /**
     * Plays a synthesized kick drum: a fast sine pitch-drop with a sharp decay.
     *
     * @param when - Context time to hit at.
     * @author Claude
     */
    const playKick = ( when: number ): void =>
    {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime( 150, when );
        osc.frequency.exponentialRampToValueAtTime( 45, when + 0.12 );

        env.gain.setValueAtTime( 0.0001, when );
        env.gain.exponentialRampToValueAtTime( 0.2, when + 0.005 );
        env.gain.exponentialRampToValueAtTime( 0.0001, when + 0.16 );

        osc.connect( env );
        env.connect( percussionBus );
        osc.start( when );
        osc.stop( when + 0.2 );
    };

    /**
     * Plays a synthesized hi-hat: a 30 ms highpassed white-noise tick.
     *
     * @param when - Context time to hit at.
     * @author Claude
     */
    const playHat = ( when: number ): void =>
    {
        const source = ctx.createBufferSource();
        source.buffer = ensureHatBuffer( ctx );

        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 7000;

        const env = ctx.createGain();
        env.gain.setValueAtTime( 0.05, when );
        env.gain.exponentialRampToValueAtTime( 0.0001, when + 0.03 );

        source.connect( highpass );
        highpass.connect( env );
        env.connect( percussionBus );
        source.start( when );
        source.stop( when + 0.05 );
    };

    // Scheduling state: the beat counter drives bars, chords, and intensity;
    // the pool index is the melodic random walk's position.
    let beat = 0;
    let nextNoteTime = ctx.currentTime + 0.1;
    let pool = buildPool( spec, spec.progression[ 0 ] );
    let poolIndex = Math.floor( pool.length / 2 );

    /**
     * Lays down the harmonic foundation of a beat: on a bar start it rebuilds
     * the melodic pool around the new chord, drops the anchoring bass note, and
     * sweeps the warmth filter to the current intensity; on the mid-bar beat of
     * energetic bars it adds a passing fifth.
     *
     * @param when - Context time of the beat.
     * @param beatInBar - Beat position within the current bar (0..3).
     * @param chord - The bar's chord, as semitone offsets from the root.
     * @param intensity - The current bar's intensity in [0, 1].
     * @author Claude
     */
    const scheduleFoundation = ( when: number, beatInBar: number, chord: readonly number[], intensity: number ): void =>
    {
        const isBarStart = beatInBar === 0;
        if ( isBarStart )
        {
            // The chord changes on the bar: rebuild the walk's pool around it.
            pool = buildPool( spec, chord );
            poolIndex = Math.min( poolIndex, pool.length - 1 );

            // Bass anchors the bar on the chord root, an octave down.
            voiceNote( spec.root + chord[ 0 ] - 12, when, spec.noteGain * 0.9, spec.step * 3.5, 0.15, "sine" );

            // Open the warmth filter with the intensity, closing it back down
            // in the quiet bars — the arc is audible even with eyes closed.
            warmth.frequency.setTargetAtTime( maxBrightness * ( 0.6 + intensity * 0.5 ), when, 0.5 );
        }

        // A passing fifth in the bass halfway through energetic bars.
        const hasBassFifth = beatInBar === 2 && intensity > 0.6;
        if ( hasBassFifth )
        {
            voiceNote( spec.root + chord[ 0 ] - 5, when, spec.noteGain * 0.6, spec.step * 1.5, 0.15, "sine" );
        }
    };

    /**
     * Schedules the percussion layer for a beat, gated by the intensity arc so
     * the drums enter with the build and leave in the breakdown. A no-op for
     * themes without percussion.
     *
     * @param when - Context time of the beat.
     * @param beatInBar - Beat position within the current bar (0..3).
     * @param intensity - The current bar's intensity in [0, 1].
     * @author Claude
     */
    const schedulePercussion = ( when: number, beatInBar: number, intensity: number ): void =>
    {
        if ( !spec.percussion ) return;

        // Kick on beats 1 and 3 once the arc warms up; offbeat hats only near
        // the peak, so percussion enters and leaves with the build.
        const hasKick = ( beatInBar === 0 || beatInBar === 2 ) && intensity >= 0.45;
        if ( hasKick ) playKick( when );

        const hasHat = intensity >= 0.7;
        if ( hasHat ) playHat( when + spec.step / 2 );
    };

    /**
     * Advances the melodic random walk by one step: mostly stepwise motion,
     * the occasional leap, and sometimes holding the same degree, clamped to
     * the pool. Structural beats resolve onto the nearest chord tone.
     *
     * @param beatInBar - Beat position within the current bar (0..3).
     * @param chordClasses - The chord tones folded into pitch classes (mod 12).
     * @author Claude
     */
    const advanceMelodyWalk = ( beatInBar: number, chordClasses: Set<number> ): void =>
    {
        const roll = Math.random();
        if ( roll < 0.7 )
        {
            poolIndex += Math.random() < 0.5 ? -1 : 1;
        }
        else if ( roll < 0.9 )
        {
            const leap = 2 + Math.floor( Math.random() * 2 );
            poolIndex += Math.random() < 0.5 ? -leap : leap;
        }
        poolIndex = Math.max( 0, Math.min( pool.length - 1, poolIndex ) );

        // Downbeats and bar-final beats resolve onto the nearest chord tone,
        // so every bar breathes out on its harmony.
        const isResolutionBeat = beatInBar === 0 || beatInBar === BEATS_PER_BAR - 1;
        if ( isResolutionBeat ) poolIndex = snapToChordTone( pool, poolIndex, chordClasses );
    };

    /**
     * Schedules the melodic line for a beat: an intensity-weighted rest chance,
     * then the walk note (humanized and panned) with an occasional octave lift
     * and a softer companion harmony voice on layered themes.
     *
     * @param when - Context time of the beat.
     * @param beatInBar - Beat position within the current bar (0..3).
     * @param chordClasses - The chord tones folded into pitch classes (mod 12).
     * @param intensity - The current bar's intensity in [0, 1].
     * @author Claude
     */
    const scheduleMelody = ( when: number, beatInBar: number, chordClasses: Set<number>, intensity: number ): void =>
    {
        // Rests thin the melody out in quiet bars but never stretch the beat
        // grid, otherwise chords and percussion would drift off-bar.
        const restProbability = 0.32 - intensity * 0.25;
        const isRest = Math.random() < restProbability;
        if ( isRest ) return;

        advanceMelodyWalk( beatInBar, chordClasses );

        const octaveLiftProbability = 0.08 + intensity * 0.3;
        const octaveLift = Math.random() < octaveLiftProbability ? 12 : 0;
        const melodyMidi = spec.root + pool[ poolIndex ] + octaveLift;
        const velocity = spec.noteGain * ( 0.75 + intensity * 0.4 );

        // Humanize the melody only (bass and percussion stay on the grid) and
        // spread it gently across the stereo field.
        const humanizedWhen = when + jitter( 0, 0.012 );
        const pan = jitter( 0, 0.3 );
        voiceNote( melodyMidi, humanizedWhen, velocity, spec.step, 0.3, spec.wave, pan );

        // A softer companion voice above the melody, panned to the other side,
        // thickening the line as the intensity rises (layered themes only).
        const harmonyProbability = layered ? 0.15 + intensity * 0.35 : 0;
        const hasHarmony = Math.random() < harmonyProbability;
        if ( hasHarmony )
        {
            const harmonyIndex = Math.min( pool.length - 1, poolIndex + 2 );
            voiceNote( spec.root + pool[ harmonyIndex ] + octaveLift, humanizedWhen, velocity * 0.5, spec.step * 0.9, 0.35, spec.wave, -pan );
        }
    };

    /**
     * Schedules every event of one beat at an absolute context time by
     * delegating to the foundation, pad, percussion, and melody layers.
     *
     * @param when - Context time of the beat.
     * @param beatIndex - Absolute beat number since the voice started.
     * @author Claude
     */
    const scheduleBeat = ( when: number, beatIndex: number ): void =>
    {
        const bar = Math.floor( beatIndex / BEATS_PER_BAR );
        const beatInBar = beatIndex % BEATS_PER_BAR;
        const chord = spec.progression[ bar % spec.progression.length ];
        const chordClasses = new Set( chord.map( ( tone ) => tone % 12 ) );
        const intensity = INTENSITY_CURVE[ bar % INTENSITY_CURVE.length ];

        scheduleFoundation( when, beatInBar, chord, intensity );

        const isPadBeat = layered && beatIndex % 8 === 0;
        if ( isPadBeat ) playPad( when, chord, intensity );

        schedulePercussion( when, beatInBar, intensity );
        scheduleMelody( when, beatInBar, chordClasses, intensity );
    };

    /**
     * Timer pump: schedules every beat up to the lookahead horizon on the
     * audio clock, then re-arms itself. Stops silently when sound is disabled
     * or when another voice has replaced this one (theme switch).
     *
     * @author Claude
     */
    const pump = (): void =>
    {
        const isStale = !isAudioEnabled() || musicGain !== voice;
        if ( isStale ) return;

        const horizon = ctx.currentTime + LOOKAHEAD;
        while ( nextNoteTime < horizon )
        {
            scheduleBeat( nextNoteTime, beat );
            nextNoteTime += spec.step;
            beat += 1;
        }

        musicTimer = setTimeout( pump, PUMP_INTERVAL_MS );
    };

    pump();
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
    if ( !isAudioEnabled() ) return;

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

/**
 * Reacts to the master enabled flag changing: disabling stops the live voice
 * (without forgetting the requested theme), enabling resumes that theme.
 *
 * @param nextEnabled - The new enabled state, as already recorded in the core.
 * @author Claude
 */
export const handleEnabledChange = ( nextEnabled: boolean ): void =>
{
    if ( !nextEnabled )
    {
        stopMusicVoice();
        return;
    }

    // Idempotent on purpose: the sound store re-runs setEnabled on every
    // volume change, so this can fire many times in a row while sound is
    // already on. Only spin up a voice when a theme is requested and none is
    // already playing — otherwise repeated calls would stack voices on top of
    // each other (audible as duplication, clipping, and stray restarts).
    const hasLiveVoice = musicGain !== null;
    if ( currentTheme !== null && !hasLiveVoice ) startMusicVoice( currentTheme );
};
