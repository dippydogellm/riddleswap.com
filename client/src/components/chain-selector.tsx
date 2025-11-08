import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const SUPPORTED_CHAINS = {
  ethereum: {
    name: 'Ethereum', 
    logo: '/images/chains/ethereum-logo.png',
    description: 'Ethereum Mainnet'
  },
  solana: {
    name: 'Solana',
    logo: '/images/chains/solana-logo.png', 
    description: 'Solana Mainnet'
  }
};

export type ChainType = keyof typeof SUPPORTED_CHAINS;

interface ChainSelectorProps {
  selectedChain: ChainType;
  onChainChange: (chain: ChainType) => void;
  className?: string;
}

export function ChainSelector({ selectedChain, onChainChange, className }: ChainSelectorProps) {
  return (
    <Select value={selectedChain} onValueChange={onChainChange}>
      <SelectTrigger className={`h-8 w-auto min-w-28 text-xs ${className}`}>
        <SelectValue>
          <div className="flex items-center space-x-1">
            <img src={SUPPORTED_CHAINS[selectedChain].logo} alt={SUPPORTED_CHAINS[selectedChain].name} className="w-4 h-4 rounded-full" />
            <span className="font-medium">{SUPPORTED_CHAINS[selectedChain].name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(SUPPORTED_CHAINS).map(([chainKey, chain]) => (
          <SelectItem key={chainKey} value={chainKey}>
            <div className="flex items-center space-x-2">
              <img src={chain.logo} alt={chain.name} className="w-4 h-4 rounded-full" />
              <div>
                <div className="font-medium">{chain.name}</div>
                <div className="text-xs text-muted-foreground">{chain.description}</div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { SUPPORTED_CHAINS };
