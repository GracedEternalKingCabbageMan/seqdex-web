import { initChrome, footer, $ } from '../shared/app.js';
import { markets, pureLnOnly, orderbook } from '../shared/book.js';
import * as P from '../shared/provider.js';

const acc = await initChrome('index.html');
footer();

// Live tile stats from the real books; each fails soft to a plain label.
(async () => {
  try {
    const mkts = await markets('ln');
    let offers = 0;
    // Count only pure-LN offers (the LNDEX definition), sampling each market's book.
    await Promise.all(mkts.slice(0, 12).map(async (m) => {
      try { offers += pureLnOnly(await orderbook('ln', m.base, m.quote)).length; } catch {}
    }));
    $('liveLn').innerHTML = `<b>${offers}</b> live pure-Lightning offers · <b>${mkts.length}</b> markets`;
  } catch { $('liveLn').textContent = 'book unreachable right now'; }
})();

(async () => {
  try {
    const mkts = await markets('chain');
    const cross = mkts.filter((m) => m.quote === 'BTC').length;
    const n = mkts.reduce((s, m) => s + m.nOrders, 0);
    $('liveChain').innerHTML = `<b>${n}</b> resting orders · <b>${mkts.length}</b> markets · <b>${cross}</b> cross-chain`;
  } catch { $('liveChain').textContent = 'book unreachable right now'; }
})();

(async () => {
  try {
    const mkts = await markets('conf');
    $('liveConf').innerHTML = `<b>${mkts.length}</b> confidential markets`;
  } catch { $('liveConf').textContent = 'opens with the confidential book'; }
})();

(async () => {
  if (!acc) { $('liveChan').textContent = 'connect the wallet to see your channels'; return; }
  try {
    const { deployed, channels } = await P.lnChannels();
    $('liveChan').innerHTML = deployed
      ? `<b>${channels.length}</b> of your channels active`
      : 'Lightning not deployed';
  } catch (e) { $('liveChan').textContent = 'connect the wallet to see your channels'; }
})();
