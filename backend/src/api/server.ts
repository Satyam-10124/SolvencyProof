import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { yellowNetwork as yellowClearNode } from "../services/yellow-network.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Data directories
const DATA_DIR = path.join(__dirname, "../../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================
// Health Check
// ============================================
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// Liabilities Endpoints
// ============================================

// GET /api/liabilities - Get current liabilities data
app.get("/api/liabilities", (_req: Request, res: Response) => {
  try {
    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    const totalPath = path.join(OUTPUT_DIR, "liabilities_total.json");
    const treePath = path.join(OUTPUT_DIR, "liabilities_tree.json");

    if (!fs.existsSync(rootPath)) {
      return res.status(404).json({ error: "Liabilities not built yet" });
    }

    const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
    const total = JSON.parse(fs.readFileSync(totalPath, "utf-8"));
    const tree = fs.existsSync(treePath)
      ? JSON.parse(fs.readFileSync(treePath, "utf-8"))
      : null;

    res.json({
      root: root.liabilities_root,
      total: total.total_liabilities,
      epochId: root.epoch_id,
      leafCount: root.leaf_count,
      timestamp: root.timestamp,
      tree: tree ? { leafCount: tree.leaves?.length || 0 } : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to read liabilities data" });
  }
});

// POST /api/liabilities/build - Build liabilities Merkle tree
app.post("/api/liabilities/build", async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    const result = execSync("npx tsx src/liabilities-builder.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
    });

    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));

    res.json({
      success: true,
      message: "Liabilities tree built successfully",
      data: root,
      output: result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to build liabilities", details: error.message });
  }
});

// POST /api/liabilities/upload - Upload liabilities CSV
app.post("/api/liabilities/upload", (req: Request, res: Response) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent) {
      return res.status(400).json({ error: "csvContent is required" });
    }

    const csvPath = path.join(DATA_DIR, "liabilities.csv");
    fs.writeFileSync(csvPath, csvContent);

    res.json({ success: true, message: "Liabilities CSV uploaded" });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to upload CSV", details: error.message });
  }
});

// GET /api/liabilities/verify/:userId - Verify user inclusion
app.get("/api/liabilities/verify/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const { execSync } = await import("child_process");

    const result = execSync(`npx tsx src/verify-inclusion.ts ${userId}`, {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
    });

    res.json({
      success: true,
      userId,
      output: result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Verification failed", details: error.message });
  }
});

// ============================================
// Reserves Endpoints
// ============================================

// GET /api/reserves - Get current reserves snapshot
app.get("/api/reserves", (_req: Request, res: Response) => {
  try {
    const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");

    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ error: "Reserves not scanned yet" });
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: "Failed to read reserves data" });
  }
});

// POST /api/reserves/scan - Scan reserve addresses
app.post("/api/reserves/scan", async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    const result = execSync("npx tsx src/reserves-scanner.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 60000,
    });

    const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));

    res.json({
      success: true,
      message: "Reserves scanned successfully",
      data: snapshot,
      output: result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to scan reserves", details: error.message });
  }
});

// POST /api/reserves/addresses - Update reserve addresses
app.post("/api/reserves/addresses", (req: Request, res: Response) => {
  try {
    const { addresses } = req.body;
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: "addresses array is required" });
    }

    const reservesPath = path.join(DATA_DIR, "reserves.json");
    fs.writeFileSync(reservesPath, JSON.stringify({ addresses }, null, 2));

    res.json({ success: true, message: "Reserve addresses updated", count: addresses.length });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to update addresses", details: error.message });
  }
});

// ============================================
// ZK Proof Endpoints
// ============================================

// GET /api/proof - Get current proof data
app.get("/api/proof", (_req: Request, res: Response) => {
  try {
    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");

    if (!fs.existsSync(proofPath)) {
      return res.status(404).json({ error: "Proof not generated yet" });
    }

    const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
    res.json(proof);
  } catch (err) {
    res.status(500).json({ error: "Failed to read proof data" });
  }
});

// POST /api/proof/generate - Generate ZK solvency proof
app.post("/api/proof/generate", async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    const result = execSync("npx tsx src/solvency-prover.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 120000,
    });

    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));

    res.json({
      success: true,
      message: "Proof generated successfully",
      data: {
        verified: proof.verified,
        epochId: proof.epochId,
        reservesTotal: proof.reservesTotal,
        liabilitiesRoot: proof.liabilitiesRoot,
      },
      output: result,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to generate proof", details: error.message });
  }
});

// POST /api/proof/submit - Submit proof on-chain
app.post("/api/proof/submit", async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    const result = execSync("npx tsx src/submit-proof.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 120000,
    });

    const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
    if (fs.existsSync(submissionPath)) {
      const submission = JSON.parse(fs.readFileSync(submissionPath, "utf-8"));
      res.json({
        success: true,
        message: "Proof submitted on-chain",
        data: submission,
        output: result,
      });
    } else {
      res.json({
        success: true,
        message: "Proof submitted",
        output: result,
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to submit proof", details: error.message });
  }
});

// ============================================
// Contract Endpoints
// ============================================

// GET /api/contracts - Get deployed contract addresses
app.get("/api/contracts", (_req: Request, res: Response) => {
  try {
    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");

    if (!fs.existsSync(deploymentPath)) {
      return res.status(404).json({ error: "Contracts not deployed yet" });
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    res.json(deployment);
  } catch (err) {
    res.status(500).json({ error: "Failed to read deployment data" });
  }
});

// GET /api/contracts/proof/:epochId - Get on-chain proof by epoch
app.get("/api/contracts/proof/:epochId", async (req: Request, res: Response) => {
  try {
    const epochId = req.params.epochId as string;
    const { createPublicClient, http, parseAbi } = await import("viem");
    const { sepolia } = await import("viem/chains");

    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia"),
    });

    const abi = parseAbi([
      "function getProof(bytes32 epochId) external view returns (bytes32, bytes32, uint256, uint256, address, bool)",
    ]);

    // Pad epochId to bytes32
    const epochIdHex = ("0x" + BigInt(epochId).toString(16).padStart(64, "0")) as `0x${string}`;

    const proof = await publicClient.readContract({
      address: deployment.contracts.SolvencyProofRegistry as `0x${string}`,
      abi,
      functionName: "getProof",
      args: [epochIdHex],
    });

    res.json({
      epochId: proof[0],
      liabilitiesRoot: proof[1],
      reservesTotal: proof[2].toString(),
      timestamp: Number(proof[3]),
      submitter: proof[4],
      verified: proof[5],
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to get on-chain proof", details: error.message });
  }
});

// GET /api/contracts/epoch-count - Get epoch count from contract
app.get("/api/contracts/epoch-count", async (_req: Request, res: Response) => {
  try {
    const { createPublicClient, http, parseAbi } = await import("viem");
    const { sepolia } = await import("viem/chains");

    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia"),
    });

    const abi = parseAbi(["function getEpochCount() external view returns (uint256)"]);

    const count = await publicClient.readContract({
      address: deployment.contracts.SolvencyProofRegistry as `0x${string}`,
      abi,
      functionName: "getEpochCount",
    });

    res.json({ epochCount: Number(count) });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to get epoch count", details: error.message });
  }
});

// ============================================
// Yellow Network Session Endpoints
// ============================================
// Real implementation using Nitrolite SDK with file-based persistence
// NO MOCKS - All sessions are persisted to disk with cryptographic state hashes

// POST /api/yellow/session - Create new Yellow session (state channel)
app.post("/api/yellow/session", async (req: Request, res: Response) => {
  try {
    const { participants } = req.body;
    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: "participants array is required" });
    }

    const session = await yellowClearNode.createSession(participants);

    res.json({
      success: true,
      message: "Yellow session created (state channel opened)",
      session: {
        id: session.id,
        channelId: session.channelId,
        participants: session.participants,
        allocations: session.allocations,
        status: session.status,
        stateHash: session.stateHash,
        nonce: session.nonce,
        createdAt: session.createdAt,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to create session", details: error.message });
  }
});

// GET /api/yellow/session/:sessionId - Get session details
app.get("/api/yellow/session/:sessionId", (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = yellowClearNode.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to get session", details: error.message });
  }
});

// PUT /api/yellow/session/:sessionId/allocations - Update allocations (off-chain instant)
app.put("/api/yellow/session/:sessionId/allocations", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const { allocations } = req.body;

    if (!allocations || typeof allocations !== "object") {
      return res.status(400).json({ error: "allocations object is required" });
    }

    const session = await yellowClearNode.updateAllocations(sessionId, allocations);

    res.json({
      success: true,
      message: `Allocations updated off-chain (nonce: ${session.nonce})`,
      session: {
        id: session.id,
        allocations: session.allocations,
        nonce: session.nonce,
        stateHash: session.stateHash,
        status: session.status,
        updatedAt: session.updatedAt,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to update allocations", details: error.message });
  }
});

// POST /api/yellow/session/:sessionId/close - Close session and prepare settlement
app.post("/api/yellow/session/:sessionId/close", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = await yellowClearNode.closeSession(sessionId);

    res.json({
      success: true,
      message: "Session closed - ready for on-chain settlement",
      session: {
        id: session.id,
        channelId: session.channelId,
        allocations: session.allocations,
        nonce: session.nonce,
        stateHash: session.stateHash,
        status: session.status,
        closedAt: session.closedAt,
        totalUpdates: session.nonce,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to close session", details: error.message });
  }
});

// POST /api/yellow/session/:sessionId/export - Export session to liabilities CSV
app.post("/api/yellow/session/:sessionId/export", (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const csvPath = yellowClearNode.exportToLiabilities(sessionId);
    const session = yellowClearNode.getSession(sessionId);

    res.json({
      success: true,
      message: "Session exported to liabilities.csv",
      csvPath,
      entries: session ? Object.keys(session.allocations).length : 0,
      stateHash: session?.stateHash,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to export session", details: error.message });
  }
});

// GET /api/yellow/sessions - List all sessions
app.get("/api/yellow/sessions", (_req: Request, res: Response) => {
  try {
    const sessions = yellowClearNode.listSessions();
    const totalLiabilities = yellowClearNode.getTotalLiabilities();
    
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        channelId: s.channelId,
        status: s.status,
        participantCount: s.participants.length,
        nonce: s.nonce,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
      })),
      count: sessions.length,
      totalOpenLiabilities: totalLiabilities.toString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to list sessions", details: error.message });
  }
});

// GET /api/yellow/session/:sessionId/history - Get session state history
app.get("/api/yellow/session/:sessionId/history", (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const history = yellowClearNode.getSessionHistory(sessionId);
    
    res.json({
      sessionId,
      history,
      totalTransitions: history.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to get history", details: error.message });
  }
});

// POST /api/yellow/connect - Connect to Yellow ClearNode
app.post("/api/yellow/connect", async (_req: Request, res: Response) => {
  try {
    await yellowClearNode.connect();
    
    res.json({
      success: true,
      message: "Connected to Yellow ClearNode",
      connected: yellowClearNode.isConnected(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to connect to ClearNode", details: error.message });
  }
});

// POST /api/yellow/authenticate - Authenticate with Yellow ClearNode
app.post("/api/yellow/authenticate", async (_req: Request, res: Response) => {
  try {
    await yellowClearNode.authenticate();
    
    res.json({
      success: true,
      message: "Authenticated with Yellow ClearNode",
      authenticated: yellowClearNode.isAuthenticated(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to authenticate", details: error.message });
  }
});

// GET /api/yellow/status - Get Yellow ClearNode connection status
app.get("/api/yellow/status", (_req: Request, res: Response) => {
  res.json({
    connected: yellowClearNode.isConnected(),
    authenticated: yellowClearNode.isAuthenticated(),
    sessionsCount: yellowClearNode.listSessions().length,
    totalOpenLiabilities: yellowClearNode.getTotalLiabilities().toString(),
  });
});

// GET /api/yellow/session/:sessionId/settlement - Get settlement transaction details
app.get("/api/yellow/session/:sessionId/settlement", (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const session = yellowClearNode.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.settlementTx) {
      return res.status(400).json({ 
        error: "Session not yet settled",
        status: session.status,
        hint: "Close the session first to trigger settlement"
      });
    }

    res.json({
      sessionId: session.id,
      status: session.status,
      settlementTx: session.settlementTx,
      settlementBlock: session.settlementBlock,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${session.settlementTx}`,
      closedAt: session.closedAt,
      finalAllocations: session.allocations,
      totalLiabilities: Object.values(session.allocations).reduce(
        (sum, val) => sum + BigInt(val || "0"), 0n
      ).toString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Failed to get settlement", details: error.message });
  }
});

// ============================================
// Full Workflow Endpoint
// ============================================

// POST /api/workflow/full - Run complete solvency proof workflow
app.post("/api/workflow/full", async (_req: Request, res: Response) => {
  try {
    const { execSync } = await import("child_process");
    const results: string[] = [];

    // Step 1: Build liabilities
    results.push("Building liabilities...");
    execSync("npx tsx src/liabilities-builder.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
    });
    results.push("✓ Liabilities built");

    // Step 2: Scan reserves
    results.push("Scanning reserves...");
    execSync("npx tsx src/reserves-scanner.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 60000,
    });
    results.push("✓ Reserves scanned");

    // Step 3: Generate proof
    results.push("Generating ZK proof...");
    execSync("npx tsx src/solvency-prover.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 120000,
    });
    results.push("✓ Proof generated");

    // Step 4: Submit on-chain
    results.push("Submitting proof on-chain...");
    execSync("npx tsx src/submit-proof.ts", {
      cwd: path.join(__dirname, "../.."),
      encoding: "utf-8",
      timeout: 120000,
    });
    results.push("✓ Proof submitted on-chain");

    // Load final results
    const submissionPath = path.join(OUTPUT_DIR, "submission_result.json");
    const submission = fs.existsSync(submissionPath)
      ? JSON.parse(fs.readFileSync(submissionPath, "utf-8"))
      : null;

    res.json({
      success: true,
      message: "Full workflow completed",
      steps: results,
      submission,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: "Workflow failed", details: error.message });
  }
});

// ============================================
// Error Handler
// ============================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("API Error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

// ============================================
// Start Server
// ============================================
const HOST = "0.0.0.0";
app.listen(Number(PORT), HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           SolvencyProof API Server                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Running on: http://${HOST}:${PORT}                              ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║  ─────────────────────────────────────────────────────────────║
║  GET  /health                    - Health check               ║
║  ─────────────────────────────────────────────────────────────║
║  GET  /api/liabilities           - Get liabilities data       ║
║  POST /api/liabilities/build     - Build Merkle tree          ║
║  POST /api/liabilities/upload    - Upload CSV                 ║
║  GET  /api/liabilities/verify/:id - Verify inclusion          ║
║  ─────────────────────────────────────────────────────────────║
║  GET  /api/reserves              - Get reserves snapshot      ║
║  POST /api/reserves/scan         - Scan reserve addresses     ║
║  POST /api/reserves/addresses    - Update addresses           ║
║  ─────────────────────────────────────────────────────────────║
║  GET  /api/proof                 - Get proof data             ║
║  POST /api/proof/generate        - Generate ZK proof          ║
║  POST /api/proof/submit          - Submit on-chain            ║
║  ─────────────────────────────────────────────────────────────║
║  GET  /api/contracts             - Get deployed addresses     ║
║  GET  /api/contracts/proof/:id   - Get on-chain proof         ║
║  GET  /api/contracts/epoch-count - Get epoch count            ║
║  ─────────────────────────────────────────────────────────────║
║  POST /api/yellow/session        - Create Yellow session      ║
║  GET  /api/yellow/session/:id    - Get session details        ║
║  PUT  /api/yellow/session/:id/allocations - Update balances   ║
║  POST /api/yellow/session/:id/close - Close & settle          ║
║  POST /api/yellow/session/:id/export - Export to CSV          ║
║  GET  /api/yellow/sessions       - List all sessions          ║
║  ─────────────────────────────────────────────────────────────║
║  POST /api/workflow/full         - Run complete workflow      ║
╚═══════════════════════════════════════════════════════════════╝
`);
});

export default app;
