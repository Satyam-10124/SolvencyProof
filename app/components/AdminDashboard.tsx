"use client";

import { useState } from "react";
import {
  Upload,
  Search,
  Shield,
  Send,
  CheckCircle,
  AlertCircle,
  FileText,
  Wallet,
} from "lucide-react";

interface AdminDashboardProps {
  address: string;
  onSepolia: boolean;
}

interface Step {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  result?: string;
}

export default function AdminDashboard({ address, onSepolia }: AdminDashboardProps) {
  const [steps, setSteps] = useState<Step[]>([
    { id: "liabilities", title: "Build Liabilities Merkle Tree", status: "pending" },
    { id: "reserves", title: "Scan Reserves on Sepolia", status: "pending" },
    { id: "proof", title: "Generate ZK Solvency Proof", status: "pending" },
    { id: "submit", title: "Submit Proof On-Chain", status: "pending" },
  ]);

  const [liabilitiesRoot, setLiabilitiesRoot] = useState<string>("");
  const [reservesTotal, setReservesTotal] = useState<string>("");
  const [epochId, setEpochId] = useState<string>("epoch_001");

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleBuildLiabilities = async () => {
    updateStep("liabilities", { status: "running" });
    
    // Simulate building liabilities (in real app, call backend API)
    await new Promise((r) => setTimeout(r, 1500));
    
    const mockRoot = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    setLiabilitiesRoot(mockRoot);
    
    updateStep("liabilities", {
      status: "done",
      result: `Root: ${mockRoot.slice(0, 20)}...`,
    });
  };

  const handleScanReserves = async () => {
    if (!onSepolia) {
      updateStep("reserves", { status: "error", result: "Switch to Sepolia first" });
      return;
    }

    updateStep("reserves", { status: "running" });
    
    // Simulate scanning reserves
    await new Promise((r) => setTimeout(r, 2000));
    
    const mockTotal = "1.5";
    setReservesTotal(mockTotal);
    
    updateStep("reserves", {
      status: "done",
      result: `Total: ${mockTotal} ETH`,
    });
  };

  const handleGenerateProof = async () => {
    if (!liabilitiesRoot || !reservesTotal) {
      updateStep("proof", { status: "error", result: "Complete previous steps first" });
      return;
    }

    updateStep("proof", { status: "running" });
    
    // Simulate proof generation
    await new Promise((r) => setTimeout(r, 3000));
    
    updateStep("proof", {
      status: "done",
      result: "Proof generated successfully",
    });
  };

  const handleSubmitOnChain = async () => {
    if (steps[2].status !== "done") {
      updateStep("submit", { status: "error", result: "Generate proof first" });
      return;
    }

    updateStep("submit", { status: "running" });
    
    // Simulate on-chain submission
    await new Promise((r) => setTimeout(r, 2000));
    
    updateStep("submit", {
      status: "done",
      result: "Tx: 0x123...abc (Sepolia)",
    });
  };

  const getStatusIcon = (status: Step["status"]) => {
    switch (status) {
      case "done":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "running":
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getActionButton = (step: Step) => {
    const isRunning = step.status === "running";
    const handlers: Record<string, () => void> = {
      liabilities: handleBuildLiabilities,
      reserves: handleScanReserves,
      proof: handleGenerateProof,
      submit: handleSubmitOnChain,
    };

    const icons: Record<string, React.ReactNode> = {
      liabilities: <Upload className="w-4 h-4" />,
      reserves: <Search className="w-4 h-4" />,
      proof: <Shield className="w-4 h-4" />,
      submit: <Send className="w-4 h-4" />,
    };

    return (
      <button
        onClick={handlers[step.id]}
        disabled={isRunning}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {icons[step.id]}
        {isRunning ? "Processing..." : "Run"}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold">Admin Dashboard</h2>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <FileText className="w-4 h-4" />
          <span>Epoch ID:</span>
        </div>
        <input
          type="text"
          value={epochId}
          onChange={(e) => setEpochId(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="epoch_001"
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex items-center justify-between p-4 bg-white border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{index + 1}</span>
              {getStatusIcon(step.status)}
              <div>
                <div className="font-medium">{step.title}</div>
                {step.result && (
                  <div className={`text-sm ${step.status === "error" ? "text-red-500" : "text-gray-500"}`}>
                    {step.result}
                  </div>
                )}
              </div>
            </div>
            {getActionButton(step)}
          </div>
        ))}
      </div>

      {steps.every((s) => s.status === "done") && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle className="w-5 h-5" />
            Solvency proof published on-chain!
          </div>
          <p className="text-sm text-green-600 mt-1">
            Epoch {epochId} is now publicly verifiable on Sepolia.
          </p>
        </div>
      )}
    </div>
  );
}
