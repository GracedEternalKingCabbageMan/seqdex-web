# SeqDEX site — architecture

The standalone SeqDEX website. It has no wallet of its own: every key
operation goes through the Sequentia browser extension wallet via
`window.sequentia` (protocol: `sequentia-extension/doc/PROVIDER.md`). Unlike
the web wallet's terminal there is **no unified order book**: the site is
deliberately split into three trading surfaces plus a channel marketplace,
and the UI color-codes each surface so the user always knows which
settlement world they are in.

## The four surfaces

### 1. LNDEX (accent: violet)
Pure Lightning swaps only. No submarine or mixed rails: **both legs of every
trade travel over Lightning channels, and both maker and taker need live
channels with capacity in the right directions** before an order can be
placed or filled. Cross-chain with BTC is native here (asset over Sequentia
Lightning against BTC over testnet4 Lightning), plus asset-to-asset trades
with both legs on Sequentia Lightning.

- Book: the `/seqob-pln` relay (:9965). LNDEX shows only offers whose
  `lightning.ln_direction == 2` (both legs Lightning). The same relay also
  carries submarine offers (`ln_direction` 0 and 1); those are filtered out
  here by definition of the surface.
- Settlement: hold-invoice pairs. The taker's wallet creates and pays
  invoices on the user's own hosted SeqLN nodes (device co-signed,
  non-custodial). Instant and final when it settles: nothing on-chain, no
  Bitcoin-reorg risk.
- Prerequisite surfaced in the UI: per-asset channel state (spendable and
  receivable) from the wallet. A user without inbound liquidity for the
  asset they are buying is routed to the Channels page.

### 2. On-chain DEX (accent: gold)
On-chain settlement on Sequentia, with cross-chain BTC via on-chain HTLCs,
and OpenAMP restricted assets.

- Book: the `/seqob` relay (:9955): same-chain interactive offers
  (`SameChainTerms`), funded covenant resting orders (`CovenantTerms`,
  oversell-impossible, maker can be offline), and cross-chain offers
  (`CrossChainTerms`, `quote_asset == 'BTC'`).
- Settlement: taker composes the swap PSET from wallet UTXOs
  (`getUtxos`) and has the wallet sign it (`signPset`), or fills a covenant
  UTXO directly; cross-chain runs the HTLC dance with wallet-held keys.
- OpenAMP: restricted-asset legs settle as enclave transfers (policy-server
  co-signed) coordinated with the on-chain counterleg; the wallet's
  never-blind-sign rule applies unchanged.

### 3. Confidential DEX (accent: teal)
Blinded Sequentia transactions only; no BTC anywhere (Bitcoin has no
confidential transactions, so a cross leg would unblind the trade).

- The relay protocol anticipated this surface: `pair.confidential` exists on
  every market, and `SameChainTerms.maker_blinding_pub` lets the taker blind
  the maker's output. Confidential markets are the same pairs with
  `confidential: true`.
- Book: a dedicated relay mount `/seqob-conf` (same `seqobd` binary, new
  instance) so confidential and transparent books never mix.
- Settlement: same-chain interactive settlement with confidential
  (`tsqb1…`) addresses and blinded PSETs. The wallet signs blinded PSETs
  today; decoding them for the approval screen is a wallet-side follow-up.

### 4. Channels marketplace (accent: violet, serves the LNDEX)
Inbound liquidity for LNDEX traders: you cannot RECEIVE an asset over
Lightning without inbound capacity in that asset.

- Phase one (working now): the LSP sells JIT inbound liquidity. The page
  reads the user's per-asset channel state from the wallet and lets them
  request inbound capacity (`lnRequestInbound`), which provisions or tops up
  a channel toward the user's own hosted node.
- Phase two: a P2P channel-offer book (`/seqob-chan` relay mount): sellers
  post priced offers (asset, capacity, fee, minimum duration); a buyer pays
  over Lightning or on-chain and the seller's node opens the channel.

## What the site is

Static ES modules, no bundler, no framework (house style). Served at
`https://sequentiatestnet.com/dex/`. Pages: `index.html` (surface chooser),
`lndex.html`, `onchain.html`, `confidential.html`, `channels.html`, over a
shared core (`shared/`): provider glue, asset metadata (registry + prices),
relay book client, UI tokens.

The wallet drives everything sensitive. The site builds and displays;
the extension signs, pays, and holds keys. If `window.sequentia` is absent
the site runs read-only with an install prompt.

## Provider protocol dependencies

Live in `sequentia-extension` (`doc/PROVIDER.md` is the contract; changes
land there first):

- v0.1 (shipped): connect, getAccounts, getNetwork, getBalances, getAddress,
  signPset, signMessage, broadcast, createInvoice, payInvoice.
- v0.2 (this milestone): `getUtxos` (compose swap PSETs site-side),
  `lnChannels` (per-asset spendable/receivable, the LNDEX gate),
  `lnRequestInbound` (the marketplace phase-one purchase).
- v0.3 (planned, per settlement phase): hold-invoice create/settle for P2P
  LN atomicity, BTC HTLC signing surfaces for on-chain cross swaps, blinded
  PSET decode for the confidential approval screen.

## Phases

- **P0 (this milestone)**: site shell + all four pages with live books,
  wallet connect, per-asset channel state, working inbound-liquidity
  request. Trade tickets validate prerequisites but do not yet settle.
- **P1**: LNDEX taker fills against the live pure-LN makers, end to end.
- **P2**: on-chain same-chain taker + covenant fills.
- **P3**: cross-chain BTC (LN first, then on-chain HTLC).
- **P4**: confidential relay mount + blinded settlement.
- **P5**: OpenAMP legs on the on-chain DEX; P2P channel-offer book.

## Design language

Dark chassis (near-black, one family with the extension popup), Sequentia
gold reserved for the on-chain surface and brand marks. Surface accents:
LNDEX and Channels violet, on-chain gold, confidential teal. Type: Space
Grotesk for display and UI, IBM Plex Mono for numbers, books, and
identifiers. The accent system is informational, not decorative: it encodes
which settlement world the user is standing in.
