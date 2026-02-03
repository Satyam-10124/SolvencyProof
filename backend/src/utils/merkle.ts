import { keccak256, encodePacked, toHex } from "viem";

export interface MerkleLeaf {
  userId: string;
  balance: bigint;
  hash: `0x${string}`;
  index: number;
}

export interface MerkleProof {
  userId: string;
  balance: string;
  leafHash: string;
  proof: string[];
  index: number;
  root: string;
}

export interface MerkleTree {
  root: `0x${string}`;
  leaves: MerkleLeaf[];
  layers: `0x${string}`[][];
  total: bigint;
}

export function hashLeaf(userId: string, balance: bigint): `0x${string}` {
  return keccak256(encodePacked(["string", "uint256"], [userId, balance]));
}

export function hashPair(a: `0x${string}`, b: `0x${string}`): `0x${string}` {
  const sorted = a < b ? [a, b] : [b, a];
  return keccak256(encodePacked(["bytes32", "bytes32"], sorted as [`0x${string}`, `0x${string}`]));
}

export function buildMerkleTree(
  entries: { userId: string; balance: bigint }[]
): MerkleTree {
  if (entries.length === 0) {
    throw new Error("Cannot build Merkle tree with zero entries");
  }

  const leaves: MerkleLeaf[] = entries.map((e, i) => ({
    userId: e.userId,
    balance: e.balance,
    hash: hashLeaf(e.userId, e.balance),
    index: i,
  }));

  const total = entries.reduce((sum, e) => sum + e.balance, 0n);

  let currentLayer = leaves.map((l) => l.hash);
  const layers: `0x${string}`[][] = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer: `0x${string}`[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves,
    layers,
    total,
  };
}

export function generateProof(tree: MerkleTree, leafIndex: number): string[] {
  const proof: string[] = [];
  let idx = leafIndex;

  for (let i = 0; i < tree.layers.length - 1; i++) {
    const layer = tree.layers[i];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    if (siblingIdx < layer.length) {
      proof.push(layer[siblingIdx]);
    }

    idx = Math.floor(idx / 2);
  }

  return proof;
}

export function verifyProof(
  leafHash: `0x${string}`,
  proof: `0x${string}`[],
  root: `0x${string}`,
  leafIndex: number
): boolean {
  let computedHash = leafHash;
  let idx = leafIndex;

  for (const sibling of proof) {
    computedHash = hashPair(computedHash, sibling);
    idx = Math.floor(idx / 2);
  }

  return computedHash === root;
}
