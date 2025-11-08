// Import the modern swap component
import ModernXRPLSwap from './modern-xrpl-swap';

interface RiddleXRPLSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  totalBalance: string;
  reserve: string;
}

export default function RiddleXRPLSwap({ 
  isWalletConnected, 
  walletAddress, 
  walletHandle, 
  balance, 
  totalBalance, 
  reserve 
}: RiddleXRPLSwapProps) {
  // Use the modern swap UI instead of complex legacy component
  return (
    <ModernXRPLSwap
      isWalletConnected={isWalletConnected}
      walletAddress={walletAddress}
      walletHandle={walletHandle}
      balance={balance}
      totalBalance={totalBalance}
      reserve={reserve}
    />
  );
}
