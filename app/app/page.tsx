"use client";

import { useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Shield, Users, Zap, Eye } from "lucide-react";
import AdminDashboard from "../components/AdminDashboard";
import UserVerification from "../components/UserVerification";
import PublicDashboard from "../components/PublicDashboard";
import YellowSession from "../components/YellowSession";

type Tab = "admin" | "verify" | "public" | "yellow";

export default function HomePage() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [activeTab, setActiveTab] = useState<Tab>("public");

  const onSepolia = chainId === sepolia.id;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "public", label: "Dashboard", icon: <Eye className="w-4 h-4" /> },
    { id: "admin", label: "Admin", icon: <Shield className="w-4 h-4" /> },
    { id: "verify", label: "Verify", icon: <Users className="w-4 h-4" /> },
    { id: "yellow", label: "Yellow", icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold">SolvencyProof</h1>
          </div>

          <div className="flex items-center gap-4">
            {!isConnected ? (
              connectors.slice(0, 1).map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {isPending ? "Connecting..." : "Connect Wallet"}
                </button>
              ))
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <div className="font-mono text-gray-600">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </div>
                  <div className={`text-xs ${onSepolia ? "text-green-600" : "text-red-600"}`}>
                    {onSepolia ? "Sepolia ✓" : "Wrong Network"}
                  </div>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="max-w-4xl mx-auto px-4">
            <nav className="flex gap-1 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">ZK Solvency Proofs</h2>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Prove reserves exceed liabilities without revealing sensitive data.
              Powered by ZK-SNARKs and Yellow Network state channels.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <span className="px-3 py-1 bg-gray-100 rounded-full">Ethereum Sepolia</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">Circom + Groth16</span>
              <span className="px-3 py-1 bg-yellow-100 rounded-full">Yellow SDK</span>
            </div>
          </div>
        ) : !onSepolia ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Wrong Network</h2>
            <p className="text-gray-600">
              Please switch to Ethereum Sepolia to use this app.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border p-6">
            {activeTab === "admin" && <AdminDashboard address={address!} onSepolia={onSepolia} />}
            {activeTab === "verify" && <UserVerification />}
            {activeTab === "public" && <PublicDashboard />}
            {activeTab === "yellow" && <YellowSession address={address!} />}
          </div>
        )}
      </div>

      <footer className="border-t bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>SolvencyProof • ETHGlobal HackMoney 2026</p>
          <p className="mt-1">
            <a href="https://github.com" className="text-blue-600 hover:underline">
              GitHub
            </a>
            {" • "}
            <a href="https://sepolia.etherscan.io" className="text-blue-600 hover:underline">
              Sepolia Explorer
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
