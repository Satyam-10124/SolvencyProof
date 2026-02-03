"use client";

import { useState } from "react";
import { Upload, CheckCircle, XCircle, FileSearch } from "lucide-react";

interface InclusionProof {
  userId: string;
  balance: string;
  leafHash: string;
  proof: string[];
  index: number;
  root: string;
}

export default function UserVerification() {
  const [proof, setProof] = useState<InclusionProof | null>(null);
  const [verificationResult, setVerificationResult] = useState<
    "pending" | "valid" | "invalid" | null
  >(null);
  const [error, setError] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.userId || !parsed.balance || !parsed.root || !parsed.proof) {
          throw new Error("Invalid proof format");
        }
        setProof(parsed);
        setError("");
        setVerificationResult(null);
      } catch (err) {
        setError("Invalid proof file format");
        setProof(null);
      }
    };
    reader.readAsText(file);
  };

  const handleVerify = async () => {
    if (!proof) return;

    setVerificationResult("pending");

    // Simulate verification (in real app, verify against on-chain root)
    await new Promise((r) => setTimeout(r, 1500));

    // For demo, always return valid
    setVerificationResult("valid");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileSearch className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold">Verify Your Inclusion</h2>
      </div>

      <p className="text-gray-600 text-sm">
        Upload your inclusion proof file to verify that your balance was included
        in the liabilities Merkle tree for a specific epoch.
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
          id="proof-upload"
        />
        <label
          htmlFor="proof-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <Upload className="w-8 h-8 text-gray-400" />
          <span className="text-gray-600">
            Click to upload <code>inclusion_*.json</code>
          </span>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {proof && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">User ID:</span>
              <code className="text-sm">{proof.userId}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Balance:</span>
              <code className="text-sm">{proof.balance}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Root:</span>
              <code className="text-sm text-xs">{proof.root.slice(0, 20)}...</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Proof siblings:</span>
              <code className="text-sm">{proof.proof.length}</code>
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={verificationResult === "pending"}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400"
          >
            {verificationResult === "pending" ? "Verifying..." : "Verify Inclusion"}
          </button>

          {verificationResult === "valid" && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <div className="font-medium text-green-700">Inclusion Verified ✅</div>
                <div className="text-sm text-green-600">
                  Your balance of {proof.balance} is included in the liabilities root.
                </div>
              </div>
            </div>
          )}

          {verificationResult === "invalid" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-500" />
              <div>
                <div className="font-medium text-red-700">Verification Failed</div>
                <div className="text-sm text-red-600">
                  The proof does not match the published root.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
