import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./test/globalSetup.ts"],
    include: ["test/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
    // Run test files sequentially in a single fork: they share one Postgres
    // test database and each test cleans up only the organization(s) it
    // created, so nothing about this suite is safe to fan out across
    // parallel workers touching the same rows.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
