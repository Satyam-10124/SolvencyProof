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

## Yellow Network Integration 🟡

SolvencyProof integrates with **Yellow Network's Nitrolite protocol** for off-chain liability management using the real `@erc7824/nitrolite` SDK.

### How Yellow Improves SolvencyProof
- **Instant Off-Chain Updates**: Liability changes happen instantly via Yellow state channels
- **Session-Based Spending**: Users can update balances without gas fees
- **On-Chain Settlement**: Final state settles on Ethereum when session closes
- **Export to Proof System**: Session data exports directly to liabilities CSV for ZK proof generation
- **Real Nitrolite SDK**: Uses `@erc7824/nitrolite` for authentic Yellow Network integration

### Yellow API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/yellow/connect` | POST | Connect to Yellow ClearNode via WebSocket |
| `/api/yellow/authenticate` | POST | Authenticate with EIP-712 signature |
| `/api/yellow/status` | GET | Get connection & authentication status |
| `/api/yellow/session` | POST | Create new liability session |
| `/api/yellow/session/:id` | GET | Get session details |
| `/api/yellow/session/:id/allocations` | PUT | Update allocations (instant, no gas) |
| `/api/yellow/session/:id/close` | POST | Close session & trigger settlement |
| `/api/yellow/session/:id/settlement` | GET | Get settlement TX (Etherscan link) |
| `/api/yellow/session/:id/export` | POST | Export to liabilities.csv |
| `/api/yellow/session/:id/history` | GET | Get session state history |
| `/api/yellow/sessions` | GET | List all sessions |

### Yellow Integration Flow
1. `POST /api/yellow/connect` → Connect to ClearNode WebSocket
2. `POST /api/yellow/authenticate` → Authenticate with session key
3. `POST /api/yellow/session` → Create liability session with participants
4. `PUT /api/yellow/session/:id/allocations` → Update allocations instantly (no gas)
5. `POST /api/yellow/session/:id/close` → Close session & settle on-chain
6. `GET /api/yellow/session/:id/settlement` → View settlement TX on Etherscan
7. `POST /api/yellow/session/:id/export` → Export final liabilities
8. Generate ZK proof → Submit on-chain

### Key Features (Per Yellow Hackathon Requirements)
- ✅ **Uses Yellow SDK**: Real `@erc7824/nitrolite` SDK integration
- ✅ **Off-chain transaction logic**: Instant allocations without gas
- ✅ **Session-based spending**: Participants can update balances freely
- ✅ **On-chain settlement**: Final state settles via smart contracts
- ✅ **Working prototype**: Full API with real Sepolia deployment

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| **Groth16Verifier** | `0x5e22F8cB0CfbC0df5F2251009674E1266E1D2DD6` |
| **SolvencyProofRegistry** | `0x7a9f15BCD95FDD20cf31A480f37CAA9b708aB33d` |

View on Etherscan:
- [Groth16Verifier](https://sepolia.etherscan.io/address/0x5e22F8cB0CfbC0df5F2251009674E1266E1D2DD6)
- [SolvencyProofRegistry](https://sepolia.etherscan.io/address/0x7a9f15BCD95FDD20cf31A480f37CAA9b708aB33d)

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Wallet with Sepolia ETH

### Installation
```bash
# Clone and install
git clone <repo-url>
cd SolvencyProof
pnpm install

# Setup environment
cp contracts/.env.example contracts/.env
# Add your SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
```

### Full Workflow

#### 1. Build Liabilities Merkle Tree
```bash
pnpm --filter @solvencyproof/backend build:liabilities
```

#### 2. Scan Reserve Addresses
```bash
pnpm --filter @solvencyproof/backend scan:reserves
```

#### 3. Generate ZK Solvency Proof
```bash
pnpm --filter @solvencyproof/backend prove:solvency
```

#### 4. Submit Proof On-Chain
```bash
pnpm --filter @solvencyproof/backend submit:proof
```

#### 5. Start Frontend
```bash
pnpm app:dev
# Open http://localhost:3000
```

### Frontend Features
- **Admin Dashboard**: Generate and submit solvency proofs
- **User Verification**: Check your inclusion in liabilities
- **Public Dashboard**: Verify on-chain solvency status
- **Yellow Session**: Manage liabilities via off-chain state channels

## Demo Flow

1. **Admin** uploads liabilities dataset (CSV)
2. System builds liabilities **Merkle root**
3. Admin scans **reserve wallets** on Ethereum Sepolia
4. **ZK proof** of solvency is generated (Groth16)
5. Proof is **verified on-chain**
6. Users privately verify **inclusion proofs**
7. Public verifies solvency via **dashboard**

### Yellow Network Demo
1. Connect to Yellow ClearNode
2. Start liabilities session
3. Update user balances (instant, no gas)
4. Close session (settles on-chain)
5. Export → Generate ZK proof

Hackathon Compliance
Built from scratch during ETHGlobal HackMoney 2026
Open-sourced during judging
Committed frequently with visible history
Submitted exclusively to HackMoney
Fully compliant with all ETHGlobal event rules

AI Usage Disclosure
AI tools were used to assist with documentation drafting, architectural reasoning, and development planning. All code was written, reviewed, and integrated by the project author.

MIT License
