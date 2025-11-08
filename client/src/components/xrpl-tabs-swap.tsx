import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import XRPLInstantSwap from './xrpl-instant-swap';
import XRPLLimitOrders from './xrpl-limit-orders';
import { Zap, Clock, TrendingUp } from 'lucide-react';

interface XRPLTabsSwapProps {
  isWalletConnected: boolean;
  walletAddress: string | null;
  walletHandle: string | null;
  balance: string;
  totalBalance: string;
  reserve: string;
}

export default function XRPLTabsSwap({
  isWalletConnected,
  walletAddress,
  walletHandle,
  balance,
  totalBalance,
  reserve
}: XRPLTabsSwapProps) {
  const [activeTab, setActiveTab] = useState('instant');

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="instant" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Instant Swap
            <Badge variant="secondary" className="ml-1 text-xs">Payment</Badge>
          </TabsTrigger>
          <TabsTrigger value="limit" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Limit Orders
            <Badge variant="secondary" className="ml-1 text-xs">OfferCreate</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instant" className="space-y-4">
          <Card className="border-2 border-blue-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Instant Payment Swap
                </CardTitle>
                <Badge variant="outline" className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Market Rate
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Execute immediate swaps using Payment transactions with tfPartialPayment flag
              </p>
            </CardHeader>
            <CardContent>
              <XRPLInstantSwap
                isWalletConnected={isWalletConnected}
                walletAddress={walletAddress}
                walletHandle={walletHandle}
                balance={balance}
                totalBalance={totalBalance}
                reserve={reserve}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limit" className="space-y-4">
          <Card className="border-2 border-purple-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Limit Order DEX
                </CardTitle>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Set Price
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Place standing orders using OfferCreate transactions with custom exchange rates
              </p>
            </CardHeader>
            <CardContent>
              <XRPLLimitOrders
                isWalletConnected={isWalletConnected}
                walletAddress={walletAddress}
                walletHandle={walletHandle}
                balance={balance}
                totalBalance={totalBalance}
                reserve={reserve}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
