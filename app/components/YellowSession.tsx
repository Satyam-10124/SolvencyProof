"use client";

import { useState, useEffect, useRef } from "react";
import {
  Zap,
  Play,
  Square,
  Plus,
  Minus,
  Download,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { YellowClient, YellowLog, exportToLiabilitiesCSV } from "../lib/yellow";

interface YellowSessionProps {
  address: string;
}

export default function YellowSession({ address }: YellowSessionProps) {
  const clientRef = useRef<YellowClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [logs, setLogs] = useState<YellowLog[]>([]);
  
  const [sessionId, setSessionId] = useState<string>("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [round, setRound] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [settlementTx, setSettlementTx] = useState<string>("");

  // Demo users for liabilities simulation
  const [demoUsers] = useState([
    { id: "user_001", name: "Alice" },
    { id: "user_002", name: "Bob" },
    { id: "user_003", name: "Charlie" },
  ]);

  useEffect(() => {
    const client = new YellowClient();
    client.onConnect = () => setConnected(true);
    client.onDisconnect = () => setConnected(false);
    client.onLog = (log) => setLogs((prev) => [...prev.slice(-50), log]);
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    if (!clientRef.current) return;
    setConnecting(true);
    try {
      await clientRef.current.connect();
    } catch (err) {
      console.error("Failed to connect:", err);
    } finally {
      setConnecting(false);
    }
  };

  const handleStartSession = async () => {
    if (!clientRef.current || !connected) return;

    try {
      // Initialize allocations for demo users
      const initialAllocations: Record<string, string> = {};
      demoUsers.forEach((user) => {
        initialAllocations[user.id] = "100";
      });
      setAllocations(initialAllocations);

      // Create session with Yellow
      const result = await clientRef.current.createSession(
        [address, ...demoUsers.map((u) => u.id)],
        "ytest.usd",
        "100"
      );

      setSessionId(result.sessionId);
      setSessionActive(true);
      setRound(0);
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handleUpdateAllocation = async (userId: string, delta: number) => {
    if (!clientRef.current || !sessionActive) return;

    const currentBalance = parseInt(allocations[userId] || "0");
    const newBalance = Math.max(0, currentBalance + delta);
    
    const newAllocations = {
      ...allocations,
      [userId]: newBalance.toString(),
    };

    try {
      await clientRef.current.updateState(sessionId, newAllocations, round + 1);
      setAllocations(newAllocations);
      setRound((r) => r + 1);
    } catch (err) {
      console.error("Failed to update state:", err);
    }
  };

  const handleCloseSession = async () => {
    if (!clientRef.current || !sessionActive) return;

    try {
      await clientRef.current.closeSession(sessionId);
      
      // Simulate on-chain settlement tx
      const mockTxHash = "0x" + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      
      setSettlementTx(mockTxHash);
      setSessionActive(false);
    } catch (err) {
      console.error("Failed to close session:", err);
    }
  };

  const handleExportCSV = () => {
    const csv = exportToLiabilitiesCSV(allocations);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "liabilities.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTotalLiabilities = () => {
    return Object.values(allocations).reduce((sum, val) => sum + parseInt(val || "0"), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-yellow-500" />
        <h2 className="text-xl font-bold">Yellow Session (Off-Chain Liabilities)</h2>
      </div>

      <p className="text-gray-600 text-sm">
        Use Yellow Network state channels for instant off-chain liability updates.
        Updates happen instantly without gas, then settle on-chain when session closes.
      </p>

      {/* Connection status */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${connected ? "text-green-600" : "text-gray-500"}`}>
          {connected ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {connected ? "Connected to Yellow ClearNode" : "Not connected"}
        </div>
        {!connected && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-400"
          >
            {connecting ? "Connecting..." : "Connect to Yellow"}
          </button>
        )}
      </div>

      {connected && !sessionActive && !settlementTx && (
        <button
          onClick={handleStartSession}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Play className="w-4 h-4" />
          Start Liabilities Session
        </button>
      )}

      {sessionActive && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-700 mb-2">
              Session ID: <code>{sessionId}</code>
            </div>
            <div className="text-sm text-yellow-700">
              Round: {round} | Total Liabilities: {getTotalLiabilities()}
            </div>
          </div>

          <div className="space-y-3">
            {demoUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-white border rounded-lg"
              >
                <div>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.id}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpdateAllocation(user.id, -10)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-lg w-16 text-center">
                    {allocations[user.id] || "0"}
                  </span>
                  <button
                    onClick={() => handleUpdateAllocation(user.id, 10)}
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleCloseSession}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Square className="w-4 h-4" />
            Close Session & Settle On-Chain
          </button>
        </div>
      )}

      {settlementTx && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
              <CheckCircle className="w-5 h-5" />
              Session Settled On-Chain!
            </div>
            <div className="text-sm text-green-600">
              Settlement Tx: <code className="text-xs">{settlementTx.slice(0, 20)}...</code>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="font-medium mb-2">Final Liabilities Snapshot</div>
            <div className="text-sm text-gray-600 mb-3">
              Total: {getTotalLiabilities()} | Users: {Object.keys(allocations).length}
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Export as liabilities.csv
            </button>
          </div>
        </div>
      )}

      {/* Event log */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
          <div className="text-xs font-mono space-y-1">
            {logs.slice(-10).map((log, i) => (
              <div
                key={i}
                className={`${
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "sent"
                    ? "text-blue-400"
                    : log.type === "received"
                    ? "text-green-400"
                    : "text-gray-400"
                }`}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
