// Service worker registration (CON-14). Never throws: every outcome resolves to a status object.
import { isDebug } from './debug.js';

const SW_URL = 'sw.js';
const CACHE_PREFIX = 'crowdblast-';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** @param {string} search @param {string} name */
function hasParam(search, name) {
  return new URLSearchParams(search).has(name);
}

/** Unregisters every service worker of the scope and empties the crowdblast-* caches. */
async function cleanUp(sw, cacheStore) {
  if (sw && typeof sw.getRegistrations === 'function') {
    const registrations = await sw.getRegistrations();
    for (const registration of registrations) {
      try {
        await registration.unregister();
      } catch (_err) {
        // Ignore one failing registration; the others still get removed.
      }
    }
  }
  if (cacheStore && typeof cacheStore.keys === 'function') {
    const names = await cacheStore.keys();
    for (const name of names) {
      if (name.startsWith(CACHE_PREFIX)) await cacheStore.delete(name);
    }
  }
}

/** Calls cb once the update has been installed while a previous worker controls the page. */
function watchUpdates(registration, sw, cb) {
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && sw.controller) cb();
    });
  });
}

/**
 * Registers sw.js (relative path) only in a secure context, and on localhost only with ?sw.
 * In ?debug, never registers: it unregisters existing workers and clears crowdblast-* caches
 * instead, without reloading the page.
 * @param {{ nav?: Navigator, loc?: Location, isSecureContext?: boolean, caches?: CacheStorage }} [deps]
 * @returns {Promise<{ status: string, reason: string, onUpdateReady: (cb: () => void) => void }>}
 */
export async function registerServiceWorker(deps = {}) {
  const nav = deps.nav ?? globalThis.navigator;
  const loc = deps.loc ?? globalThis.location;
  const secure = deps.isSecureContext ?? globalThis.isSecureContext;
  const cacheStore = deps.caches ?? globalThis.caches;
  const sw = nav && nav.serviceWorker;
  const search = (loc && loc.search) || '';
  const result = (status, reason) => ({ status, reason, onUpdateReady: () => {} });

  try {
    if (isDebug(search)) {
      await cleanUp(sw, cacheStore);
      return result('debug', 'debug mode: no service worker, existing ones removed');
    }
    if (!secure) return result('skipped', 'insecure context');
    if (!sw || typeof sw.register !== 'function') return result('skipped', 'unsupported');
    const localHost = !!loc && LOCAL_HOSTS.includes(loc.hostname);
    if (localHost && !hasParam(search, 'sw')) return result('skipped', 'localhost without ?sw');

    const registration = await sw.register(SW_URL);
    return {
      status: 'registered',
      reason: '',
      onUpdateReady: (cb) => {
        if (typeof cb === 'function') watchUpdates(registration, sw, cb);
      },
    };
  } catch (err) {
    return result('error', String((err && err.message) || err));
  }
}
