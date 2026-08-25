import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import EmbeddedPostgres from "embedded-postgres";

const apiRoot = path.resolve(__dirname, "..");
const embeddedDataDir = path.join(apiRoot, ".pgtest-data");
const EMBEDDED_PORT = 54329;

let embedded: EmbeddedPostgres | null = null;

// Windows can keep a brief file-lock on a just-stopped Postgres data
// directory, so a plain fs.rmSync right after can throw EBUSY — retry
// briefly instead of failing setup/teardown outright over a scratch dir
// that gets wiped on the next run regardless.
async function removeDirWithRetry(dir: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        console.warn(`Could not remove ${dir} (will be cleaned up on a later run):`, error);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

// Runs once, in the main Vitest process, before any test worker is forked.
// Its only job is making sure tests can never touch the real
// (Neon/production) database, using whichever of these the user set up:
//
//   1. apps/api/.env.test with DATABASE_URL_TEST — an external test
//      database (a separate Neon branch, a shared CI Postgres, ...). Used
//      whenever present; refused if it equals the real DATABASE_URL.
//   2. Nothing configured — falls back to booting a throwaway local
//      Postgres via `embedded-postgres` (no Docker, no install, no admin
//      rights needed) so `npm test` works with zero setup. Stopped and
//      deleted in teardown() below.
//
// process.env set here is inherited by the forked worker that runs the
// actual tests, so config/env.ts (which prefers DATABASE_URL_TEST when
// present) picks it up automatically — see config/env.ts and config/db.ts.
export async function setup(): Promise<void> {
  dotenv.config({ path: path.join(apiRoot, ".env.test") });
  // Fills in anything not already set (JWT_SECRET, PORT, ...) from the real
  // .env — dotenv never overrides a variable that's already set, so a
  // DATABASE_URL_TEST loaded above is never touched by this.
  dotenv.config({ path: path.join(apiRoot, ".env") });

  let testUrl = process.env.DATABASE_URL_TEST;

  if (testUrl) {
    const prodEnvPath = path.join(apiRoot, ".env");
    if (fs.existsSync(prodEnvPath)) {
      const prodValues = dotenv.parse(fs.readFileSync(prodEnvPath));
      if (prodValues.DATABASE_URL && prodValues.DATABASE_URL === testUrl) {
        throw new Error(
          "DATABASE_URL_TEST pointe vers la même base que DATABASE_URL (apps/api/.env). " +
            "Utilise une base Postgres séparée, dédiée aux tests."
        );
      }
    }
  } else {
    await removeDirWithRetry(embeddedDataDir);
    embedded = new EmbeddedPostgres({
      databaseDir: embeddedDataDir,
      user: "postgres",
      password: "postgres",
      port: EMBEDDED_PORT,
      persistent: false,
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("proactif_field_test");
    testUrl = `postgresql://postgres:postgres@127.0.0.1:${EMBEDDED_PORT}/proactif_field_test`;
    process.env.DATABASE_URL_TEST = testUrl;
  }

  const directTestUrl = process.env.DIRECT_URL_TEST ?? testUrl;

  execSync("npx prisma migrate deploy", {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: directTestUrl },
    stdio: "inherit",
  });
}

// Cleanup only — never let anything here fail the test run itself. Every
// path it touches is a disposable scratch directory that the *next* run's
// setup() also wipes before use (removeDirWithRetry, above), so at worst a
// failed cleanup here leaves harmless leftovers, never a false red build.
export async function teardown(): Promise<void> {
  try {
    // Report/plan/photo/document generation writes real files under
    // UPLOAD_DIR (uploads-test/ by default), separate from the real
    // uploads/ directory. DB rows are cleaned per-test via
    // cleanupOrganization, but files on disk aren't, so remove the whole
    // test upload tree here.
    const uploadDir = path.join(apiRoot, process.env.UPLOAD_DIR ?? "uploads-test");
    await removeDirWithRetry(uploadDir);

    if (embedded) {
      await embedded.stop();
      await removeDirWithRetry(embeddedDataDir);
    }
  } catch (error) {
    console.warn("Test teardown cleanup failed (non-fatal):", error);
  }
}
