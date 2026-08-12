import { initChrome, footer, $, el } from '../shared/app.js';
import { assetMeta, fmtAtoms, policyHex } from '../shared/meta.js';
import * as P from '../shared/provider.js';

await initChrome('channels.html');
footer();

// Assets offered in the buy form: BTC plus everything the wallet holds
// (the wallet gates which of those can actually run a Lightning node).
async function fillAssets() {
  const sel = $('inAsset');
  sel.innerHTML = '';
  const add = (v, label) => { const o = el('option', null, label); o.value = v; sel.appendChild(o); };
  add('BTC', 'BTC (testnet4)');
  if (P.account()) {
    try {
      const b = await P.getBalances();
      for (const hex of Object.keys(b.assets || {})) add(hex, assetMeta(hex).ticker);
    } catch {}
  } else {
    add(policyHex(), 'tSEQ');
  }
}

async function renderChannels() {
  const body = $('chanBody');
  const intro = $('chanIntro');
  body.innerHTML = '';
  if (!P.account()) {
    intro.textContent = P.hasWallet()
      ? 'Connect the wallet to see your Lightning channels.'
      : 'SeqDEX needs the Sequentia extension wallet. Install it from the downloads page, then connect.';
    return;
  }
  intro.textContent = 'Loading channel state from your wallet…';
  try {
    const { deployed, channels } = await P.lnChannels();
    if (!deployed) { intro.textContent = 'Lightning is not reachable from the wallet right now.'; return; }
    if (!channels.length) {
      intro.textContent = 'No Lightning channels yet. Buy inbound capacity on the right, or move funds to Lightning from the wallet.';
      return;
    }
    intro.textContent = 'Capacity on your own device-signed channels:';
    for (const c of channels) {
      const meta = c.kind === 'BTC' ? { ticker: 'BTC', precision: 8 } : assetMeta(c.kind);
      const tr = el('tr');
      const tk = el('td', null, meta.ticker); tk.style.fontFamily = 'var(--disp)'; tk.style.fontWeight = '700';
      tr.appendChild(tk);
      tr.appendChild(el('td', null, c.scid || '—'));
      tr.appendChild(el('td', 'bid', fmtAtoms(c.spendable, meta.precision ?? 8)));
      tr.appendChild(el('td', 'ask', c.receivable != null ? fmtAtoms(c.receivable, meta.precision ?? 8) : 'n/a'));
      body.appendChild(tr);
    }
  } catch (e) {
    intro.textContent = 'Could not read channels: ' + e.message;
  }
}

$('btnInbound').onclick = async () => {
  const st = $('inStatus');
  st.className = 'status'; st.textContent = '';
  if (!P.account()) {
    try { await P.connect(); } catch (e) { st.className = 'status err'; st.textContent = e.message; return; }
  }
  const kind = $('inAsset').value;
  const meta = kind === 'BTC' ? { ticker: 'BTC', precision: 8 } : assetMeta(kind);
  let atoms;
  try {
    const v = ($('inAmt').value || '').trim();
    if (!/^\d+(\.\d+)?$/.test(v)) throw new Error('enter a valid amount');
    const [i, f = ''] = v.split('.');
    if (f.length > (meta.precision ?? 8)) throw new Error('max ' + meta.precision + ' decimals');
    atoms = BigInt(i) * 10n ** BigInt(meta.precision ?? 8) + BigInt((f + '0'.repeat(meta.precision ?? 8)).slice(0, meta.precision ?? 8) || '0');
    if (atoms <= 0n) throw new Error('enter an amount greater than zero');
  } catch (e) { st.className = 'status err'; st.textContent = e.message; return; }
  $('btnInbound').disabled = true;
  st.textContent = 'Waiting for wallet approval, then provisioning… this can take a minute.';
  try {
    await P.lnRequestInbound(atoms.toString(), kind === 'BTC' ? undefined : kind);
    st.className = 'status ok';
    st.textContent = 'Done. Inbound capacity for ' + meta.ticker + ' is being arranged; your channel state updates below.';
    renderChannels();
  } catch (e) {
    st.className = 'status err';
    st.textContent = 'Failed: ' + e.message;
  } finally {
    $('btnInbound').disabled = false;
  }
};

P.onAccountChange(() => { renderChannels(); fillAssets(); });
await fillAssets();
await renderChannels();
