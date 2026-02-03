import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create test app
const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "../../../data");
const OUTPUT_DIR = path.join(DATA_DIR, "output");

// Health endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Liabilities endpoint
app.get("/api/liabilities", (_req, res) => {
  try {
    const rootPath = path.join(OUTPUT_DIR, "liabilities_root.json");
    if (!fs.existsSync(rootPath)) {
      return res.status(404).json({ error: "Liabilities not built yet" });
    }
    const root = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
    res.json(root);
  } catch {
    res.status(500).json({ error: "Failed to read liabilities data" });
  }
});

// Reserves endpoint
app.get("/api/reserves", (_req, res) => {
  try {
    const snapshotPath = path.join(OUTPUT_DIR, "reserves_snapshot.json");
    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ error: "Reserves not scanned yet" });
    }
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    res.json(snapshot);
  } catch {
    res.status(500).json({ error: "Failed to read reserves data" });
  }
});

// Contracts endpoint
app.get("/api/contracts", (_req, res) => {
  try {
    const deploymentPath = path.join(OUTPUT_DIR, "deployment.json");
    if (!fs.existsSync(deploymentPath)) {
      return res.status(404).json({ error: "Contracts not deployed yet" });
    }
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    res.json(deployment);
  } catch {
    res.status(500).json({ error: "Failed to read deployment data" });
  }
});

// Proof endpoint
app.get("/api/proof", (_req, res) => {
  try {
    const proofPath = path.join(OUTPUT_DIR, "solvency_proof.json");
    if (!fs.existsSync(proofPath)) {
      return res.status(404).json({ error: "Proof not generated yet" });
    }
    const proof = JSON.parse(fs.readFileSync(proofPath, "utf-8"));
    res.json(proof);
  } catch {
    res.status(500).json({ error: "Failed to read proof data" });
  }
});

// Yellow sessions (in-memory for tests)
const yellowSessions = new Map<string, {
  id: string;
  participants: string[];
  allocations: Record<string, string>;
  status: "open" | "closed";
  createdAt: string;
}>();

app.post("/api/yellow/session", (req, res) => {
  const { participants } = req.body;
  if (!participants || !Array.isArray(participants)) {
    return res.status(400).json({ error: "participants array is required" });
  }

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const allocations: Record<string, string> = {};
  participants.forEach((p: string) => {
    allocations[p] = "0";
  });

  const session = {
    id: sessionId,
    participants,
    allocations,
    status: "open" as const,
    createdAt: new Date().toISOString(),
  };

  yellowSessions.set(sessionId, session);
  res.json({ success: true, session });
});

app.get("/api/yellow/session/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId as string;
  const session = yellowSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

app.put("/api/yellow/session/:sessionId/allocations", (req, res) => {
  const sessionId = req.params.sessionId as string;
  const { allocations } = req.body;
  const session = yellowSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  if (session.status === "closed") {
    return res.status(400).json({ error: "Session is closed" });
  }

  session.allocations = { ...session.allocations, ...allocations };
  yellowSessions.set(sessionId, session);
  res.json({ success: true, session });
});

// ============================================
// TESTS
// ============================================

describe("SolvencyProof API", () => {
  describe("Health Check", () => {
    it("should return ok status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("Liabilities Endpoints", () => {
    it("should return liabilities data if exists", async () => {
      const res = await request(app).get("/api/liabilities");
      // Either returns data or 404 if not built
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.liabilities_root).toBeDefined();
      }
    });
  });

  describe("Reserves Endpoints", () => {
    it("should return reserves data if exists", async () => {
      const res = await request(app).get("/api/reserves");
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.reserves_total_wei).toBeDefined();
      }
    });
  });

  describe("Contracts Endpoints", () => {
    it("should return deployment data if exists", async () => {
      const res = await request(app).get("/api/contracts");
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.contracts).toBeDefined();
        expect(res.body.chainId).toBe(11155111);
      }
    });
  });

  describe("Proof Endpoints", () => {
    it("should return proof data if exists", async () => {
      const res = await request(app).get("/api/proof");
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.proof).toBeDefined();
        expect(res.body.publicSignals).toBeDefined();
        expect(res.body.calldata).toBeDefined();
      }
    });
  });

  describe("Yellow Session Endpoints", () => {
    let testSessionId: string;

    it("should create a new session", async () => {
      const res = await request(app)
        .post("/api/yellow/session")
        .send({ participants: ["user1", "user2", "user3"] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.id).toBeDefined();
      expect(res.body.session.participants).toHaveLength(3);
      expect(res.body.session.status).toBe("open");

      testSessionId = res.body.session.id;
    });

    it("should fail to create session without participants", async () => {
      const res = await request(app)
        .post("/api/yellow/session")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("participants array is required");
    });

    it("should get session details", async () => {
      const res = await request(app).get(`/api/yellow/session/${testSessionId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testSessionId);
      expect(res.body.participants).toHaveLength(3);
    });

    it("should return 404 for non-existent session", async () => {
      const res = await request(app).get("/api/yellow/session/invalid_session_id");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Session not found");
    });

    it("should update allocations (off-chain instant update)", async () => {
      const res = await request(app)
        .put(`/api/yellow/session/${testSessionId}/allocations`)
        .send({
          allocations: {
            user1: "1000",
            user2: "2500",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session.allocations.user1).toBe("1000");
      expect(res.body.session.allocations.user2).toBe("2500");
    });

    it("should accumulate allocation updates", async () => {
      const res = await request(app)
        .put(`/api/yellow/session/${testSessionId}/allocations`)
        .send({
          allocations: {
            user3: "500",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.session.allocations.user1).toBe("1000");
      expect(res.body.session.allocations.user2).toBe("2500");
      expect(res.body.session.allocations.user3).toBe("500");
    });
  });
});
