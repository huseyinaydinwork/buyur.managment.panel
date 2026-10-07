import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Most mutations affect several screens at once (lead → pipeline, dashboards,
 * funnel, campaign attribution), so we revalidate the whole app tree.
 */
export function revalidateApp() {
  revalidatePath("/", "layout");
}
