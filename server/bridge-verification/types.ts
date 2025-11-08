// Bridge Verification Types

export interface VerificationRequest {
  txHash: string;
  expectedMemo?: string;
  fromAddress?: string;
  toAddress?: string;
  amount?: string;
  chain: string;
}

export interface VerificationResponse {
  verified: boolean;
  memoMatch?: boolean;
  transactionId?: string;
  actualAmount?: string;
  message?: string;
  blockNumber?: number;
  confirmations?: number;
}

export interface ChainVerifier {
  verify(request: VerificationRequest): Promise<VerificationResponse>;
  getConfirmations(txHash: string): Promise<number>;
}