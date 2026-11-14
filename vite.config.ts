import { join } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync } from "node:fs";
import { buildCatalog } from "#lib/data/catalog.ts";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import type { StoryFile, KnowledgeBase } from "#lib";

const CATALOG_MODULE_ID = "virtual:catalog";
const RESOLVED_CATALOG_ID = `\0${ CATALOG_MODULE_ID }`;
const DATA_DIRECTORY = join( import.meta.dirname, "src/lib/data" );

/**
 * Serves `virtual:catalog`: the menu metadata, deep-link ids and wiki links
 * computed from every story and knowledge JSON file at build time, so the
 * page chunk carries none of the scene graphs or wiki entries. Each JSON file
 * is registered as a watch dependency, so an edit regenerates the catalog in
 * dev.
 *
 * @returns The Vite plugin.
 * @author Claude
 */
const catalogPlugin = (): Plugin => ( {
    name: "terminal-stories-catalog",
    resolveId( id )
    {
        return id === CATALOG_MODULE_ID ? RESOLVED_CATALOG_ID : undefined;
    },
    load( id )
    {
        if ( id !== RESOLVED_CATALOG_ID ) return undefined;

        const readJsonFiles = <T>( folder: string ): { file: string; content: T }[] =>
        {
            const directory = join( DATA_DIRECTORY, folder );

            return readdirSync( directory )
                .filter( ( file ) => file.endsWith( ".json" ) )
                .sort()
                .map( ( file ) =>
                {
                    const path = join( directory, file );
                    this.addWatchFile( path );

                    return { file, content: JSON.parse( readFileSync( path, "utf8" ) ) as T };
                } );
        };

        const stories = readJsonFiles<StoryFile>( "stories" ).map( ( { file, content } ) => ( { file, story: content } ) );
        const bases = readJsonFiles<KnowledgeBase>( "knowledge" ).map( ( { content } ) => content );

        return `export default ${ JSON.stringify( buildCatalog( stories, bases ) ) };`;
    }
} );

export default defineConfig( {
    plugins: [
        catalogPlugin(),
        sveltekit( {
            adapter: adapter(),
            paths: {
                // @ts-expect-error Needed for GitLab Pages generation.
                base: process.argv.includes( "dev" ) ? "" : process.env.BASE_PATH
            }
        } ),
        tailwindcss(),
        paraglideVitePlugin( {
            outdir: "./src/lib/locales",
            project: "./locales/.inlang",
            strategy: [ "preferredLanguage", "baseLocale" ]
        } )
    ]
} );
