import { writable, get } from "svelte/store";
import type { GameState, Story, Scene, Choice, StoryFilters } from "$lib/types/story";
import type { KnowledgeCategory, WikiState } from "$lib/types/knowledge";
import { getStory, storiesMeta, filterStories, availableGenres, availableLanguages } from "$lib/data";
import { categories, filterEntries, getEntry } from "$lib/data/knowledge";

export type TerminalView = "boot" | "menu" | "story-info" | "story" | "wiki";

interface TerminalStore {
    view: TerminalView;
    selectedStoryIndex: number;
    filters: StoryFilters;
    gameState: GameState | null;
    currentStory: Story | null;
    lines: TerminalLine[];
    awaitingInput: boolean;
    wiki: WikiState;
}

export interface TerminalLine {
    id: number;
    text: string;
    type:
      | "system"
      | "narrator"
      | "speaker"
      | "choice"
      | "action"
      | "consequence"
      | "ending"
      | "error"
      | "title"
      | "separator";
    speaker?: string;
    choiceIndex?: number;
}

let lineId = 0;

function nextId()
{
    return ++lineId;
}

function getAvailableChoices( scene: Scene, state: GameState ): Choice[]
{
    return scene.choices.filter( ( c ) =>
    {
        return !( c.requiresFlag && !state.flags.has( c.requiresFlag ) );
    } );
}

function createTerminalStore()
{
    const initial: TerminalStore = {
        view: "boot",
        selectedStoryIndex: 0,
        filters: { genre: null, language: null },
        gameState: null,
        currentStory: null,
        lines: [],
        awaitingInput: false,
        wiki: { category: "universe", universe: null, selectedIndex: 0, selectedEntryId: null }
    };

    const { subscribe, update } = writable<TerminalStore>( initial );

    function visibleStories()
    {
        return filterStories( storiesMeta, get( { subscribe } ).filters );
    }

    function addLine( line: Omit<TerminalLine, "id"> )
    {
        update( ( s ) => ( { ...s, lines: [ ...s.lines, { ...line, id: nextId() } ] } ) );
    }

    function addLines( newLines: Omit<TerminalLine, "id">[] )
    {
        update( ( s ) => ( {
            ...s,
            lines: [ ...s.lines, ...newLines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
        } ) );
    }

    function clearLines()
    {
        update( ( s ) => ( { ...s, lines: [] } ) );
    }

    function startMenu()
    {
        clearLines();
        update( ( s ) => ( { ...s, view: "menu", selectedStoryIndex: 0, awaitingInput: true } ) );
    }

    function setFilter( key: keyof StoryFilters, value: string | null )
    {
        update( ( s ) =>
        {
            const next = s.filters[ key ] === value ? null : value;

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: 0 };
        } );
    }

    function cycleFilter( key: keyof StoryFilters, values: string[] )
    {
        update( ( s ) =>
        {
            const cycle = [ null, ...values ];
            const idx = cycle.indexOf( s.filters[ key ] );
            const next = cycle[ ( idx + 1 ) % cycle.length ];

            return { ...s, filters: { ...s.filters, [ key ]: next }, selectedStoryIndex: 0 };
        } );
    }

    function cycleGenre()
    {
        cycleFilter( "genre", availableGenres );
    }

    function cycleLanguage()
    {
        cycleFilter( "language", availableLanguages );
    }

    function clearFilters()
    {
        update( ( s ) => ( { ...s, filters: { genre: null, language: null }, selectedStoryIndex: 0 } ) );
    }

    function selectStory( id: string )
    {
        const story = getStory( id );
        if ( !story ) return;

        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "story-info",
            currentStory: story,
            awaitingInput: true
        } ) );

        addLines( [
            { text: "═".repeat( 60 ), type: "separator" },
            { text: story.title, type: "title" },
            { text: `${ story.genre } — ${ story.universe }`, type: "system" },
            { text: "─".repeat( 60 ), type: "separator" },
            { text: story.description, type: "narrator" },
            { text: "", type: "narrator" },
            { text: `Personnages : ${ story.characters.map( ( c ) => c.name ).join( ", " ) }`, type: "system" },
            { text: `Tags : ${ story.tags.join( ", " ) }`, type: "system" },
            { text: "═".repeat( 60 ), type: "separator" },
            { text: "[ENTRÉE] Commencer l'histoire   [ÉCHAP] Retour au menu", type: "system" }
        ] );
    }

    function startStory( storyId: string )
    {
        const story = getStory( storyId );
        if ( !story ) return;

        const gameState: GameState = {
            storyId,
            currentScene: story.startScene,
            flags: new Set(),
            history: []
        };

        clearLines();

        update( ( s ) => ( {
            ...s,
            view: "story",
            currentStory: story,
            gameState,
            awaitingInput: true
        } ) );

        renderScene( story, story.startScene, gameState );
    }

    function renderScene( story: Story, sceneId: string, state: GameState )
    {
        const scene = story.scenes[ sceneId ];
        if ( !scene ) return;

        const texts = Array.isArray( scene.text ) ? scene.text : [ scene.text ];
        const lines: Omit<TerminalLine, "id">[] = [];

        lines.push( { text: "─".repeat( 60 ), type: "separator" } );

        if ( scene.speaker )
        {
            const char = story.characters.find( ( c ) => c.id === scene.speaker );
            const name = char ? char.name : scene.speaker;

            lines.push( { text: `[ ${ name } ]`, type: "speaker", speaker: name } );
        }

        for ( const t of texts )
        {
            if ( t === "" )
            {
                lines.push( { text: "", type: "narrator" } );
            }
            else
            {
                lines.push( { text: t, type: scene.isEnding ? "ending" : "narrator" } );
            }
        }

        if ( !scene.isEnding && scene.choices.length > 0 )
        {
            lines.push(
                { text: "", type: "narrator" },
                { text: "> Que faites-vous ?", type: "system" },
                {
                    text: "",
                    type: "narrator"
                }
            );

            const available = getAvailableChoices( scene, state );

            available.forEach( ( choice, i ) =>
            {
                lines.push( {
                    text: `  [${ i + 1 }] ${ choice.text }`,
                    type: "choice",
                    choiceIndex: i + 1
                } );
            } );

            lines.push( { text: "", type: "narrator" }, { text: "[ÉCHAP] Menu principal", type: "system" } );
        }
        else if ( scene.isEnding )
        {
            lines.push( { text: "", type: "narrator" }, { text: "[ENTRÉE] Revenir au menu", type: "system" } );
        }

        update( ( s ) => ( { ...s, lines: [ ...s.lines, ...lines.map( ( l ) => ( { ...l, id: nextId() } ) ) ] } ) );
    }

    function makeChoice( choiceIndex: number )
    {
        const state = get( { subscribe } );
        if ( !state.gameState || !state.currentStory ) return;

        const scene = state.currentStory.scenes[ state.gameState.currentScene ];
        if ( !scene ) return;

        const available = getAvailableChoices( scene, state.gameState );
        const choice = available[ choiceIndex - 1 ];
        if ( !choice ) return;

        const actionLines: Omit<TerminalLine, "id">[] = [
            { text: "", type: "narrator" },
            { text: `> ${ choice.text }`, type: "action" },
            { text: choice.action, type: "action" },
            { text: choice.consequence, type: "consequence" }
        ];

        update( ( s ) =>
        {
            if ( !s.gameState || !s.currentStory ) return s;

            const newFlags = new Set( s.gameState.flags );

            if ( choice.setsFlag ) newFlags.add( choice.setsFlag );

            const newState: GameState = {
                ...s.gameState,
                currentScene: choice.nextScene,
                flags: newFlags,
                history: [ ...s.gameState.history, s.gameState.currentScene ]
            };

            return {
                ...s,
                gameState: newState,
                lines: [ ...s.lines, ...actionLines.map( ( l ) => ( { ...l, id: nextId() } ) ) ]
            };
        } );

        const freshState = get( { subscribe } );

        if ( freshState.currentStory && freshState.gameState )
        {
            renderScene( freshState.currentStory, choice.nextScene, freshState.gameState );
        }
    }

    function goBack()
    {
        update( ( s ) => ( { ...s, view: "menu", currentStory: null, gameState: null } ) );
        startMenu();
    }

    function wikiVisibleEntries()
    {
        const { wiki } = get( { subscribe } );

        return filterEntries( wiki.category, wiki.universe );
    }

    function openWiki()
    {
        clearLines();
        update( ( s ) => ( {
            ...s,
            view: "wiki",
            awaitingInput: true,
            wiki: { ...s.wiki, selectedIndex: 0, selectedEntryId: null }
        } ) );
    }

    function closeWiki()
    {
        update( ( s ) => ( { ...s, view: "menu" } ) );
        startMenu();
    }

    function setWikiCategory( category: KnowledgeCategory )
    {
        update( ( s ) => ( {
            ...s,
            wiki: { ...s.wiki, category, selectedIndex: 0, selectedEntryId: null }
        } ) );
    }

    function cycleWikiCategory( direction: 1 | -1 )
    {
        update( ( s ) =>
        {
            const ids = categories.map( ( c ) => c.id );
            const idx = ids.indexOf( s.wiki.category );
            const next = ids[ ( idx + direction + ids.length ) % ids.length ];

            return { ...s, wiki: { ...s.wiki, category: next, selectedIndex: 0, selectedEntryId: null } };
        } );
    }

    function setWikiUniverse( universe: string | null )
    {
        update( ( s ) =>
        {
            const next = s.wiki.universe === universe ? null : universe;

            return { ...s, wiki: { ...s.wiki, universe: next, selectedIndex: 0, selectedEntryId: null } };
        } );
    }

    function navigateWiki( index: number )
    {
        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedIndex: index } } ) );
    }

    function moveWikiSelection( direction: 1 | -1 )
    {
        const count = wikiVisibleEntries().length;
        if ( count === 0 ) return;

        update( ( s ) => ( {
            ...s,
            wiki: { ...s.wiki, selectedIndex: ( s.wiki.selectedIndex + direction + count ) % count }
        } ) );
    }

    function openWikiEntry( id: string )
    {
        if ( !getEntry( id ) ) return;

        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedEntryId: id } } ) );
    }

    function selectWikiEntryAt( index: number )
    {
        const entries = wikiVisibleEntries();
        const entry = entries[ index ];
        if ( entry ) openWikiEntry( entry.id );
    }

    function backToWikiList()
    {
        update( ( s ) => ( { ...s, wiki: { ...s.wiki, selectedEntryId: null } } ) );
    }

    function openRelatedEntry( id: string )
    {
        const entry = getEntry( id );
        if ( !entry ) return;

        const entries = filterEntries( entry.category, get( { subscribe } ).wiki.universe );
        const idx = entries.findIndex( ( e ) => e.id === id );

        update( ( s ) => ( {
            ...s,
            wiki: {
                ...s.wiki,
                category: entry.category,
                selectedIndex: idx >= 0 ? idx : s.wiki.selectedIndex,
                selectedEntryId: id
            }
        } ) );
    }

    return {
        subscribe,
        update,
        addLine,
        startMenu,
        visibleStories,
        setFilter,
        cycleGenre,
        cycleLanguage,
        clearFilters,
        selectStory,
        startStory,
        makeChoice,
        goBack,
        wikiVisibleEntries,
        openWiki,
        closeWiki,
        setWikiCategory,
        cycleWikiCategory,
        setWikiUniverse,
        navigateWiki,
        moveWikiSelection,
        openWikiEntry,
        selectWikiEntryAt,
        backToWikiList,
        openRelatedEntry
    };
}

export const terminal = createTerminalStore();
