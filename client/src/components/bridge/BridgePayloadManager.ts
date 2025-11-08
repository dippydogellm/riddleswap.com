// Bridge Payload Manager - Client-side payload handling
export interface BridgePayload {
  transactionId: string;
  uuid: string;
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  bankAddress: string;
  expectedMemo: string;
  bridgeFee: string;
  outputAmount: string;
  instructions: string;
}

export interface BridgeResponse {
  success: boolean;
  payload?: BridgePayload;
  error?: string;
  transactionId?: string;
  uuid?: string;
  bankWalletAddress?: string;
  estimatedOutput?: string;
  bridgeFee?: string;
  fromChain?: string;
  toChain?: string;
  expectedMemo?: string;
  instructions?: string;
  message?: string;
}

export interface VerificationResponse {
  success: boolean;
  verified?: boolean;
  error?: string;
  message?: string;
}

export interface CompletionResponse {
  success: boolean;
  txHash?: string;
  amount?: string;
  error?: string;
  message?: string;
  alreadyCompleted?: boolean;
}
