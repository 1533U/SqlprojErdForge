/**
 * CLI entry router — delegates to headless verification runners in src/verify/.
 *
 * Default: Phase 0 fixture spike (P0-5).
 * `--real`: P0-13 discovery smoke test.
 * `--verify-p1`: Phase 1 exit criteria.
 * `--verify-p3`: Phase 3 edit pipeline checks.
 */

import { runFixtures } from "./verify/fixtures.ts";
import { runVerifyP1 } from "./verify/p1.ts";
import { runVerifyP3 } from "./verify/p3.ts";
import { runReal } from "./verify/real.ts";

const args = process.argv.slice(2);
if (args.includes("--verify-p1")) {
  void runVerifyP1();
} else if (args.includes("--verify-p3")) {
  runVerifyP3();
} else if (args.includes("--real")) {
  runReal();
} else {
  runFixtures();
}
