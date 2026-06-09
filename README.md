# PermissionlessIndexer

Agent-native on-demand event indexer on Base. Indexer-agents stake USDC, register (contract, eventSig) pairs, and serve signed decoded event data over HTTP. Consumer-agents pay USDC per query via x402.

## Contract

- **PermissionlessIndexer**: [0x927247a3CD0a880475a617Bf01AE7F615151087c](https://basescan.org/address/0x927247a3CD0a880475a617Bf01AE7F615151087c) — Base mainnet

## Frontend

**Live URL:** https://bafybeictkld2ivl6bu7qwp3267kvtces7qotpcr7nkayj6pwwf3utvgrb4.ipfs.community.bgipfs.com/

## Local Development

```bash
yarn install
yarn start
```

## Architecture

- No admin, no upgradeability, no issued token
- Indexers stake USDC as base collateral + per-registration boost
- Consumers pay per-query fees split between indexer/keeper/treasury/buyback
- Disputes use commit-reveal + EIP-4788 beacon proof verification
- Buyback converts protocol revenue to CLAWD burns via Uniswap V3
