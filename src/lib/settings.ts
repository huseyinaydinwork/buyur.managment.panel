import "server-only";
import { db } from "./db";
import { DEFAULT_STAGE_PROBABILITIES, OPEN_STATUSES } from "./constants";
import { safeJson } from "./utils";

const STAGE_PROB_KEY = "pipeline.stageProbabilities";

export async function getStageProbabilities(): Promise<Record<string, number>> {
  const row = await db.appSetting.findUnique({ where: { key: STAGE_PROB_KEY } });
  const stored = safeJson<Record<string, number>>(row?.value);
  const out: Record<string, number> = {};
  for (const s of OPEN_STATUSES) {
    const v = Number(stored[s]);
    out[s] = Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_STAGE_PROBABILITIES[s]!;
  }
  return out;
}

export async function setStageProbabilities(values: Record<string, number>) {
  await db.appSetting.upsert({
    where: { key: STAGE_PROB_KEY },
    create: { key: STAGE_PROB_KEY, value: JSON.stringify(values) },
    update: { value: JSON.stringify(values) },
  });
}
