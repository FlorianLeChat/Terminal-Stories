import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars( {
    PUBLIC_VERSION: {
        public: true,
        static: true,
        description: "Application version displayed in the footer (set by the CI)",
        schema: ( value ) => value || "0.0.1"
    },
    PUBLIC_ANALYTICS_ENABLED: {
        public: true,
        static: true,
        description: "Whether the analytics scripts are injected into the page (\"true\" to enable)",
        schema: ( value ) => value === "true"
    },
    PUBLIC_ANALYTICS_ENDPOINT: {
        public: true,
        static: true,
        description: "Base URL of the analytics server serving the tracking scripts",
        schema: ( value ) => value
    },
    PUBLIC_ANALYTICS_PROJECT_ID: {
        public: true,
        static: true,
        description: "Website identifier sent to the analytics server",
        schema: ( value ) => value
    },
    PUBLIC_ANALYTICS_RESPECT_DNT: {
        public: true,
        static: true,
        description: "Whether the analytics scripts honor the browser's Do Not Track setting (\"true\" or \"false\")",
        schema: ( value ) => value
    }
} );
