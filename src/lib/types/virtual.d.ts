declare module "virtual:catalog"
{
    import type { Catalog } from "#lib/types/catalog.ts";

    /** Lightweight catalog generated at build time by the catalog plugin in `vite.config.ts`. */
    const catalog: Catalog;

    export default catalog;
}
