import type { EndingSoundType, SceneSoundEffect } from "$lib/types/audio";
import { isAudioEnabled, jitter, midiToFrequency, playNoise, playTone, setEnabledState } from "$lib/utilities/audioCore";
import { handleEnabledChange } from "$lib/utilities/musicEngine";

// Public audio facade. Every sound (interface SFX and background music) is
// synthesized on the fly with the Web Audio API — the project ships no audio
// files. The low-level context/primitives live in `audioCore.ts` and the
// procedural music engine in `musicEngine.ts`; this module composes the
// one-shot sound effects from the core primitives and re-exports the whole
// public surface (it is the only audio module exposed through `$lib`). It is
// intentionally free of any reactivity or persistence (the sound store layers
// those on top) and of any user-facing string (it speaks only in codes/enums).

export { resumeAudio, setVolume } from "$lib/utilities/audioCore";
export { startMusic, stopMusic } from "$lib/utilities/musicEngine";

/**
 * Enables or disables all audio. Enabling resumes any remembered music theme;
 * disabling silences the master gain and stops the music scheduler.
 *
 * @param next - True to allow sound, false to mute everything.
 * @author Claude
 */
export const setEnabled = ( next: boolean ): void =>
{
    setEnabledState( next );
    handleEnabledChange( next );
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
 * Plays the ending sting when the player reaches a final scene: a short
 * arpeggio whose chord shape encodes the outcome — major (good), minor+low
 * (bad), or open (neutral) — resolving into a sustained final chord so the
 * moment lands instead of cutting off. Good endings sparkle on top, bad ones
 * sink into a sub-bass glide and a dark rumble, neutral ones fade out on a
 * bare open fifth.
 *
 * @param type - The kind of ending reached.
 * @author Claude
 */
export const playEnding = ( type: EndingSoundType ): void =>
{
    if ( !isAudioEnabled() ) return;

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

    // The arpeggio resolves into a sustained closing chord, doubled by a
    // quiet sine an octave down for body.
    const resolutionDelay = chord.intervals.length * 0.14 + 0.1;
    const resolutions: Record<EndingSoundType, number[]> = {
        good: [ 0, 4, 7, 12 ],
        bad: [ 0, 3, 7 ],
        neutral: [ 0, 7 ]
    };

    resolutions[ type ].forEach( ( interval ) =>
    {
        const frequency = midiToFrequency( chord.root + interval );

        playTone( frequency, 2.5, { wave: "triangle", gain: 0.07, delay: resolutionDelay, attack: 0.15, filterFreq: 2400 } );
        playTone( frequency / 2, 2.5, { wave: "sine", gain: 0.04, delay: resolutionDelay, attack: 0.2, filterFreq: 1200 } );
    } );

    if ( type === "good" )
    {
        // A good ending sparkles: an octave-and-fifth ping over the arpeggio,
        // then a swelling add9 colour tone blooming over the final chord.
        playTone( midiToFrequency( chord.root + 19 ), 0.9, {
            wave: "sine",
            gain: 0.08,
            delay: chord.intervals.length * 0.14,
            attack: 0.03,
            filterFreq: 4000
        } );
        playTone( midiToFrequency( chord.root + 14 ), 2.2, {
            wave: "sine",
            gain: 0.05,
            delay: resolutionDelay + 0.4,
            attack: 0.5,
            filterFreq: 4000
        } );
    }

    if ( type === "bad" )
    {
        // A bad ending sinks: a sub-bass glide and a dark noise rumble
        // dragging the final chord downward.
        playTone( 60, 2, { wave: "sine", gain: 0.12, delay: resolutionDelay, glideTo: 38, attack: 0.1, filterFreq: 300 } );
        playNoise( 1.2, { gain: 0.08, delay: resolutionDelay, filterFreq: 300, filterTo: 80 } );
    }
};

/**
 * Plays a warm, bell-like startup fanfare when the app boots — an original
 * homage to the cosy chime of early-2000s desktop operating systems: a soft
 * rising major arpeggio answered an octave higher, a high shimmer swelling
 * over it, all carried by a sustained pad and rounded off by a lowpass.
 *
 * @author Claude
 */
export const playBoot = (): void =>
{
    if ( !isAudioEnabled() ) return;

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

    // Answering phrase an octave up, echoing the motif more softly.
    const answer = [ 77, 81, 84 ];
    answer.forEach( ( midi, index ) =>
    {
        playTone( midiToFrequency( midi ), 1.2, {
            wave: "triangle",
            gain: 0.05,
            delay: 0.8 + index * 0.3,
            attack: 0.04,
            filterFreq: 3600,
            detune: jitter( 0, 6 )
        } );
    } );

    // High sine shimmer swelling in slowly over the whole fanfare.
    const shimmer = [ 84, 88, 91 ];
    shimmer.forEach( ( midi ) =>
    {
        playTone( midiToFrequency( midi ), 2.2, {
            wave: "sine",
            gain: 0.03,
            delay: 0.5,
            attack: 0.4,
            filterFreq: 6000
        } );
    } );

    // Sustained low pad chord swelling underneath for warmth and body.
    const pad = [ 41, 48, 53 ];
    pad.forEach( ( midi ) =>
    {
        playTone( midiToFrequency( midi ), 2.8, {
            wave: "sine",
            gain: 0.05,
            attack: 0.25,
            filterFreq: 1400
        } );
    } );
};

/**
 * Plays a bright, triumphant three-note flourish when an achievement unlocks,
 * layered over whatever ambiance is playing, with a soft trailing echo of the
 * two highest notes.
 *
 * @author Claude
 */
export const playAchievement = (): void =>
{
    if ( !isAudioEnabled() ) return;

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

    // Soft echo of the two highest notes trailing off after the flourish.
    const echoDelay = notes.length * 0.08 + 0.4;
    [ 79, 84 ].forEach( ( midi, index ) =>
    {
        playTone( midiToFrequency( midi ), 0.6, {
            wave: "triangle",
            gain: 0.04,
            delay: echoDelay + index * 0.08,
            attack: 0.02,
            filterFreq: 3800
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
    if ( !isAudioEnabled() ) return;

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
    if ( !isAudioEnabled() ) return;

    switch ( effect )
    {
        case "heartbeat":
            // Three decaying "lub-dub" cycles, like a heart slowly calming.
            for ( let cycle = 0; cycle < 3; cycle++ )
            {
                const base = cycle * 0.8;
                const fade = 1 - cycle * 0.25;
                playTone( 60, 0.22, { wave: "sine", gain: 0.16 * fade, delay: base, attack: 0.01, filterFreq: 200 } );
                playTone( 55, 0.26, { wave: "sine", gain: 0.13 * fade, delay: base + 0.24, attack: 0.01, filterFreq: 200 } );
            }
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
            // A sharp, bright crack right before the dull thud: low noise
            // burst plus a sub-bass drop.
            playNoise( 0.05, { gain: 0.18, filterFreq: 4000, filterTo: 1500 } );
            playNoise( 0.25, { gain: 0.22, delay: 0.02, filterFreq: 900, filterTo: 120 } );
            playTone( 90, 0.28, { wave: "sine", gain: 0.18, delay: 0.02, glideTo: 40, attack: 0.002, filterFreq: 400 } );
            break;

        case "suspense":
            // Two slowly swelling, slightly detuned low drones rising together
            // — the beating between them deepens the creeping dread.
            playTone( 110, 2.4, { wave: "sawtooth", gain: 0.07, glideTo: 175, attack: 0.8, filterFreq: 600 } );
            playTone( 112, 2.4, { wave: "sawtooth", gain: 0.05, glideTo: 172, attack: 0.9, filterFreq: 500 } );
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
            // A long low rumble under an initial sharp crack, answered by a
            // second, more distant rumble rolling in behind it.
            playNoise( 0.12, { gain: 0.24, filterFreq: 5000, filterTo: 800 } );
            playNoise( 1.6, { gain: 0.2, delay: 0.05, filterFreq: 400, filterTo: 90 } );
            playTone( 55, 1.6, { wave: "sine", gain: 0.12, delay: 0.05, glideTo: 32, attack: 0.05, filterFreq: 200 } );
            playNoise( 1.4, { gain: 0.12, delay: 0.9, filterFreq: 300, filterTo: 70 } );
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
            // Two long overlapping gusts with opposing filter sweeps, so the
            // wind rises, crosses over, and dies down again.
            playNoise( 3, { gain: 0.09, filterFreq: 250, filterTo: 700 } );
            playNoise( 2.6, { gain: 0.07, delay: 1.4, filterFreq: 600, filterTo: 200 } );
            break;
    }
};
