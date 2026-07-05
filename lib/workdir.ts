import os from "os";
import path from "path";

// Persistent output root for downloaded videos, rendered clips and thumbnails.
// IMPORTANT: do NOT use /tmp — macOS purges it on reboot/cleanup, which deletes
// every rendered clip while the DB rows still point at the dead paths (404s / "?" thumbnails).
// This lives under the user's home so clips survive reboots.
export const WORK_DIR =
  process.env.FLOWTILLA_WORK_DIR || path.join(os.homedir(), "FlowTillaData", "work");
