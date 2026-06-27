/**
 * Paths shared by headless verification runners.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

export const FIXTURES = join(REPO, "test", "fixtures");
export const SAMPLE_PROJECT = join(FIXTURES, "SampleErd.sqlproj");
export const REAL_PROJECT =
  "/home/gerhard/Projects/Purple/OSConnectWeylandtsDB-master/OSConnectWeylandtsDB.sqlproj";
