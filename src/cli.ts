/**
 * CLI entry router — delegates to headless verification runners in src/verify/.
 *
 * Default: Phase 0 fixture spike (P0-5).
 * `--real`: P0-13 discovery smoke test.
 * `--verify-p1`: Phase 1 exit criteria.
 * `--verify-p3`: Phase 3 edit pipeline checks.
 * `--verify-p4`: P4-4 conflict-handling checks.
 * `--verify-format`: P4-1 format-check machinery tests.
 * `--format-check`: P4-1 conformance gate on changed (or `--files`) `.sql` files.
 * `--verify-p014`: P0-14 file-role detection checks.
 * `--verify-dacpac`: P4-2 DACPAC build on fixture `.sqlproj` (requires dotnet).
 */

import { runFormatCheck, runVerifyFormat } from "./verify/format.ts";
import { runVerifyDacpac } from "./verify/dacpac.ts";
import { runVerifyP014 } from "./verify/p014.ts";
import { runFixtures } from "./verify/fixtures.ts";
import { runVerifyP1 } from "./verify/p1.ts";
import { runVerifyP3 } from "./verify/p3.ts";
import { runVerifyP4 } from "./verify/p4.ts";
import { runReal } from "./verify/real.ts";

function parseFormatCheckArgs(argv: string[]): { base?: string; files?: string[] } {
  const options: { base?: string; files?: string[] } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base" && argv[i + 1]) {
      options.base = argv[++i];
    } else if (arg === "--files") {
      options.files = [];
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith("--")) {
        options.files.push(argv[++i]!);
      }
    }
  }
  return options;
}

const args = process.argv.slice(2);
if (args.includes("--verify-p1")) {
  void runVerifyP1();
} else if (args.includes("--verify-p3")) {
  runVerifyP3();
} else if (args.includes("--verify-p4")) {
  runVerifyP4();
} else if (args.includes("--verify-format")) {
  runVerifyFormat();
} else if (args.includes("--verify-p014")) {
  runVerifyP014();
} else if (args.includes("--verify-dacpac")) {
  runVerifyDacpac();
} else if (args.includes("--format-check")) {
  runFormatCheck(parseFormatCheckArgs(args));
} else if (args.includes("--real")) {
  runReal();
} else {
  runFixtures();
}
