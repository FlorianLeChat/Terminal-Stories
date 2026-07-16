import { stories, storiesMeta } from "$lib/data";
import { knowledgeEntries } from "$lib/data/knowledge";
import { genreLabel } from "$lib/utilities/genre";
import type { StoryMeta } from "$lib/types/story";
import type { KnowledgeEntry } from "$lib/types/knowledge";

/**
 * Normalizes text for indexing: lowercase and strip diacritics so
 * "Forêt" and "foret" are treated as identical tokens.
 *
 * @param text - The raw text to normalize.
 * @returns The normalized string.
 * @author Claude
 */
const normalizeText = ( text: string ): string =>
    text.toLowerCase().normalize( "NFD" ).replace( /[̀-ͯ]/g, "" );

/**
 * Splits normalized text into tokens of at least two characters.
 * Splits on any non-alphanumeric run so punctuation and spaces are ignored.
 *
 * @param text - The text to tokenize.
 * @returns An array of lowercase, accent-free tokens.
 * @author Claude
 */
const tokenize = ( text: string ): string[] =>
    normalizeText( text )
        .split( /[^a-z0-9]+/ )
        .filter( ( t ) => t.length >= 2 );

/** A document field ready for scoring: its tokens paired with their weight. */
type ScoredField = [ tokens: string[], weight: number ];

/**
 * Builds a weighted, pre-tokenized field from raw text. Tokenizing here (once,
 * when the search doc cache is built) keeps {@link scoreFields} allocation-free
 * on the hot path, where it runs for every document on every keystroke.
 *
 * @param text - The raw field text.
 * @param weight - The relative importance of the field in the final score.
 * @returns The field's tokens paired with its weight.
 * @author Claude
 */
const scoredField = ( text: string, weight: number ): ScoredField =>
{
    return [ tokenize( text ), weight ];
};

/**
 * Scores a document's weighted, pre-tokenized fields against a list of query
 * tokens. A doc token matches a query token when the doc token starts with it,
 * enabling partial-word queries (e.g. "rev" matches "revenant").
 *
 * @param fields - Pairs of [tokens, weight] describing the document.
 * @param queryTokens - The normalized query tokens to match against.
 * @returns The total match score; 0 means no match at all.
 * @author Claude
 */
const scoreFields = (
    fields: ScoredField[],
    queryTokens: string[]
): number =>
{
    if ( queryTokens.length === 0 ) return 0;

    let score = 0;

    for ( const [ docTokens, weight ] of fields )
    {
        for ( const qt of queryTokens )
        {
            for ( const dt of docTokens )
            {
                if ( dt.startsWith( qt ) )
                {
                    score += weight;
                }
            }
        }
    }

    return score;
};

// ── Story docs ────────────────────────────────────────────────────────────────

interface StorySearchDoc {
    meta: StoryMeta;
    fields: ScoredField[];
}

let _storyDocs: StorySearchDoc[] | null = null;

/**
 * Lazily builds and caches the story search documents.
 * Includes full-story character names (not present in StoryMeta) by
 * cross-referencing the bundled story list.
 *
 * @returns The list of story search documents.
 * @author Claude
 */
const getStorySearchDocs = (): StorySearchDoc[] =>
{
    if ( _storyDocs ) return _storyDocs;

    _storyDocs = storiesMeta.map( ( meta ) =>
    {
        const full = stories.find( ( s ) => s.id === meta.id );
        const characterNames = full
            ? full.characters.map( ( c ) => c.name ).join( " " )
            : "";

        return {
            meta,
            fields: [
                scoredField( meta.title, 3 ),
                scoredField( meta.universe, 2 ),
                scoredField( genreLabel( meta.genre ), 2 ),
                scoredField( characterNames, 2 ),
                scoredField( meta.description, 1 )
            ]
        };
    } );

    return _storyDocs;
};

// ── Wiki docs ─────────────────────────────────────────────────────────────────

interface WikiSearchDoc {
    entry: KnowledgeEntry;
    fields: ScoredField[];
}

let _wikiDocs: WikiSearchDoc[] | null = null;

/**
 * Lazily builds and caches the wiki entry search documents.
 *
 * @returns The list of wiki entry search documents.
 * @author Claude
 */
const getWikiSearchDocs = (): WikiSearchDoc[] =>
{
    if ( _wikiDocs ) return _wikiDocs;

    _wikiDocs = knowledgeEntries.map( ( entry ) =>
    {
        const aliases = entry.aliases?.join( " " ) ?? "";
        const desc = Array.isArray( entry.description )
            ? entry.description.join( " " )
            : entry.description;

        return {
            entry,
            fields: [
                scoredField( entry.name, 3 ),
                scoredField( aliases, 3 ),
                scoredField( entry.summary, 2 ),
                scoredField( entry.universe, 1 ),
                scoredField( desc, 1 )
            ]
        };
    } );

    return _wikiDocs;
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Searches stories by relevance. Returns an empty array when the query is blank
 * (callers fall back to `filterStories` in that case).
 * Genre and language filters are applied by the caller on the returned list.
 *
 * @param query - The search query, raw and unnormalized.
 * @returns Story metas sorted by descending relevance score.
 * @author Claude
 */
export const searchStories = ( query: string ): StoryMeta[] =>
{
    const tokens = tokenize( query );

    if ( tokens.length === 0 ) return [];

    return getStorySearchDocs()
        .map( ( doc ) => ( { meta: doc.meta, score: scoreFields( doc.fields, tokens ) } ) )
        .filter( ( { score } ) => score > 0 )
        .sort( ( a, b ) => b.score - a.score )
        .map( ( { meta } ) => meta );
};

/**
 * Searches wiki entries by relevance across all categories.
 * Returns an empty array when the query is blank.
 * Language and universe filters are applied by the caller on the returned list.
 *
 * @param query - The search query, raw and unnormalized.
 * @returns Knowledge entries sorted by descending relevance score.
 * @author Claude
 */
export const searchWikiEntries = ( query: string ): KnowledgeEntry[] =>
{
    const tokens = tokenize( query );

    if ( tokens.length === 0 ) return [];

    return getWikiSearchDocs()
        .map( ( doc ) => ( { entry: doc.entry, score: scoreFields( doc.fields, tokens ) } ) )
        .filter( ( { score } ) => score > 0 )
        .sort( ( a, b ) => b.score - a.score )
        .map( ( { entry } ) => entry );
};
