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

Box clone `/srv/seqdex-web` (must live outside /root: Caddy's file_server runs as the caddy user and cannot traverse /root); Caddy serves it via `handle_path
/dex/*` + `file_server` (Caddyfile on the box, backup before editing,
`caddy validate` + `systemctl reload caddy`). Flow: commit → push →
`git pull` on the box. Nothing to build.

## Endpoints consumed

Same-origin under sequentiatestnet.com: `/registry/index.minimal.json`,
`/prices`, `/seqob*` relay mounts. All read-only from the site; writes
(posting offers, fills) will go through wallet-signed payloads per
DESIGN.md phases.

<!-- BEGIN SHARED AGENT CONVENTIONS: identical in every Sequentia repo. Change it in all of them together. -->
## Working with git and GitHub here

These rules are the same in every Sequentia repository. They are repeated in each
one because this file is the only thing an agent is guaranteed to read, whatever
machine it is working from.

**Nothing pushed to GitHub credits Claude, Anthropic, or any AI tool.** No
`Co-Authored-By: Claude` trailer, no `Claude-Session:` trailer or `claude.ai`
link, no "Generated with Claude Code" in a commit message or a pull request body,
no `claude/*` branch names or session ids, and no mention in source, comments,
docs or issue text. Agent tooling offers several of these by default; compose the
message without them rather than stripping them afterwards.

**Author every commit as**
`GracedEternalKingCabbageMan <151803062+GracedEternalKingCabbageMan@users.noreply.github.com>`.
Never a personal address.

**Every change lands through a pull request that you merge yourself, at once.**
There is no reviewer on this project; the pull request exists so the reasoning is
recorded beside the diff. Branch, push, open it, merge it, delete the branch, all
in one sitting. Pushing straight to the default branch is the rule most often
broken here, and it is the one that costs the record. A pull request stays open
only when the repository owner asks for that specific one, and that never carries
over to the next.

**Name branches `area/short-description`**: `fix/`, `doc/`, `feature/`, `test/`,
`build/`, or the component being changed. Never a tool name, a session id, or
`worktree-*`.

**Write the subject as `area: what changed`**, one line, 72 characters at the
outside and 50 where you can manage it. Put the reasoning in the body, and
explain why rather than what.

**These repositories are public and world-readable.** Never commit private keys,
seeds, `wallet.dat`, RPC credentials, `.env` files or API tokens. Read the diff
before every commit. Secrets belong on the server and in offline backups.

**A file belongs to the repository whose code it describes.** Decide which repo
owns it before writing it; if it landed in the wrong one, move it rather than
deleting it.

**Push the same day you commit.** The testnet server pulls only from GitHub, so a
branch left on one laptop is invisible to every other machine and to the box.
<!-- END SHARED AGENT CONVENTIONS -->
