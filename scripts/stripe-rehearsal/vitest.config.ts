import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({ plugins: [tsconfigPaths()], test: { environment: "node", include: ["scripts/stripe-rehearsal/processor.test.ts"], testTimeout: 3000000, hookTimeout: 30000 } });
