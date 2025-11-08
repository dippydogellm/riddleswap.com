import { ethers } from 'ethers';
import { decryptEthWallet, getEthProvider } from './eth-wallet';

export async function sendEthPayment(
  handle: string,
  password: string,
  destination: string,
  amount: string,
  tokenAddress?: string,
  network: string = 'ethereum'
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    const { wallet } = await decryptEthWallet(handle, password);
    const provider = await getEthProvider(network);
    const connectedWallet = wallet.connect(provider);
    
    if (!tokenAddress) {
      // Native token transfer
      const tx = await connectedWallet.sendTransaction({
        to: destination,
        value: ethers.parseEther(amount)
      });
      
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt?.hash
      };
    } else {
      // ERC20 token transfer
      const erc20ABI = [
        'function transfer(address to, uint256 amount) returns (bool)'
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, connectedWallet);
      const decimals = 18; // Would fetch from contract
      const tx = await tokenContract.transfer(destination, ethers.parseUnits(amount, decimals));
      const receipt = await tx.wait();
      
      return {
        success: true,
        txHash: receipt?.hash
      };
    }
    
  } catch (error) {
    console.error('Payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment failed'
    };
  }
}