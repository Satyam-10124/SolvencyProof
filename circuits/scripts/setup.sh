#!/bin/bash
set -e

echo "🔧 Setting up ZK circuit..."

# Create build directory
mkdir -p build

# Compile circuit
echo "📦 Compiling solvency.circom..."
circom solvency.circom --r1cs --wasm --sym -o build

# Download powers of tau (use a small one for demo)
if [ ! -f "build/pot12_final.ptau" ]; then
  echo "📥 Downloading powers of tau..."
  curl -L -o build/pot12_final.ptau https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
fi

# Generate proving key
echo "🔑 Generating proving key..."
npx snarkjs groth16 setup build/solvency.r1cs build/pot12_final.ptau build/solvency_0000.zkey

# Contribute to phase 2 (random contribution for demo)
echo "🎲 Phase 2 contribution..."
npx snarkjs zkey contribute build/solvency_0000.zkey build/solvency_final.zkey --name="SolvencyProof Demo" -v -e="random entropy for demo"

# Export verification key
echo "📤 Exporting verification key..."
npx snarkjs zkey export verificationkey build/solvency_final.zkey build/verification_key.json

# Export Solidity verifier
echo "📝 Generating Solidity verifier..."
npx snarkjs zkey export solidityverifier build/solvency_final.zkey ../contracts/contracts/Groth16Verifier.sol

echo "✅ ZK circuit setup complete!"
echo "   - Proving key: build/solvency_final.zkey"
echo "   - Verification key: build/verification_key.json"
echo "   - Solidity verifier: ../contracts/contracts/Groth16Verifier.sol"
