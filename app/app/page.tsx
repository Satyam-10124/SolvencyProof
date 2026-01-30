"use client";

import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { sepolia } from "wagmi/chains";

export default function HomePage() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const onSepolia = chainId === sepolia.id;

  return (
    <main>
      <h1>SolvencyProof</h1>
      <p>Day 1 scaffolding: wallet connect + Sepolia network guard.</p>

      <div className="card">
        <div className="row">
          {!isConnected ? (
            <>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                >
                  Connect Wallet
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="secondary" onClick={() => disconnect()}>
                Disconnect
              </button>
              <div>
                <div>
                  Address: <code>{address}</code>
                </div>
                <div>
                  ChainId: <code>{chainId}</code>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isConnected && !onSepolia && (
        <div className="card">
          <strong>Please switch to Ethereum Sepolia.</strong>
        </div>
      )}

      {isConnected && onSepolia && (
        <div className="card">
          <strong>Connected to Sepolia ✅</strong>
        </div>
      )}
    </main>
  );
}
