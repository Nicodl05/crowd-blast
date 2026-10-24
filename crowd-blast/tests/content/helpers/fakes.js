// Minimal fakes for DOM, window, navigator and CacheStorage. Used by CONTENT tests only.

/** A DOM-like node that counts textContent writes. */
export function makeFakeNode(tagName) {
  return {
    tagName,
    style: {},
    children: [],
    writes: 0,
    _text: '',
    get textContent() {
      return this._text;
    },
    set textContent(value) {
      this._text = String(value);
      this.writes += 1;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

/** A document with a body and a list of every created element. */
export function makeFakeDoc() {
  const created = [];
  const body = makeFakeNode('body');
  return {
    body,
    created,
    createElement(tag) {
      const node = makeFakeNode(tag);
      created.push(node);
      return node;
    },
  };
}

/** A window with addEventListener and a dispatch helper. */
export function makeFakeWindow() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners[type] || []) fn(event);
    },
    listenerCount(type) {
      return (listeners[type] || []).length;
    },
  };
}

/** A simulated clock: now() returns the time set by advance(). */
export function makeFakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}

/** A service worker registration with a unregister spy and update events. */
export function makeFakeRegistration({ failUnregister = false } = {}) {
  const listeners = {};
  const registration = {
    installing: null,
    unregistered: false,
    unregister: async () => {
      if (failUnregister) throw new Error('unregister failed');
      registration.unregistered = true;
      return true;
    },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    emit(type) {
      for (const fn of listeners[type] || []) fn();
    },
  };
  return registration;
}

/**
 * A navigator-like object. `serviceWorker: null` simulates a browser without service workers.
 * `registerResult` is the registration returned by register(), or an Error to reject with.
 */
export function makeFakeNav({ serviceWorker = true, registrations = [], registerResult = null } = {}) {
  const calls = { register: [] };
  if (!serviceWorker) return { nav: {}, calls };
  const sw = {
    controller: {},
    register: async (url, options) => {
      calls.register.push({ url, options });
      if (registerResult instanceof Error) throw registerResult;
      return registerResult;
    },
    getRegistrations: async () => registrations,
  };
  return { nav: { serviceWorker: sw }, calls };
}

/** A CacheStorage-like object backed by a list of cache names. */
export function makeFakeCaches(names) {
  const deleted = [];
  return {
    deleted,
    keys: async () => [...names],
    delete: async (name) => {
      deleted.push(name);
      const index = names.indexOf(name);
      if (index >= 0) names.splice(index, 1);
      return true;
    },
  };
}
