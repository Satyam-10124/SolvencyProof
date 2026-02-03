# SolvencyProof API Documentation

Base URL: `http://localhost:3001`

## Health Check

### GET /health
Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T17:40:49.769Z"
}
```

---

## Liabilities Endpoints

### GET /api/liabilities
Get current liabilities data (Merkle root, total, etc.)

**Response:**
```json
{
  "root": "0x60700382e80fbacd...",
  "total": "6500",
  "epochId": 1770131121,
  "leafCount": 6,
  "timestamp": "2026-02-03T15:00:00.000Z"
}
```

### POST /api/liabilities/build
Build liabilities Merkle tree from CSV file.

**Response:**
```json
{
  "success": true,
  "message": "Liabilities tree built successfully",
  "data": { "liabilities_root": "0x...", "epoch_id": 123, "leaf_count": 6 }
}
```

### POST /api/liabilities/upload
Upload a new liabilities CSV file.

**Request Body:**
```json
{
  "csvContent": "user_id,balance\nuser1,1000\nuser2,2000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Liabilities CSV uploaded"
}
```

### GET /api/liabilities/verify/:userId
Verify a user's inclusion in the liabilities Merkle tree.

**Response:**
```json
{
  "success": true,
  "userId": "user1",
  "output": "..."
}
```

---

## Reserves Endpoints

### GET /api/reserves
Get current reserves snapshot.

**Response:**
```json
{
  "reserves_total_wei": "355711576363123007",
  "reserves_total_eth": "0.355711576363123007",
  "addresses": [...],
  "timestamp": "2026-02-03T15:00:00.000Z"
}
```

### POST /api/reserves/scan
Scan reserve addresses and update snapshot.

**Response:**
```json
{
  "success": true,
  "message": "Reserves scanned successfully",
  "data": { "reserves_total_wei": "355711576363123007" }
}
```

### POST /api/reserves/addresses
Update the list of reserve addresses to scan.

**Request Body:**
```json
{
  "addresses": ["0x123...", "0x456..."]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reserve addresses updated",
  "count": 2
}
```

---

## ZK Proof Endpoints

### GET /api/proof
Get current ZK proof data.

**Response:**
```json
{
  "verified": true,
  "epochId": "1770131121",
  "reservesTotal": "355711576363123007",
  "liabilitiesRoot": "0x60700382e80fbacd...",
  "calldata": { "pA": [...], "pB": [...], "pC": [...], "pubSignals": [...] }
}
```

### POST /api/proof/generate
Generate a new ZK solvency proof.

**Response:**
```json
{
  "success": true,
  "message": "Proof generated successfully",
  "data": {
    "verified": true,
    "epochId": "1770131121",
    "reservesTotal": "355711576363123007"
  }
}
```

### POST /api/proof/submit
Submit the proof on-chain to Ethereum Sepolia.

**Response:**
```json
{
  "success": true,
  "message": "Proof submitted on-chain",
  "data": {
    "txHash": "0x9b21f643e6040da3...",
    "blockNumber": "10183452",
    "gasUsed": "400270",
    "verified": true
  }
}
```

---

## Contract Endpoints

### GET /api/contracts
Get deployed contract addresses.

**Response:**
```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "contracts": {
    "Groth16Verifier": "0x5e22F8cB0CfbC0df5F2251009674E1266E1D2DD6",
    "SolvencyProofRegistry": "0x7a9f15BCD95FDD20cf31A480f37CAA9b708aB33d"
  },
  "timestamp": "2026-02-03T15:10:00.000Z"
}
```

### GET /api/contracts/proof/:epochId
Get an on-chain proof by epoch ID.

**Response:**
```json
{
  "epochId": "0x0000000000000000000000000000000000000000000000000000000069820eb1",
  "liabilitiesRoot": "0x60700382e80fbacd...",
  "reservesTotal": "355711576363123007",
  "timestamp": 1738595652,
  "submitter": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "verified": true
}
```

### GET /api/contracts/epoch-count
Get the total number of submitted epochs.

**Response:**
```json
{
  "epochCount": 1
}
```

---

## Yellow Network Session Endpoints

### POST /api/yellow/session
Create a new Yellow session for off-chain liability management.

**Request Body:**
```json
{
  "participants": ["user1", "user2", "user3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Yellow session created",
  "session": {
    "id": "session_1738595000_abc123",
    "participants": ["user1", "user2", "user3"],
    "allocations": { "user1": "0", "user2": "0", "user3": "0" },
    "status": "open",
    "createdAt": "2026-02-03T15:30:00.000Z"
  }
}
```

### GET /api/yellow/session/:sessionId
Get session details.

**Response:**
```json
{
  "id": "session_1738595000_abc123",
  "participants": ["user1", "user2", "user3"],
  "allocations": { "user1": "1000", "user2": "2000", "user3": "500" },
  "status": "open",
  "createdAt": "2026-02-03T15:30:00.000Z"
}
```

### PUT /api/yellow/session/:sessionId/allocations
Update allocations (instant, off-chain).

**Request Body:**
```json
{
  "allocations": {
    "user1": "1500",
    "user2": "2500"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Allocations updated (off-chain)",
  "session": { ... }
}
```

### POST /api/yellow/session/:sessionId/close
Close the session and settle on-chain.

**Response:**
```json
{
  "success": true,
  "message": "Session closed and settled on-chain",
  "session": {
    "id": "session_1738595000_abc123",
    "status": "closed",
    "closedAt": "2026-02-03T16:00:00.000Z"
  }
}
```

### POST /api/yellow/session/:sessionId/export
Export session allocations to liabilities CSV.

**Response:**
```json
{
  "success": true,
  "message": "Session exported to liabilities.csv",
  "csvPath": "/data/liabilities.csv",
  "entries": 3
}
```

### GET /api/yellow/sessions
List all sessions.

**Response:**
```json
{
  "sessions": [...],
  "count": 2
}
```

---

## Workflow Endpoint

### POST /api/workflow/full
Run the complete solvency proof workflow:
1. Build liabilities Merkle tree
2. Scan reserve addresses
3. Generate ZK proof
4. Submit proof on-chain

**Response:**
```json
{
  "success": true,
  "message": "Full workflow completed",
  "steps": [
    "Building liabilities...",
    "✓ Liabilities built",
    "Scanning reserves...",
    "✓ Reserves scanned",
    "Generating ZK proof...",
    "✓ Proof generated",
    "Submitting proof on-chain...",
    "✓ Proof submitted on-chain"
  ],
  "submission": {
    "txHash": "0x...",
    "blockNumber": "10183452",
    "verified": true
  }
}
```

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid input)
- `404` - Not found
- `500` - Server error
