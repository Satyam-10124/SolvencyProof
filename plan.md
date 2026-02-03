# SolvencyProof — Updated HackMoney Plan (with Yellow Track)

This plan keeps the **core SolvencyProof end-to-end** intact (Merkle liabilities → reserves scan → ZK proof → on-chain verification) and adds a **real Yellow/Nitrolite integration** so the project can be submitted under the **Yellow prize track**.

## 0) Goal (One Line)
Prove on Ethereum Sepolia that an entity is solvent (reserves ≥ liabilities) **without revealing liabilities**, and show a **Yellow state-channel session** that enables instant off-chain updates and **on-chain settlement**.

---

## 1) Current repo status (Done)
- Day 1 scaffolding is complete:
  - `/contracts` Hardhat + Sepolia deploy working
  - `/app` Next.js + wagmi connect + Sepolia guard
  - `/backend` TS scaffolding
  - `/data` demo inputs
  - `README.md` updated for Sepolia

---

## 2) Updated 10-Day Milestone Plan (with Yellow)

### Day 2 — Liabilities Merkle Engine (Core)
**Backend**
- Implement `backend/liabilities-builder.ts`
  - Parse `data/liabilities.csv` `(user_id,balance)`
  - Hash leaves deterministically
  - Build Merkle tree
  - Output:
    - `liabilities_root.json`
    - `liabilities_total.json`
    - `inclusion_<user>.json` (per-user proofs)
- Implement local inclusion verifier script.

**Frontend**
- Admin: upload CSV → show `liabilities_root`
- User: upload inclusion proof → verify locally.

**Deliverable**
- Deterministic Merkle root + private inclusion verification.

---

### Day 3 — Reserves Scanner (Core)
**Backend**
- `backend/reserves-scanner.ts`
  - Read `data/reserves.json`
  - Fetch balances via `viem`
  - Output `reserves_snapshot.json` with totals + epoch.

**Frontend**
- Admin: input addresses → scan → display `reserves_total`.

**Deliverable**
- Reproducible Sepolia reserves snapshot + total.

---

### Day 4 — ZK Circuit + Proof Generation (Core)
**Circuit**
- `circuits/solvency.circom`:
  - Public: `liabilities_root`, `reserves_total`, `epoch_id`
  - Private: `liabilities_total`
  - Constraint: `reserves_total >= liabilities_total`

**Backend**
- Compile circuit, generate Groth16 keys, generate proof artifacts.

**Deliverable**
- Proof verifies locally and is bound to epoch + liabilities root.

---

### Day 5 — On-Chain Verification + Registry (Core)
**Contracts**
- Generate Solidity verifier with `snarkjs`.
- Implement `SolvencyProofRegistry.sol`:
  - `submitProof(epoch, liabilitiesRoot, reservesTotal, proof)`
  - verify and store proof, emit `SolvencyProved`.

**Deliverable**
- Proof verifies on Sepolia and emits event.

---

### Day 6 — Public Dashboard + User Verification (Core)
**Frontend**
- Public dashboard reads events and lists verified epochs.
- User inclusion verifier checks:
  - inclusion proof matches root
  - root+epoch match on-chain

**Deliverable**
- Anyone can verify solvency on Sepolia; users verify inclusion privately.

---

## 3) Yellow Track Integration Plan (Make it “100% real”)

Yellow requires:
- Use Yellow SDK / Nitrolite protocol
- Demonstrate **off-chain session-based transaction logic**
- Demonstrate **on-chain settlement**
- Provide demo video showing the flow

### Day 7 — Yellow: Build Liabilities Session Layer (Off-chain)
**Idea (minimal + aligned):**
Use Yellow/Nitrolite sessions as the *source of liabilities updates* before the liabilities Merkle root is committed.

**What to implement**
- Add `backend/yellow/` tooling (or `app/yellow/` client module) that:
  - Starts a Yellow/Nitrolite session for an epoch
  - Tracks per-user liability allocations off-chain (instant updates)
  - Produces a deterministic final liabilities snapshot

**UI (minimal demo)**
- Admin:
  - `Start Yellow Session`
  - `Simulate liability updates` (increment/decrement for 2 demo users)
  - `Close Session`
- Display logs of:
  - session created
  - state updates
  - final allocations

**Deliverable**
- Off-chain liabilities updates happening instantly inside a session.

### Day 8 — Yellow: On-Chain Settlement Proof (Critical)
This is the key missing piece in many “almost Yellow” repos.

**What to implement**
- When `Close Session` happens, perform an **on-chain settlement** action:
  - Deposit into custody (if required by Nitrolite flow)
  - Submit final state/challenge
  - Finalize channel (or equivalent) and show a tx hash

**UI requirement**
- Show transaction hash + explorer link for settlement.

**Deliverable**
- A visible on-chain settlement tx that the demo can point to.

### Day 9 — Bridge Yellow → SolvencyProof (Merkle + ZK)
**What to implement**
- Export final liabilities allocations from Yellow session into the format SolvencyProof expects:
  - Generate `data/liabilities.csv` OR produce leaves directly
  - Run liabilities Merkle builder to produce `liabilities_root`

**Then run the usual pipeline**
- Scan reserves
- Generate ZK proof
- Submit proof on Sepolia

**Deliverable**
- A single epoch demo:
  - Yellow session → settlement tx → liabilities root → solvency proof → on-chain verification.

---

## 4) Demo Script (What judges will see)
1. Connect wallet
2. Start Yellow session
3. Make 3–4 instant off-chain liability updates (no gas, instant)
4. Close session and show the on-chain settlement tx
5. Generate liabilities root + inclusion proofs
6. Scan reserves from Sepolia
7. Generate solvency ZK proof
8. Submit proof on Sepolia and show `SolvencyProved` event

---

## 5) Acceptance Criteria (for “100% real on Yellow”)
- Repo includes Yellow SDK/Nitrolite usage (not mocked)
- Off-chain state updates are shown in UI/logs
- Closing session produces an on-chain settlement tx hash
- SolvencyProof still verifies on Sepolia with on-chain verifier
- Demo video shows the entire flow end-to-end
