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

  const bo = el('a', 'builton');
  bo.href = 'https://sequentia.io'; bo.target = '_blank'; bo.rel = 'noopener';
  bo.title = 'SeqDEX runs on the Sequentia network';
  bo.appendChild(el('span', null, 'on'));
  const li = document.createElement('img');
  li.src = 'shared/sequentia-logo.svg'; li.alt = 'Sequentia'; li.className = 'sqlogo';
  bo.appendChild(li);
  bar.appendChild(bo);

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

  // No provider means no trading at all; say so plainly, with the way out.
  if (!P.hasWallet()) {
    const note = el('div', 'extnote');
    note.appendChild(el('b', null, 'SeqDEX needs the Sequentia wallet extension. '));
    note.appendChild(document.createTextNode('Every order and every settlement is signed inside the extension; this site never holds keys or funds. Get the extension from the '));
    const dl = el('a', null, 'downloads page');
    dl.href = 'https://sequentiatestnet.com/download/'; dl.target = '_blank'; dl.rel = 'noopener';
    note.appendChild(dl);
    note.appendChild(document.createTextNode(', install it in a Chromium browser (Chrome, Brave, Edge), then reload this page.'));
    bar.parentNode.insertBefore(note, bar.nextSibling);
    // The provider can inject a beat after us; drop the note if it shows up.
    setTimeout(() => { if (P.hasWallet()) note.remove(); }, 1500);
  }

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
