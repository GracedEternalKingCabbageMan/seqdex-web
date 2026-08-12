# CLAUDE.md — seqdex-web

The standalone SeqDEX site. Read DESIGN.md first; it is the architecture
contract (surfaces, books, settlement phases, provider dependencies).

## Rules

- **No unified order book.** The three surfaces are separate rooms by
  product decision (user directive 2026-08-12): LNDEX (`/seqob-pln`,
  `lightning.ln_direction == 2` only), on-chain (`/seqob`), confidential
  (`/seqob-conf`, `pair.confidential == true` only). Do not merge them.
- **The wallet drives everything sensitive.** No keys, no signing, no
  invoice handling in this repo; extend
  `sequentia-extension/doc/PROVIDER.md` first when a flow needs a new
  primitive, then consume it here.
- LNDEX = pure LN only. Submarine offers (ln_direction 0/1) are the web
  wallet's business, never shown here.
- Confidential DEX never gets a BTC leg (Bitcoin has no CT).
- Static ES modules, no bundler. Surface accents are informational
  (violet LN, gold chain, teal confidential); keep them consistent.
- Public copy: no em dashes; "Sequentia" is never abbreviated to SEQ; the
  token is "the Sequence token (SEQ)".

## Deploy

Box clone `/root/sequentia/seqdex-web`; Caddy serves it via `handle_path
/dex/*` + `file_server` (Caddyfile on the box, backup before editing,
`caddy validate` + `systemctl reload caddy`). Flow: commit → push →
`git pull` on the box. Nothing to build.

## Endpoints consumed

Same-origin under sequentiatestnet.com: `/registry/index.minimal.json`,
`/prices`, `/seqob*` relay mounts. All read-only from the site; writes
(posting offers, fills) will go through wallet-signed payloads per
DESIGN.md phases.
