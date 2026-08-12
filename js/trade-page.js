// Shared trading-page driver: markets list, order book, wallet panel.
// Each surface page instantiates it with its mount and its own rules.
import { $, el } from '../shared/app.js';
import { assetMeta, fmtAtoms } from '../shared/meta.js';
import { markets, orderbook, priceOf, pureLnOnly } from '../shared/book.js';
import * as P from '../shared/provider.js';

export function pairLabel(m) {
  return assetMeta(m.base).ticker + ' / ' + (m.quote === 'BTC' ? 'BTC' : assetMeta(m.quote).ticker);
}

export async function runTradePage({ mount, lnOnly = false, confOnly = false, wantChannels = false }) {
  let mkts = [];
  let current = null;
  let timer = null;

  async function loadMarkets() {
    const list = $('mktList');
    try {
      mkts = await markets(mount);
      if (confOnly) mkts = mkts.filter((m) => m.confidential);
      list.innerHTML = '';
      if (!mkts.length) {
        list.appendChild(el('p', 'sub', confOnly
          ? 'No confidential markets yet. This book opens when the first blinded offer is posted.'
          : 'No markets on this book right now.'));
        $('bookBody').innerHTML = '';
        return;
      }
      for (const m of mkts) {
        const b = el('button', 'mkt');
        b.appendChild(el('span', 'pair', pairLabel(m)));
        if (m.quote === 'BTC') { const x = el('span', 'sub2', '· cross-chain'); x.style.cssText = 'font-size:11px;color:var(--faint)'; b.appendChild(x); }
        b.appendChild(el('span', 'n', m.nOrders + ' ord'));
        b.onclick = () => select(m, b);
        list.appendChild(b);
        if (!current) select(m, b);
      }
    } catch (e) {
      list.innerHTML = '';
      list.appendChild(el('p', 'sub', 'Book unreachable: ' + e.message));
    }
  }

  async function select(m, btn) {
    current = m;
    for (const x of document.querySelectorAll('.mkt')) x.classList.remove('on');
    if (btn) btn.classList.add('on');
    $('bookTitle').textContent = pairLabel(m);
    await refreshBook();
    renderWallet();
  }

  async function refreshBook() {
    if (!current) return;
    const body = $('bookBody');
    try {
      let offers = await orderbook(mount, current.base, current.quote);
      if (lnOnly) offers = pureLnOnly(offers);
      if (confOnly) offers = offers.filter((o) => o.confidential);
      const bPrec = assetMeta(current.base).precision ?? 8;
      const qPrec = current.quote === 'BTC' ? 8 : (assetMeta(current.quote).precision ?? 8);
      const asks = offers.filter((o) => o.side === 'ask').sort((a, b) => priceOf(a, bPrec, qPrec) - priceOf(b, bPrec, qPrec));
      const bids = offers.filter((o) => o.side === 'bid').sort((a, b) => priceOf(b, bPrec, qPrec) - priceOf(a, bPrec, qPrec));
      body.innerHTML = '';
      const qTicker = current.quote === 'BTC' ? 'BTC' : assetMeta(current.quote).ticker;
      const row = (o, cls) => {
        const tr = el('tr');
        const p = priceOf(o, bPrec, qPrec);
        tr.appendChild(el('td', cls, p.toLocaleString(undefined, { maximumFractionDigits: 8 })));
        tr.appendChild(el('td', null, fmtAtoms(o.baseAtoms, bPrec)));
        tr.appendChild(el('td', null, fmtAtoms(o.quoteAtoms, qPrec)));
        const ex = el('td', null, o.expiresAt ? rel(o.expiresAt) : '—');
        ex.style.color = 'var(--faint)';
        tr.appendChild(ex);
        return tr;
      };
      // asks render top-down from worst to best so the spread sits in the middle
      for (const o of [...asks].reverse()) body.appendChild(row(o, 'ask'));
      const spread = el('tr', 'spread');
      const td = el('td', null, spreadLabel(asks, bids, bPrec, qPrec, qTicker));
      td.colSpan = 4; spread.appendChild(td); body.appendChild(spread);
      for (const o of bids) body.appendChild(row(o, 'bid'));
      if (!asks.length && !bids.length) {
        const tr = el('tr'); const t = el('td', 'sub', lnOnly ? 'No pure-Lightning offers on this market right now.' : 'No offers on this market right now.');
        t.colSpan = 4; tr.appendChild(t); body.innerHTML = ''; body.appendChild(tr);
      }
    } catch (e) {
      body.innerHTML = '';
      const tr = el('tr'); const t = el('td', 'sub', 'Order book unavailable: ' + e.message);
      t.colSpan = 4; tr.appendChild(t); body.appendChild(tr);
    }
  }

  function spreadLabel(asks, bids, bPrec, qPrec, qTicker) {
    const a = asks[0] ? priceOf(asks[0], bPrec, qPrec) : null;
    const b = bids[0] ? priceOf(bids[0], bPrec, qPrec) : null;
    if (a == null && b == null) return '—';
    if (a != null && b != null) return 'spread ' + (a - b).toLocaleString(undefined, { maximumFractionDigits: 8 }) + ' ' + qTicker;
    return a != null ? 'asks only' : 'bids only';
  }

  function rel(unix) {
    const s = unix - Math.floor(Date.now() / 1000);
    if (s <= 0) return 'expired';
    if (s < 90) return s + 's';
    if (s < 5400) return Math.round(s / 60) + 'm';
    return Math.round(s / 3600) + 'h';
  }

  // ---- wallet panel ----
  let balances = null, channels = null;
  async function loadWallet() {
    if (!P.account()) { balances = null; channels = null; renderWallet(); return; }
    try { balances = await P.getBalances(); } catch { balances = null; }
    if (wantChannels) { try { channels = await P.lnChannels(); } catch { channels = null; } }
    renderWallet();
  }

  function renderWallet() {
    const box = $('walletPanel');
    box.innerHTML = '';
    if (!P.account()) {
      box.appendChild(el('p', 'sub', P.hasWallet()
        ? 'Connect the wallet to see your balances here.'
        : 'SeqDEX trades against the Sequentia extension wallet. Install it from the downloads page, create a wallet, and connect.'));
      return;
    }
    if (!current || !balances) { box.appendChild(el('p', 'sub', 'Loading…')); return; }
    const sides = [
      { hex: current.base, label: 'base' },
      { hex: current.quote, label: 'quote' },
    ];
    for (const s of sides) {
      const meta = assetMeta(s.hex);
      const atoms = s.hex === 'BTC' ? (balances.btc || '0') : (balances.assets[s.hex] || '0');
      const r = el('div', 'wrow');
      const tk = el('span', 'tk', meta.ticker); tk.title = meta.name; r.appendChild(tk);
      r.appendChild(el('span', 'sub2', 'on-chain'));
      r.appendChild(el('span', 'amt', fmtAtoms(atoms, meta.precision ?? 8)));
      box.appendChild(r);
      if (wantChannels) {
        const ch = (channels && channels.channels || []).filter((c) => c.kind === s.hex);
        const spend = ch.reduce((t, c) => t + BigInt(c.spendable || 0), 0n);
        const recv = ch.some((c) => c.receivable == null) ? null : ch.reduce((t, c) => t + BigInt(c.receivable || 0), 0n);
        const r2 = el('div', 'wrow');
        r2.appendChild(el('span', 'tk', '⚡'));
        r2.appendChild(el('span', 'sub2', ch.length ? (ch.length + ' channel' + (ch.length > 1 ? 's' : '')) : 'no channel'));
        r2.appendChild(el('span', 'amt', ch.length ? (fmtAtoms(spend, meta.precision ?? 8) + (recv != null ? ' / ' + fmtAtoms(recv, meta.precision ?? 8) : '')) : '—'));
        box.appendChild(r2);
      }
    }
    if (wantChannels) {
      const hint = el('p', 'sub');
      hint.style.marginTop = '10px';
      const missing = sides.filter((s) => !((channels && channels.channels || []).some((c) => c.kind === s.hex)));
      if (channels && !channels.deployed) {
        hint.textContent = 'Lightning is not reachable from the wallet right now.';
      } else if (missing.length) {
        hint.appendChild(document.createTextNode('Trading here needs Lightning channels on both legs. Missing: ' + missing.map((s) => assetMeta(s.hex).ticker).join(', ') + '. '));
        const a = el('a', null, 'Get inbound liquidity'); a.href = 'channels.html'; hint.appendChild(a);
        hint.appendChild(document.createTextNode('.'));
      } else {
        hint.textContent = 'Channel capacity is shown as spendable / receivable.';
      }
      box.appendChild(hint);
    }
  }

  P.onAccountChange(() => loadWallet());
  await loadMarkets();
  await loadWallet();
  timer = setInterval(() => { refreshBook(); }, 15000);
  window.addEventListener('pagehide', () => clearInterval(timer));
}
