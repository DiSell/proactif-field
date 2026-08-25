// Minimal ambient typing for the zero-config local test-database fallback
// in globalSetup.ts. The real package ships its own .d.ts, but it's an ESM
// package with an "exports" map that our project's `moduleResolution:
// "node"` can't resolve — bumping that project-wide for one test-only
// dependency isn't worth it, so this declares just the surface we call.
declare module "embedded-postgres" {
  interface EmbeddedPostgresOptions {
    databaseDir: string;
    user?: string;
    password?: string;
    port?: number;
    persistent?: boolean;
  }

  export default class EmbeddedPostgres {
    constructor(options: EmbeddedPostgresOptions);
    initialise(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    createDatabase(name: string): Promise<void>;
  }
}
