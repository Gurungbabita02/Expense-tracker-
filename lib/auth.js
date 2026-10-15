// Server-only auth helpers (Node runtime): password hashing + current-user lookup
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { COOKIE, verifySession, signSession, cookieOpts, isHttps } from './session';
import { findUserById } from './db';

export const hashPassword = (p) => bcrypt.hash(p, 12);
export const checkPassword = (p, hash) => bcrypt.compare(p, hash);

export async function currentUser() {
  const id = await verifySession(cookies().get(COOKIE)?.value);
  if (!id || !ObjectId.isValid(id)) return null;
  return findUserById(id);
}

export const unauthorized = () => NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

export async function withSession(res, userId, req) {
  res.cookies.set(COOKIE, await signSession(userId), cookieOpts(undefined, isHttps(req)));
  return res;
}

// Tiny in-memory throttle for login attempts (per server instance)
const hits = new Map();
export function throttled(key, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  hits.set(key, arr);
  return arr.length >= max;
}
export const noteFailure = (key) => hits.set(key, [...(hits.get(key) || []), Date.now()]);
export const clearFailures = (key) => hits.delete(key);
