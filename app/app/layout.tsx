import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "SolvencyProof",
  description: "Privacy-preserving solvency proofs verified on Ethereum Sepolia"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
