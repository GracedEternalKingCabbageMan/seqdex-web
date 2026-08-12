# SeqDEX site

The standalone SeqDEX website for the Sequentia testnet, live at
https://sequentiatestnet.com/dex/. Non-custodial by construction: it has no
wallet of its own and drives everything through the Sequentia browser
extension wallet (`window.sequentia`).

Three trading surfaces, deliberately separate (no unified order book), plus
a channel marketplace:

- **LNDEX** — pure Lightning swaps; both legs of every trade run through
  Lightning channels (maker's and taker's), including cross-chain BTC.
- **On-chain DEX** — atomic on-chain settlement, covenant resting orders,
  cross-chain BTC over on-chain contracts, OpenAMP restricted assets.
- **Confidential DEX** — blinded transactions, Sequentia assets only.
- **Channel marketplace** — per-asset channel state and inbound liquidity
  for LNDEX traders.

Architecture, settlement designs, and the milestone plan: [DESIGN.md](DESIGN.md).
Wallet protocol: `sequentia-extension/doc/PROVIDER.md`.

Static ES modules, no bundler, no framework. Serve the directory as-is;
deployed behind Caddy at `/dex/` on the testnet box.
