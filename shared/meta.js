// Asset metadata (registry) + prices. Display-only mirrors of the wallet's
// rules: user-facing names come from the registry, tickers and names are
// untrusted text and must be clamped by the UI, precision defaults are never
// guessed for real sends (the wallet enforces that side).

export const BASE = location.origin.includes('sequentiatestnet.com') ? location.origin : 'https://sequentiatestnet.com';

const DEFAULTS = {
  '048c7943385563c3f74982760f88654a4acb1ecc0bd49803c2f52b304ee7ce11': { ticker: 'USDX', name: 'USD Stablecoin', precision: 8 },
  '701aae7392509f7d0dc9c281ac821c9e5fb523e07673957c093b7a6f724ac92b': { ticker: 'EURX', name: 'Euro Stablecoin', precision: 8 },
  '3a0f9192219db59f8d7f87d93ac6311095dfe1255d149727b87baaa7d2cc71a1': { ticker: 'GOLD', name: 'Gold (troy ounce)', precision: 8 },
  'f30edec8211e1f395ddd44d380f70b5bea74989df952604fac636d9bb926bc30': { ticker: 'SILVR', name: 'Silver (troy ounce)', precision: 8 },
  'df66fc977b42c2c049184422a27e38aea2c3ce60e91a56d0b2c5d63256fc835d': { ticker: 'OILX', name: 'Crude Oil (barrel)', precision: 8 },
};
const POLICY_HEX = 'c8eccacf0953e1931cd31e434d8319101cc36e6c38b0e2104d8687552fae3e40';

let REGISTRY = {};
let PRICES = {};

export async function loadMeta() {
  await Promise.allSettled([
    fetch(BASE + '/registry/index.minimal.json', { cache: 'no-store' }).then((r) => r.json()).then((idx) => {
      const m = {};
      const clean = (s, n) => (typeof s === 'string') ? s.replace(/[<>]/g, '').slice(0, n) : s;
      for (const [id, v] of Object.entries(idx)) if (Array.isArray(v)) m[id] = { ticker: clean(v[1], 16), name: clean(v[2], 48), precision: v[3], domain: v[0], verified: !!v[4], supervised: !!v[5] };
      REGISTRY = m;
    }),
    fetch(BASE + '/prices', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      const m = {};
      for (const [t, v] of Object.entries(d)) { const p = (v && typeof v === 'object') ? v.price : v; if (p > 0) m[t.toUpperCase()] = p; }
      PRICES = m;
    }),
  ]);
}

export function assetMeta(hex) {
  if (!hex) return { ticker: '?', name: '', precision: 8 };
  if (hex === 'BTC') return { ticker: 'BTC', name: 'Bitcoin testnet4', precision: 8 };
  if (hex === POLICY_HEX) return { ticker: 'tSEQ', name: 'Sequence', precision: 8 };
  return REGISTRY[hex] || DEFAULTS[hex] || { ticker: hex.slice(0, 6) + '…', name: 'Asset ' + hex.slice(0, 10) + '…', precision: 8 };
}
export function policyHex() { return POLICY_HEX; }

// SEQUENTIA: whether this asset's issuer can freeze holdings of it by consensus
// rule (Sequentia src/supervision.h). Part of the asset's identity, committed in
// its id, so it can never be added or removed later.
//
// It matters more here than almost anywhere else: a trader is about to ACQUIRE
// the asset, and a resting order is a standing offer to acquire more. What a
// freeze reaches is worth stating precisely, because the answer is favourable
// to the DEX and counter-intuitive: an ordinary address holding the asset can
// be frozen, but a channel, an HTLC or a covenant cannot, since the frozen
// party is not the only party to those funds. So settlement in flight is never
// caught halfway.
export function assetSupervised(hex) {
  if (!hex || hex === 'BTC' || hex === POLICY_HEX) return false;
  const r = REGISTRY[hex];
  return !!(r && r.supervised);
}

// One sentence for a tooltip or a badge, wherever a market names an asset.
export function supervisionNote(hex) {
  if (!assetSupervised(hex)) return '';
  return 'Supervised asset: its issuer can freeze holdings at ordinary addresses. '
       + 'Funds in a channel, an HTLC or a covenant are out of reach, so a swap in flight cannot be caught halfway, '
       + 'and the issuer can never spend your coins.';
}

export function fmtAtoms(atoms, d) {
  let a = BigInt(atoms); const neg = a < 0n; if (neg) a = -a;
  const base = 10n ** BigInt(d);
  let s = (a / base).toString();
  if (d > 0) { const f = (a % base).toString().padStart(d, '0').replace(/0+$/, ''); if (f) s += '.' + f; }
  return (neg ? '-' : '') + s;
}

export function usdFor(hex, atoms) {
  const t = hex === 'BTC' ? 'BTC' : (hex === POLICY_HEX ? 'SEQ' : assetMeta(hex).ticker);
  const p = PRICES[String(t).toUpperCase()] || (t === 'BTC' ? PRICES.TBTC : null);
  if (!(p > 0)) return null;
  const units = Number(BigInt(atoms)) / Math.pow(10, assetMeta(hex).precision || 8);
  return units * p;
}
