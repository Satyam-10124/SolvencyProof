# SolvencyProof
Private proof that assets exceed liabilities using zero-knowledge on Ethereum

SolvencyProof is a privacy-first system that enables exchanges, stablecoin issuers, and financial protocols to cryptographically prove they are solvent—meaning total reserves exceed total liabilities—without revealing balances, users, or transaction data.

The project combines public onchain reserve verification with private liabilities commitments and a zero-knowledge solvency proof verified on Ethereum (Sepolia).

Why SolvencyProof
Blockchains are transparent by default. Anyone can see wallet balances, yet financial platforms still struggle to prove solvency without exposing sensitive customer and internal financial data.
SolvencyProof solves this by enabling:
Public verification of solvency
Private customer balances
No trust in centralized attestations
Onchain cryptographic guarantees

What It Proves
At a given snapshot (epoch), SolvencyProof proves:
Σ(total reserves) ≥ Σ(total liabilities)
This statement is verified using a zero-knowledge proof, ensuring that:
Assets are publicly verifiable onchain
Liabilities remain private
Individual users can privately verify inclusion

Architecture Overview
Assets / Reserves
Computed from publicly verifiable onchain reserve wallets
Anyone can independently recompute totals
Liabilities
Ingested offchain (CSV for demo purposes)
Committed to a Merkle tree
Individual users receive private inclusion proofs
Zero-Knowledge Proof
A Circom circuit proves reserves ≥ liabilities
No balances or identities are revealed
Proof is verified onchain via Solidity verifier
Onchain Verification
Solidity verifier contract deployed on Ethereum Sepolia
Emits an onchain solvency attestation event
Frontend UI
Admin flow to publish solvency proofs
User flow to privately verify inclusion
Public dashboard to verify solvency onchain

Repository Layout
/contracts        Solidity contracts + deployment scripts
/circuits         Circom ZK circuits
/backend          Proof + data tooling (TypeScript scripts)
/app              Next.js frontend
/data             Demo inputs (CSV / JSON)
/scripts          Deployment & automation scripts

Tech Stack
Blockchain: Ethereum (Sepolia)
Smart Contracts: Solidity
Zero-Knowledge: Circom + snarkjs (Groth16)
Backend: Node.js / TypeScript
Frontend: Next.js + wagmi / viem
Merkle Trees: Poseidon or Keccak hashing
Wallets: EVM-compatible wallets (MetaMask, etc.)

Threat Model & Limitations
SolvencyProof does prove:
Cryptographic solvency at a point in time
Public ownership of reserve assets
User-verifiable inclusion in liabilities
Privacy of balances and identities
SolvencyProof does NOT prove:
Future solvency (proofs are point-in-time)
Completeness of undisclosed or off-ledger liabilities
Liquidity or immediate withdrawability
Absence of fraud or collusion
This system improves verifiability and privacy but does not replace audits, governance, or regulation.

How to Run (Day 1)

Prereqs
- Node.js 18+
- pnpm
- A wallet with Sepolia ETH

Setup
1. Copy env template:
   - `cp .env.example .env`
2. Fill `.env`:
   - `SEPOLIA_RPC_URL` (e.g. Alchemy/Infura)
   - `DEPLOYER_PRIVATE_KEY` (no 0x prefix)

Install deps
`pnpm install`

Contracts (Sepolia)
1. Compile:
   - `pnpm contracts:compile`
2. Deploy placeholder:
   - `pnpm contracts:deploy:sepolia`

Frontend
1. Start Next.js app:
   - `pnpm app:dev`
2. Open `http://localhost:3000`
3. Connect wallet and ensure you are on Ethereum Sepolia.

Demo Flow
Admin uploads liabilities dataset
System builds liabilities Merkle root
Admin scans reserve wallets on Ethereum Sepolia
ZK proof of solvency is generated
Proof is verified onchain
Users privately verify inclusion
Public verifies solvency via dashboard

Hackathon Compliance
Built from scratch during ETHGlobal HackMoney 2026
Open-sourced during judging
Committed frequently with visible history
Submitted exclusively to HackMoney
Fully compliant with all ETHGlobal event rules

AI Usage Disclosure
AI tools were used to assist with documentation drafting, architectural reasoning, and development planning. All code was written, reviewed, and integrated by the project author.

MIT License
