import * as db from '../../../lib/db';
import { route, bad } from '../../../lib/handler';
import { parseSettings } from '../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ u }) => db.publicUser(u).settings);

// PUT { savingsTarget?, rollover?, emergencyMonths? }
export const PUT = route(async ({ uid, u, b }) => {
  const { error, value } = parseSettings(b);
  if (error) return bad(error);
  const settings = { ...db.publicUser(u).settings, ...value };
  await db.updateUser(uid, { settings });
  return settings;
}, { body: true });
