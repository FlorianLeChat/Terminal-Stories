import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig( {
    plugins: [
        sveltekit(),
        tailwindcss(),
        paraglideVitePlugin( {
            outdir: "./src/lib/locales",
            project: "./locales/.inlang",
            strategy: [ "preferredLanguage", "baseLocale" ]
        } )
    ]
} );
