import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig( {
    plugins: [
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
