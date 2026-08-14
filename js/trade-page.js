// Shared trading-page driver: markets list, order book, wallet panel.
// Each surface page instantiates it with its mount and its own rules.
import { $, el } from '../shared/app.js';
import { assetMeta, fmtAtoms, assetSupervised, supervisionNote } from '../shared/meta.js';
import { markets, orderbook, priceOf, pureLnOnly } from '../shared/book.js';
import * as P from '../shared/provider.js';

export function pairLabel(m) {
  return assetMeta(m.base).ticker + ' / ' + (m.quote === 'BTC' ? 'BTC' : assetMeta(m.quote).ticker);
}

export async function runTradePage({ mount, lnOnly = false, confOnly = false, wantChannels = false, fill = null }) {
  let mkts = [];
  let current = null;
  let timer = null;
  let ticketOffer = null;

  // Wallet-side progress during a fill (the extension streams it).
  if (P.hasWallet()) {
    try { window.sequentia.on('dexProgress', (d) => {
      const st = $('ticketStatus');
      if (st && d && d.text) { st.className = 'status'; st.textContent = d.text; }
    }); } catch {}
  }

  async function loadMarkets() {
    const list = $('mktList');
    try {
      mkts = await markets(mount);
      // The conf mount IS the blinded namespace (its market summaries do not
      // carry the flag); offers are still filtered per-offer below.
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
        // A trader is about to ACQUIRE this asset, so say up front if its issuer
        // can freeze it. Settlement in flight is never caught: a freeze reaches
        // ordinary addresses, not channels, HTLCs or covenants.
        if (assetSupervised(m.base) || assetSupervised(m.quote)) {
          const sup = el('span', 'sup', '⊘');
          sup.title = supervisionNote(assetSupervised(m.base) ? m.base : m.quote);
          b.appendChild(sup);
        }
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
    ticketOffer = null;
    const tp = $('ticketPanel');
    if (tp) { tp.classList.add('hide'); tp.innerHTML = ''; }
    for (const x of document.querySelectorAll('.mkt')) x.classList.remove('on');
    if (btn) btn.classList.add('on');
    $('bookTitle').textContent = pairLabel(m);
    await refreshBook();
    renderWallet();
    renderMarketTicket();
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
        if (fill) {
          tr.style.cursor = 'pointer';
          tr.title = o.covenant ? 'Fill this covenant order (maker can be offline; chain-enforced)' : 'Fill this order';
          tr.onclick = () => openTicket(o);
          tr.onmouseenter = () => { tr.style.background = 'var(--panel2)'; };
          tr.onmouseleave = () => { tr.style.background = ''; };
        }
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
      const tk = el('span', 'tk', meta.ticker);
      tk.title = assetSupervised(s.hex) ? (meta.name + ' — ' + supervisionNote(s.hex)) : meta.name;
      r.appendChild(tk);
      if (assetSupervised(s.hex)) {
        const sup = el('span', 'sup', '⊘'); sup.title = supervisionNote(s.hex); r.appendChild(sup);
      }
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

  // ---- fill ticket ----
  const big = (v) => BigInt(v ?? 0);
  const ceilDiv = (a, b) => (a + b - 1n) / b;

  function parseBaseAmt(str, prec) {
    str = (str || '').trim();
    if (!/^\d+(\.\d+)?$/.test(str)) throw new Error('enter a valid amount');
    const [i, f = ''] = str.split('.');
    if (f.length > prec) throw new Error('max ' + prec + ' decimals');
    return BigInt(i) * 10n ** BigInt(prec) + BigInt((f + '0'.repeat(prec)).slice(0, prec) || '0');
  }

  // Preview mirror of the wallet's math (the wallet recomputes from the relay
  // and its numbers are the ones on the approval sheet).
  function previewFill(o, takeBase) {
    let take = takeBase;
    if (take < 1n) take = 1n;
    if (take > o.baseAtoms) take = o.baseAtoms;
    const quote = o.side === 'ask' ? ceilDiv(o.quoteAtoms * take, o.baseAtoms)   // you pay quote
                                   : (o.quoteAtoms * take) / o.baseAtoms;        // you receive quote
    return { take, quote, whole: take >= o.baseAtoms };
  }

  // Market ticket (LNDEX): side + amount only; the WALLET plans the walk from
  // the relay book and shows one aggregate approval. Users stop being obliged
  // to pick a single resting order by hand.
  function renderMarketTicket() {
    if (fill !== 'ln' || !current) return;
    const tp = $('ticketPanel');
    let box = document.getElementById('marketPanel');
    if (!box) {
      box = el('div', 'panel');
      box.id = 'marketPanel';
      tp.parentNode.insertBefore(box, tp);
    }
    box.innerHTML = '';
    const bm = assetMeta(current.base);
    const qm = current.quote === 'BTC' ? { ticker: 'BTC', precision: 8 } : assetMeta(current.quote);
    box.appendChild(el('h2', null, 'Market order'));
    const row = el('div'); row.style.display = 'flex'; row.style.gap = '8px'; row.style.margin = '6px 0 10px';
    const bBuy = el('button', 'btn', 'Buy ' + bm.ticker);
    const bSell = el('button', 'btn', 'Sell ' + bm.ticker);
    let side = 'buy';
    const paint = () => { bBuy.style.opacity = side === 'buy' ? '1' : '.45'; bSell.style.opacity = side === 'sell' ? '1' : '.45'; };
    bBuy.onclick = () => { side = 'buy'; paint(); };
    bSell.onclick = () => { side = 'sell'; paint(); };
    row.appendChild(bBuy); row.appendChild(bSell); box.appendChild(row); paint();
    const lbl = el('label', 'lbl', 'Amount (' + bm.ticker + ') · walks the book across resting orders, one wallet approval');
    box.appendChild(lbl);
    const inp = el('input', 'mono'); box.appendChild(inp);
    const go = el('button', 'btn', 'Place market order'); go.style.marginTop = '10px';
    box.appendChild(go);
    const st = el('div', 'status'); box.appendChild(st);
    go.onclick = async () => {
      st.className = 'status'; st.textContent = '';
      if (!P.account()) {
        try { await P.connect(); } catch (e) { st.className = 'status err'; st.textContent = e.message; return; }
      }
      let atoms;
      try { atoms = parseBaseAmt(inp.value, bm.precision); } catch (e) { st.className = 'status err'; st.textContent = e.message; return; }
      go.disabled = true;
      st.textContent = 'Waiting for wallet approval…';
      try {
        let res = await P.request('dexMarketOrder', { room: 'ln', base: current.base, quote: current.quote, side, baseAtoms: atoms.toString() });
        if (res.jobId) {
          st.textContent = 'Market order running in your wallet…';
          const deadline = Date.now() + 20 * 60_000;
          for (;;) {
            await new Promise((r) => setTimeout(r, 4000));
            const jr = await P.request('dexJobResult', { jobId: res.jobId }).catch(() => ({ done: false }));
            if (jr.done) {
              if (!jr.ok) throw new Error(jr.error || 'no slice settled');
              res = jr.result;
              break;
            }
            if (Date.now() > deadline) throw new Error('the order is taking unusually long; check your balances');
          }
        }
        const okSlices = (res.slices || []).filter((x) => x.ok).length;
        st.className = 'status ok';
        st.textContent = 'Filled ' + fmtAtoms(big(res.baseAtoms), bm.precision) + ' ' + bm.ticker +
          (side === 'buy' ? ' for ' : ' receiving ') + fmtAtoms(big(res.quoteAtoms), qm.precision) + ' ' + qm.ticker +
          ' across ' + okSlices + ' order' + (okSlices === 1 ? '' : 's') + ', all over Lightning.';
        refreshBook(); loadWallet();
      } catch (e) {
        st.className = 'status err';
        st.textContent = 'Market order failed: ' + e.message;
      } finally { go.disabled = false; }
    };
  }

  function openTicket(o) {
    ticketOffer = o;
    const box = $('ticketPanel');
    box.classList.remove('hide');
    box.innerHTML = '';
    const bm = assetMeta(current.base);
    const qm = current.quote === 'BTC' ? { ticker: 'BTC', precision: 8 } : assetMeta(current.quote);
    const youBuy = o.side === 'ask';   // taking an ask = you buy base; taking a bid = you sell base
    box.appendChild(el('h2', null, (youBuy ? 'Buy ' : 'Sell ') + bm.ticker + (youBuy ? ' with ' : ' for ') + qm.ticker));
    const lbl = el('label', 'lbl', 'Amount (' + bm.ticker + ') · offer size ' + fmtAtoms(o.baseAtoms, bm.precision));
    lbl.htmlFor = 'ticketAmt';
    box.appendChild(lbl);
    const inp = el('input', 'mono'); inp.id = 'ticketAmt';
    inp.value = fmtAtoms(o.baseAtoms, bm.precision);
    box.appendChild(inp);
    const prev = el('p', 'sub'); prev.id = 'ticketPreview'; prev.style.marginTop = '8px';
    box.appendChild(prev);
    const btn = el('button', 'btn', youBuy ? 'Buy ' + bm.ticker : 'Sell ' + bm.ticker);
    btn.id = 'ticketGo'; btn.style.marginTop = '12px';
    box.appendChild(btn);
    const st = el('div', 'status'); st.id = 'ticketStatus';
    box.appendChild(st);
    if (!o.partial) inp.disabled = true;

    const repaint = () => {
      try {
        const take = o.partial ? parseBaseAmt(inp.value, bm.precision) : o.baseAtoms;
        const pv = previewFill(o, take);
        prev.textContent = (youBuy
          ? 'You pay ≈ ' + fmtAtoms(pv.quote, qm.precision) + ' ' + qm.ticker + ' and receive ' + fmtAtoms(pv.take, bm.precision) + ' ' + bm.ticker
          : 'You give ' + fmtAtoms(pv.take, bm.precision) + ' ' + bm.ticker + ' and receive ≈ ' + fmtAtoms(pv.quote, qm.precision) + ' ' + qm.ticker)
          + (pv.whole ? ' (the whole offer)' : ' (partial, at the offer’s exact ratio)')
          + '. Exact amounts are confirmed in the wallet approval.';
        btn.disabled = false;
        return pv;
      } catch (e) { prev.textContent = e.message; btn.disabled = true; return null; }
    };
    inp.addEventListener('input', repaint);
    repaint();

    btn.onclick = async () => {
      st.className = 'status'; st.textContent = '';
      if (!P.account()) {
        try { await P.connect(); } catch (e) { st.className = 'status err'; st.textContent = e.message; return; }
      }
      const pv = repaint();
      if (!pv) return;
      btn.disabled = true;
      st.textContent = 'Waiting for wallet approval…';
      try {
        let res;
        if (fill === 'ln') {
          res = await P.request('dexSwapLn', {
            base: current.base, quote: current.quote, offerId: o.id,
            takeAtoms: pv.whole ? undefined : pv.take.toString(),
          });
          if (res.jobId) {
            // The swap runs as a wallet job that survives anything; poll it.
            st.className = 'status';
            st.textContent = 'Swap running in your wallet…';
            const deadline = Date.now() + 12 * 60_000;
            for (;;) {
              await new Promise((r) => setTimeout(r, 4000));
              const jr = await P.request('dexJobResult', { jobId: res.jobId }).catch(() => ({ done: false }));
              if (jr.done) {
                if (!jr.ok) throw new Error(jr.error || 'swap failed');
                res = jr.result;
                break;
              }
              if (Date.now() > deadline) throw new Error('the swap is taking unusually long; check your balances before retrying');
            }
          }
          st.className = 'status ok';
          st.textContent = 'Settled over Lightning: ' +
            (youBuy ? 'received ' + fmtAtoms(big(res.baseAtoms), bm.precision) + ' ' + bm.ticker
                    : 'received ' + fmtAtoms(big(res.quoteAtoms), qm.precision) + ' ' + qm.ticker) +
            '. Instant and final.';
        } else {
          res = await P.request('dexFillOnchain', {
            mount: fill === 'conf' ? 'conf' : 'chain',
            base: current.base, quote: current.quote, offerId: o.id,
            takeBase: pv.take.toString(),
          });
          st.className = 'status ok';
          st.textContent = 'Filled. Swap transaction ' + (res.txid ? res.txid.slice(0, 16) + '…' : 'broadcast') +
            ' — settles in about a block.';
        }
        refreshBook();
        loadWallet();
      } catch (e) {
        st.className = 'status err';
        st.textContent = 'Fill failed: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    };
  }

  P.onAccountChange(() => loadWallet());
  await loadMarkets();
  await loadWallet();
  timer = setInterval(() => { refreshBook(); }, 15000);
  window.addEventListener('pagehide', () => clearInterval(timer));
}
