// Shared page chrome: topbar injection, wallet connect button, helpers.
import * as P from './provider.js';
import { loadMeta } from './meta.js';

export const $ = (id) => document.getElementById(id);
export const el = (t, c, txt) => {
  const e = document.createElement(t);
  if (c) e.className = c;
  if (txt != null) e.textContent = txt;
  return e;
};

const PAGES = [
  ['lndex.html', 'LNDEX', 'ln'],
  ['onchain.html', 'On-chain DEX', 'chain'],
  ['confidential.html', 'Confidential DEX', 'conf'],
  ['channels.html', 'Channels', 'ln'],
];

export async function initChrome(active) {
  const bar = document.querySelector('.topbar');
  const here = location.pathname.split('/').pop() || 'index.html';

  const mark = el('a', 'wordmark');
  mark.href = 'index.html';
  const d = el('span', 'dot'); mark.appendChild(d);
  mark.appendChild(document.createTextNode('SeqDEX'));
  const t = el('small', null, 'testnet'); mark.appendChild(t);
  bar.appendChild(mark);

  const nav = el('nav', 'nav');
  for (const [href, label, s] of PAGES) {
    const a = el('a', null, label);
    a.href = href;
    a.dataset.s = s;
    if (href === here || href === active) a.classList.add('on');
    nav.appendChild(a);
  }
  bar.appendChild(nav);
  bar.appendChild(el('span', 'spacer'));

  const btn = el('button', 'connect-btn');
  btn.id = 'btnConnect';
  bar.appendChild(btn);
  renderConnect(btn, null, P.hasWallet());

  P.onAccountChange((acc) => renderConnect(btn, acc, P.hasWallet()));
  btn.onclick = async () => {
    if (!P.hasWallet()) {
      window.open('https://sequentiatestnet.com/download/', '_blank', 'noopener');
      return;
    }
    if (P.account()) return;
    btn.disabled = true;
    try { await P.connect(); }
    catch (e) { console.warn('[connect]', e.message); }
    finally { btn.disabled = false; }
  };

  P.watchEvents();
  await Promise.allSettled([loadMeta(), P.restore()]);
  return P.account();
}

function renderConnect(btn, acc, walletPresent) {
  btn.innerHTML = '';
  const st = el('span', 'st'); btn.appendChild(st);
  btn.classList.toggle('ok', !!acc);
  if (!walletPresent) {
    btn.appendChild(document.createTextNode('Install the wallet'));
    btn.title = 'SeqDEX needs the Sequentia browser extension wallet';
    return;
  }
  if (acc) {
    btn.appendChild(document.createTextNode('Connected'));
    const a = el('span', 'addr', acc.address.slice(0, 10) + '…' + acc.address.slice(-4));
    btn.appendChild(a);
    btn.title = acc.address;
  } else {
    btn.appendChild(document.createTextNode('Connect wallet'));
    btn.title = 'Connect the Sequentia extension wallet';
  }
}

export function footer() {
  const f = el('div', 'foot');
  const mk = (href, txt) => { const a = el('a', null, txt); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
  f.appendChild(el('span', null, 'SeqDEX · non-custodial · Sequentia testnet'));
  f.appendChild(mk('https://sequentiatestnet.com/', 'Explorer'));
  f.appendChild(mk('https://sequentiatestnet.com/download/', 'Wallet downloads'));
  f.appendChild(mk('https://github.com/GracedEternalKingCabbageMan/seqdex-web', 'Source'));
  document.querySelector('.wrap').appendChild(f);
}
