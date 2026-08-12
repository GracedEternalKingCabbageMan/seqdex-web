// window.sequentia glue: detection, connect state, and typed request helpers.
// The site never holds keys; every sensitive call round-trips the extension.

let cachedAccount = null;
const listeners = new Set();

export function hasWallet() {
  return !!(window.sequentia && window.sequentia.isSequentia);
}

export function account() { return cachedAccount; }

export function onAccountChange(fn) { listeners.add(fn); }
function emit() { for (const fn of listeners) { try { fn(cachedAccount); } catch {} } }

export async function request(method, params = {}) {
  if (!hasWallet()) throw new Error('the Sequentia wallet extension is not installed');
  return await window.sequentia.request({ method, params });
}

// Silent session restore: succeeds only if the origin is connected AND the
// wallet is unlocked; never prompts.
export async function restore() {
  if (!hasWallet()) return null;
  try {
    const { accounts } = await request('getAccounts');
    cachedAccount = accounts && accounts[0] ? accounts[0] : null;
  } catch { cachedAccount = null; }
  emit();
  return cachedAccount;
}

// Explicit connect (prompts once per origin; doubles as unlock when locked).
export async function connect() {
  cachedAccount = await request('connect');
  emit();
  return cachedAccount;
}

export function watchEvents() {
  if (!hasWallet()) return;
  window.sequentia.on('accountsChanged', () => { restore(); });
  window.sequentia.on('disconnect', () => { cachedAccount = null; emit(); });
}

// ---- typed helpers over the raw protocol ----
export const getBalances = () => request('getBalances');
export const getUtxos = (asset) => request('getUtxos', asset ? { asset } : {});
export const lnChannels = () => request('lnChannels');
export const lnRequestInbound = (amount, asset) => request('lnRequestInbound', { amount, asset });
export const payInvoice = (bolt11, asset) => request('payInvoice', { bolt11, asset });
export const createInvoice = (amount, asset, memo) => request('createInvoice', { amount, asset, memo });
export const signPset = (pset) => request('signPset', { pset });
export const broadcast = (args) => request('broadcast', args);
