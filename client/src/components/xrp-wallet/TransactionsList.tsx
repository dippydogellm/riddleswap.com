import React from 'react';
import { Paper, Typography, Stack, Avatar } from '@mui/material';
import { Image, MonetizationOn as Coins, Send } from '@mui/icons-material';

export interface TransactionItem {
  hash: string;
  type?: string;
  isNFT?: boolean;
  isToken?: boolean;
  nftInfo?: { nftokenID?: string };
  tokenInfo?: { currency: string; issuer: string; symbol?: string };
  amount?: string;
  fee?: string;
  direction?: 'received' | 'sent' | string;
  date?: string | number;
  to?: string;
  from?: string;
}

export interface TransactionsListProps {
  transactions: TransactionItem[];
  availableTokens: Array<{ currency: string; issuer: string; icon_url?: string }>;
  walletAddress?: string;
  onSelect: (tx: TransactionItem) => void;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({ transactions, availableTokens, walletAddress, onSelect }) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-6">
        <Typography variant="body1" color="text.secondary">No transactions found</Typography>
      </div>
    );
  }

  return (
    <Stack spacing={2}>
      {transactions.slice(0, 50).map((tx, index) => {
        return (
          <Paper
            key={tx.hash || index}
            sx={{ p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}
            onClick={() => onSelect(tx)}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {tx.isNFT && tx.nftInfo?.nftokenID ? (
                  <Avatar variant="rounded" sx={{ width: 48, height: 48 }}>
                    <Image sx={{ fontSize: 20 }} />
                  </Avatar>
                ) : tx.isToken && tx.tokenInfo ? (
                  <Avatar variant="rounded" sx={{ width: 48, height: 48 }}>
                    <Coins sx={{ fontSize: 20 }} />
                  </Avatar>
                ) : (
                  <Avatar variant="rounded" sx={{ width: 48, height: 48 }}>
                    <Send sx={{ fontSize: 20 }} />
                  </Avatar>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-8 mb-1">
                  <Typography variant="body2" fontWeight={600}>{tx.type || 'Transaction'}</Typography>
                  {tx.date && (
                    <Typography variant="caption" color="text.secondary">{new Date(tx.date).toLocaleString()}</Typography>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  {tx.amount && tx.amount !== '0' && (
                    <div className="flex items-center gap-1">
                      <Typography variant="caption" color="text.secondary">Amount:</Typography>
                      <Typography variant="body2" fontWeight={600}>{tx.amount}</Typography>
                    </div>
                  )}
                  {tx.fee && (
                    <div className="flex items-center gap-1">
                      <Typography variant="caption" color="text.secondary">Fee:</Typography>
                      <Typography variant="body2">{tx.fee} XRP</Typography>
                    </div>
                  )}
                </div>
                {(tx.to || tx.from) && (
                  <div className="mb-1">
                    {tx.to && tx.to !== walletAddress && (
                      <div className="flex items-center gap-1 text-xs">
                        <Typography variant="caption" color="text.secondary">To:</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.to}</Typography>
                      </div>
                    )}
                    {tx.from && tx.from !== walletAddress && (
                      <div className="flex items-center gap-1 text-xs">
                        <Typography variant="caption" color="text.secondary">From:</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.from}</Typography>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Typography variant="caption" color="text.secondary">Hash:</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.hash}</Typography>
                </div>
              </div>
            </div>
          </Paper>
        );
      })}
    </Stack>
  );
};
