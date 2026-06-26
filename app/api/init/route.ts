import { startCleanupCron } from "@/lib/cleanup";

let initialized = false;

export async function GET() {
  if (!initialized) {
    startCleanupCron();
    initialized = true;
  }
  return new Response("ok");
}
