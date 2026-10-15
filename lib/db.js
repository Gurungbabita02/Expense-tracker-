// Data-access layer (MongoDB). Every query below is scoped by userId.
import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';
import { DEFAULT_CATS, DEFAULT_SETTINGS } from './categories';
import { occurrence, firstIndexAfter, addDays } from './dates';

export const dupKey = (e) => e?.code === 11000;
export const oid = (id) => (typeof id === 'string' && ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null);
const strip = ({ _id, userId, ...rest }) => ({ id: _id.toString(), ...rest });

async function ready() {
  const db = await getDb();
  if (!global._pwIndexes) {
    const c = (n) => db.collection(n);
    global._pwIndexes = Promise.all([
      c('users').createIndex({ email: 1 }, { unique: true }),
      c('transactions').createIndex({ userId: 1, date: -1 }),
      // a recurring rule can never create the same occurrence twice, even if two tabs race
      c('transactions').createIndex({ recurringId: 1, date: 1 }, { unique: true, partialFilterExpression: { recurringId: { $type: 'string' } } }),
      c('categories').createIndex({ userId: 1, type: 1, key: 1 }, { unique: true }),
      c('accounts').createIndex({ userId: 1, createdAt: 1 }),
      c('accounts').createIndex({ userId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } }),
      c('goals').createIndex({ userId: 1, createdAt: 1 }),
      c('recurring').createIndex({ userId: 1, nextDate: 1 }),
      c('budgets').createIndex({ userId: 1, month: 1 }, { unique: true }),
    ]).catch((e) => { global._pwIndexes = null; throw e; });
  }
  await global._pwIndexes;
  return db;
}
const col = async (name) => (await ready()).collection(name);

/* ---------- users ---------- */
export async function createUser({ name, email, passwordHash }) {
  const doc = { name, email, passwordHash, budgets: {}, settings: { ...DEFAULT_SETTINGS }, createdAt: new Date() };
  const { insertedId } = await (await col('users')).insertOne(doc); // throws code 11000 on duplicate email
  return { _id: insertedId, ...doc };
}
export async function findUserByEmail(email) {
  return (await col('users')).findOne({ email });
}
export async function findUserById(id) {
  const _id = oid(id);
  return _id ? (await col('users')).findOne({ _id }) : null;
}
export async function updateUser(id, set) {
  await (await col('users')).updateOne({ _id: new ObjectId(id) }, { $set: set });
}
export const publicUser = (u) => ({
  id: u._id.toString(), name: u.name, email: u.email, budgets: u.budgets || {},
  settings: { ...DEFAULT_SETTINGS, ...(u.settings || {}) },
});

/* ---------- first-run setup (idempotent) ----------
   Gives a user starter categories and a default account, and moves any transactions saved before
   accounts existed into that account. Safe to call on every request; it only does work once. */
export async function ensureDefaults(userId) {
  if (!global._pwInit) global._pwInit = new Set();
  if (global._pwInit.has(userId)) return;
  const db = await ready();
  const users = db.collection('users');
  const _id = new ObjectId(userId);
  const u = await users.findOne({ _id }, { projection: { initV2: 1 } });
  if (u && !u.initV2) {
    const now = new Date();
    try {
      await db.collection('categories').insertMany(
        DEFAULT_CATS.map((c, i) => ({ userId, key: c.name.toLowerCase(), ...c, archived: false, order: i, createdAt: now })),
        { ordered: false },
      );
    } catch (e) { if (!dupKey(e)) throw e; }
    try {
      await db.collection('accounts').insertOne({ userId, name: 'Main account', type: 'bank', emoji: '🏦', opening: 0, archived: false, isDefault: true, createdAt: now });
    } catch (e) { if (!dupKey(e)) throw e; }
    const acc = await db.collection('accounts').findOne({ userId, isDefault: true });
    await db.collection('transactions').updateMany({ userId, accountId: { $exists: false } }, { $set: { accountId: acc._id.toString() } });
    await users.updateOne({ _id }, { $set: { initV2: true } });
  }
  global._pwInit.add(userId);
}

/* ---------- generic per-user helpers ---------- */
async function listOf(name, userId, sort = { createdAt: 1 }) {
  return (await (await col(name)).find({ userId }).sort(sort).toArray()).map(strip);
}
async function insertOf(name, userId, doc) {
  const full = { ...doc, userId, createdAt: new Date() };
  const { insertedId } = await (await col(name)).insertOne(full);
  return strip({ _id: insertedId, ...full });
}
async function patchOf(name, userId, id, set, unset) {
  const _id = oid(id);
  if (!_id) return null;
  const update = { $set: set };
  if (unset && Object.keys(unset).length) update.$unset = unset;
  const r = await (await col(name)).findOneAndUpdate({ _id, userId }, update, { returnDocument: 'after' });
  return r ? strip(r) : null;
}
async function removeOf(name, userId, id) {
  const _id = oid(id);
  if (!_id) return false;
  return (await (await col(name)).deleteOne({ _id, userId })).deletedCount === 1;
}
async function getOf(name, userId, id) {
  const _id = oid(id);
  const d = _id && (await (await col(name)).findOne({ _id, userId }));
  return d ? strip(d) : null;
}

/* ---------- categories ---------- */
export const listCategories = (userId) => listOf('categories', userId, { order: 1, createdAt: 1 });
export const getCategory = (userId, id) => getOf('categories', userId, id);
export async function createCategory(userId, v) {
  const order = await (await col('categories')).countDocuments({ userId });
  return insertOf('categories', userId, { ...v, archived: false, order });
}
export async function updateCategory(userId, id, v, old) {
  const r = await patchOf('categories', userId, id, v);
  if (r && v.name && v.name !== old.name) {
    // keep history, recurring rules and budgets pointing at the renamed category
    await (await col('transactions')).updateMany({ userId, cat: old.name, type: old.type }, { $set: { cat: v.name } });
    await (await col('recurring')).updateMany({ userId, cat: old.name, type: old.type }, { $set: { cat: v.name } });
    if (old.type === 'expense') {
      await (await col('budgets')).updateMany({ userId, [`limits.${old.name}`]: { $exists: true } }, { $rename: { [`limits.${old.name}`]: `limits.${v.name}` } });
    }
  }
  return r;
}
export async function setCategoryArchived(userId, id, archived) {
  return patchOf('categories', userId, id, { archived });
}
export async function categoryInUse(userId, c) {
  const q = { userId, cat: c.name, type: c.type };
  return (await (await col('transactions')).countDocuments(q, { limit: 1 })) + (await (await col('recurring')).countDocuments(q, { limit: 1 })) > 0;
}
export const deleteCategory = (userId, id) => removeOf('categories', userId, id);

/* ---------- accounts ---------- */
export const listAccounts = (userId) => listOf('accounts', userId);
export const getAccount = (userId, id) => getOf('accounts', userId, id);
export const createAccount = (userId, v) => insertOf('accounts', userId, { ...v, archived: false });
export const updateAccount = (userId, id, v) => patchOf('accounts', userId, id, v);
export const setAccountArchived = (userId, id, archived) => patchOf('accounts', userId, id, { archived });
export async function accountInUse(userId, id) {
  const q = { userId, $or: [{ accountId: id }, { toAccountId: id }] };
  return (await (await col('transactions')).countDocuments(q, { limit: 1 })) + (await (await col('recurring')).countDocuments(q, { limit: 1 })) > 0;
}
export const deleteAccount = (userId, id) => removeOf('accounts', userId, id);

/* ---------- goals ---------- */
export const listGoals = (userId) => listOf('goals', userId);
export const createGoal = (userId, v) => insertOf('goals', userId, v);
export const updateGoal = (userId, id, v) => patchOf('goals', userId, id, v);
export async function deleteGoal(userId, id) {
  const ok = await removeOf('goals', userId, id);
  if (ok) { // savings stay in the user's history as general savings
    await (await col('transactions')).updateMany({ userId, goalId: id }, { $unset: { goalId: '' } });
    await (await col('recurring')).updateMany({ userId, goalId: id }, { $unset: { goalId: '' } });
  }
  return ok;
}

/* ---------- transactions ---------- */
export async function listTransactions(userId, { type, q, month, accountId } = {}) {
  const c = await col('transactions');
  const filter = { userId };
  if (type) filter.type = type;
  if (accountId) filter.accountId = accountId;
  if (month && /^\d{4}-\d{2}$/.test(month)) filter.date = { $regex: '^' + month };
  if (q) { const r = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }; filter.$or = [{ note: r }, { cat: r }]; }
  return (await c.find(filter).sort({ date: -1, _id: -1 }).toArray()).map(strip);
}
export async function createTransaction(userId, data) {
  const { insertedId } = await (await col('transactions')).insertOne({ ...data, userId });
  return { id: insertedId.toString(), ...data };
}
export async function updateTransaction(userId, id, data) {
  const unset = {};
  for (const k of ['goalId', 'toAccountId']) if (!(k in data)) unset[k] = '';
  return patchOf('transactions', userId, id, data, unset);
}
export const deleteTransaction = (userId, id) => removeOf('transactions', userId, id);

/* ---------- recurring rules ---------- */
export const listRecurring = (userId) => listOf('recurring', userId, { nextDate: 1 });
export const getRecurring = (userId, id) => getOf('recurring', userId, id);
export const createRecurring = (userId, v) => insertOf('recurring', userId, { ...v, n: 0, nextDate: v.startDate, lastDate: null });
export async function updateRecurring(userId, id, v, old) {
  const set = { ...v };
  const unset = {};
  for (const k of ['goalId', 'toAccountId']) if (!(k in v)) unset[k] = '';
  if (v.frequency !== old.frequency || v.startDate !== old.startDate) {
    // schedule changed: continue from the first new-schedule date after the last one already created
    const n = old.lastDate ? firstIndexAfter(v.startDate, v.frequency, old.lastDate) : 0;
    set.n = n; set.nextDate = occurrence(v.startDate, v.frequency, n);
  }
  return patchOf('recurring', userId, id, set, unset);
}
export async function setRecurringActive(userId, id, active, old, today) {
  const set = { active };
  if (active && !old.active) { // resuming: skip what was missed while paused
    const n = firstIndexAfter(old.startDate, old.frequency, today, true);
    set.n = Math.max(n, old.n); set.nextDate = occurrence(old.startDate, old.frequency, set.n);
  }
  return patchOf('recurring', userId, id, set);
}
export const deleteRecurring = (userId, id) => removeOf('recurring', userId, id);

// Turns every rule that is due (nextDate <= today) into real transactions. Idempotent.
export async function runRecurring(userId, today) {
  const rules = await (await col('recurring')).find({ userId, active: true, nextDate: { $lte: today } }).toArray();
  const txs = await col('transactions');
  const rc = await col('recurring');
  let created = 0;
  for (const r of rules) {
    let { n, nextDate } = r, lastDate = r.lastDate, guard = 0, active = true;
    while (nextDate <= today && guard++ < 400) {
      if (r.endDate && nextDate > r.endDate) break;
      const doc = { userId, type: r.type, cat: r.cat, amt: r.amt, note: r.note, date: nextDate, accountId: r.accountId, recurringId: r._id.toString() };
      if (r.goalId) doc.goalId = r.goalId;
      if (r.toAccountId) doc.toAccountId = r.toAccountId;
      try { await txs.insertOne(doc); created++; } catch (e) { if (!dupKey(e)) throw e; }
      lastDate = nextDate; n += 1; nextDate = occurrence(r.startDate, r.frequency, n);
    }
    if (r.endDate && nextDate > r.endDate) active = false;
    await rc.updateOne({ _id: r._id }, { $set: { n, nextDate, lastDate, active } });
  }
  return created;
}

/* ---------- budgets (one snapshot per month; a month with no snapshot inherits the latest earlier one) ---------- */
export async function budgetFor(userId, month) {
  return (await col('budgets')).findOne({ userId, month: { $lte: month } }, { sort: { month: -1 } });
}
export async function saveBudget(userId, month, limits, cap) {
  await (await col('budgets')).updateOne({ userId, month }, { $set: { limits, cap, updatedAt: new Date() } }, { upsert: true });
}
// defaults < legacy per-user budgets < month snapshot
export function resolveLimits(doc, cats, user) {
  const out = {};
  for (const c of cats) if (c.type === 'expense' && !c.archived) out[c.name] = doc?.limits?.[c.name] ?? user.budgets?.[c.name] ?? c.budget ?? 0;
  return out;
}

/* ---------- sample data ---------- */
export async function insertSample(userId, today) {
  const db = await ready();
  if ((await db.collection('transactions').countDocuments({ userId })) > 2000) throw Object.assign(new Error('limit'), { status: 400 });
  const acc = await db.collection('accounts').findOne({ userId, archived: false }, { sort: { createdAt: 1 } });
  const accountId = acc._id.toString();
  const ago = (o) => addDays(today, -o);
  const rows = [[0,'Salary','Monthly salary',85000,'income'],[1,'Food','Biryani & lassi',640,'expense'],[2,'Transport','Cab to office',320,'expense'],[3,'Bills','Electricity bill',2450,'expense'],[4,'Shopping','Sneakers',3999,'expense'],[5,'Freelance','Logo project',12000,'income'],[6,'Fun','Movie night',780,'expense'],[8,'Food','Groceries',2180,'expense'],[9,'Health','Pharmacy',560,'expense'],[11,'Bills','Internet',999,'expense'],[13,'Food','Coffee with team',410,'expense'],[15,'Transport','Fuel',1500,'expense'],[33,'Salary','Monthly salary',85000,'income'],[35,'Food','Groceries',2600,'expense'],[38,'Bills','Electricity bill',2210,'expense'],[41,'Shopping','Headphones',2999,'expense'],[44,'Fun','Weekend trip',4200,'expense']];
  const docs = rows.map((r) => ({ userId, date: ago(r[0]), cat: r[1], note: r[2], amt: r[3], type: r[4], accountId }));
  if ((await db.collection('goals').countDocuments({ userId })) === 0) {
    const mk = async (g) => (await db.collection('goals').insertOne({ ...g, userId, createdAt: new Date() })).insertedId.toString();
    const ef = await mk({ name: 'Emergency fund', emoji: '🛟', target: 150000, targetDate: null, note: '6 months of expenses', kind: 'emergency' });
    const lp = await mk({ name: 'New laptop', emoji: '💻', target: 60000, targetDate: addDays(today, 180), note: '', kind: 'general' });
    docs.push(
      { userId, date: ago(10), cat: 'Savings', note: 'Emergency fund', amt: 15000, type: 'saving', accountId, goalId: ef },
      { userId, date: ago(5), cat: 'Savings', note: 'Laptop fund', amt: 8000, type: 'saving', accountId, goalId: lp },
      { userId, date: ago(40), cat: 'Savings', note: 'Emergency fund', amt: 20000, type: 'saving', accountId, goalId: ef },
    );
  }
  await db.collection('transactions').insertMany(docs);
}
