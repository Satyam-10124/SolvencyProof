"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { sepolia } from "viem/chains";
import { CheckCircle, Clock, Shield, ExternalLink } from "lucide-react";

interface EpochProof {
  epochId: string;
  liabilitiesRoot: string;
  reservesTotal: string;
  timestamp: number;
  submitter: string;
  verified: boolean;
}

export default function PublicDashboard() {
  const [epochs, setEpochs] = useState<EpochProof[]>([]);
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  useEffect(() => {
    loadEpochs();
  }, [publicClient]);

  const loadEpochs = async () => {
    setLoading(true);
    
    // In real app, fetch from contract events
    // For demo, show mock data
    await new Promise((r) => setTimeout(r, 1000));
    
    setEpochs([
      {
        epochId: "epoch_001",
        liabilitiesRoot: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        reservesTotal: "1.5",
        timestamp: Date.now() - 86400000,
        submitter: "0x742d35Cc6634C0532925a3b844Bc9e7595f8E2aE",
        verified: true,
      },
    ]);
    
    setLoading(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold">Public Solvency Dashboard</h2>
        </div>
        <button
          onClick={loadEpochs}
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      <p className="text-gray-600 text-sm">
        View all verified solvency proofs published on Ethereum Sepolia.
        Each epoch proves that reserves ≥ liabilities at that point in time.
      </p>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Loading epochs from Sepolia...
        </div>
      ) : epochs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No verified epochs found.
        </div>
      ) : (
        <div className="space-y-4">
          {epochs.map((epoch) => (
            <div
              key={epoch.epochId}
              className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-bold text-lg">{epoch.epochId}</span>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  Verified ✅
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Reserves Total</div>
                  <div className="font-mono font-medium">{epoch.reservesTotal} ETH</div>
                </div>
                <div>
                  <div className="text-gray-500">Liabilities Root</div>
                  <div className="font-mono text-xs">
                    {epoch.liabilitiesRoot.slice(0, 16)}...
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Timestamp
                  </div>
                  <div>{formatDate(epoch.timestamp)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Submitter</div>
                  <div className="font-mono text-xs">
                    {formatAddress(epoch.submitter)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <a
                  href={`https://sepolia.etherscan.io/address/${epoch.submitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  View on Etherscan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
