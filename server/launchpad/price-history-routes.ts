import { Express, Request, Response } from "express";
import { db } from "../db";
import { 
  bondingCurvePriceHistory,
  tokenLaunches,
  presaleContributions,
  launchpadAnalytics,
  type TokenLaunch
} from "@shared/schema";
import { eq, desc, gte, lte, count, sum, avg } from "drizzle-orm";
import { z } from "zod";

interface PriceDataPoint {
  id: string;
  timestamp: string;
  tokenPrice: string;
  marketCap: string;
  totalInvested: string;
  tokensCirculating: string;
  volume?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}

interface CandlestickData extends PriceDataPoint {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: string;
}

interface LaunchMetrics {
  currentPrice: string;
  priceChange24h: string;
  marketCap: string;
  volume24h: string;
  totalRaised: string;
  participantCount: number;
  progressToGoal: string;
  avgContributionSize: string;
  nftHolderPercentage: string;
}

// Helper function to get time range filter
function getTimeRangeFilter(range: string): Date {
  const now = new Date();
  
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '6h':
      return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return new Date(0); // Beginning of time
  }
}

// Helper function to aggregate price data into candlesticks
function aggregateToCandlesticks(priceData: any[], intervalMinutes: number = 15): CandlestickData[] {
  if (!priceData.length) return [];

  const candlesticks: CandlestickData[] = [];
  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Group data by time intervals
  const groupedData = new Map<number, any[]>();
  
  priceData.forEach(point => {
    const timestamp = new Date(point.createdAt).getTime();
    const intervalStart = Math.floor(timestamp / intervalMs) * intervalMs;
    
    if (!groupedData.has(intervalStart)) {
      groupedData.set(intervalStart, []);
    }
    groupedData.get(intervalStart)!.push(point);
  });

  // Create candlesticks from grouped data
  for (const [intervalStart, points] of groupedData) {
    if (points.length === 0) continue;
    
    const prices = points.map(p => parseFloat(p.tokenPrice));
    const volumes = points.map(p => parseFloat(p.totalInvested) || 0);
    
    const open = prices[0];
    const close = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const volume = volumes.reduce((sum, v) => sum + v, 0);
    
    const lastPoint = points[points.length - 1];
    
    candlesticks.push({
      id: `candle_${intervalStart}`,
      timestamp: new Date(intervalStart).toISOString(),
      tokenPrice: close.toString(),
      marketCap: lastPoint.marketCap,
      totalInvested: lastPoint.totalInvested,
      tokensCirculating: lastPoint.tokensCirculating,
      open: open.toString(),
      high: high.toString(),
      low: low.toString(),
      close: close.toString(),
      volume: volume.toString()
    });
  }

  return candlesticks.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function setupPriceHistoryAPI(app: Express) {

  // Get price history for a specific launch with time range filtering
  app.get("/api/launchpad/price-history/:launchId", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      const range = req.query.range as string || '24h';
      const format = req.query.format as string || 'raw'; // 'raw' or 'candlestick'
      
      if (isNaN(launchId)) {
        return res.status(400).json({ error: "Invalid launch ID" });
      }

      const timeFilter = getTimeRangeFilter(range);
      
      // Fetch price history data
      const priceHistory = await db
        .select()
        .from(bondingCurvePriceHistory)
        .where(
          eq(bondingCurvePriceHistory.launchId, launchId)
        )
        .orderBy(desc(bondingCurvePriceHistory.createdAt))
        .limit(range === 'all' ? 1000 : 500); // Limit results for performance

      // Filter by time range
      const filteredHistory = priceHistory.filter(point => 
        new Date(point.createdAt!) >= timeFilter
      );

      if (format === 'candlestick' && filteredHistory.length > 50) {
        // Aggregate into candlesticks for better visualization
        const intervalMinutes = range === '1h' ? 5 : range === '6h' ? 15 : range === '24h' ? 60 : 240;
        const candlestickData = aggregateToCandlesticks(filteredHistory, intervalMinutes);
        res.json(candlestickData);
      } else {
        // Return raw price data
        const formattedData: PriceDataPoint[] = filteredHistory.map(point => ({
          id: point.id,
          timestamp: point.createdAt!.toISOString(),
          tokenPrice: point.tokenPrice,
          marketCap: point.marketCap,
          totalInvested: point.totalInvested,
          tokensCirculating: point.tokensCirculating
        }));
        
        res.json(formattedData);
      }
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });

  // Get real-time metrics for a launch
  app.get("/api/launchpad/metrics/:launchId", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      
      if (isNaN(launchId)) {
        return res.status(400).json({ error: "Invalid launch ID" });
      }

      // Get launch details
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));

      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      // Get latest analytics
      const [analytics] = await db
        .select()
        .from(launchpadAnalytics)
        .where(eq(launchpadAnalytics.launchId, launchId))
        .orderBy(desc(launchpadAnalytics.timestamp))
        .limit(1);

      // Get 24h ago analytics for comparison
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [yesterdayAnalytics] = await db
        .select()
        .from(launchpadAnalytics)
        .where(eq(launchpadAnalytics.launchId, launchId))
        .orderBy(desc(launchpadAnalytics.timestamp))
        .limit(1);

      // Calculate 24h statistics
      const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [contributions24h] = await db
        .select({
          totalVolume: sum(presaleContributions.amount),
          count: count(),
          avgContribution: avg(presaleContributions.amount),
        })
        .from(presaleContributions)
        .where(
          eq(presaleContributions.launchId, launchId)
        );

      // Calculate NFT holder statistics
      const [nftHolderStats] = await db
        .select({
          nftHolderCount: count(),
        })
        .from(presaleContributions)
        .where(
          eq(presaleContributions.launchId, launchId)
        );

      const [totalContributors] = await db
        .select({
          total: count(),
        })
        .from(presaleContributions)
        .where(eq(presaleContributions.launchId, launchId));

      // Calculate price change
      const currentPrice = parseFloat(launch.currentTokenPrice);
      const yesterdayPrice = yesterdayAnalytics ? parseFloat(yesterdayAnalytics.currentPrice) : currentPrice;
      const priceChange24h = yesterdayPrice > 0 ? ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100 : 0;

      // Calculate progress to goal
      const totalRaised = parseFloat(launch.totalRaised);
      const fundingGoal = parseFloat(launch.fundingGoal);
      const progressToGoal = fundingGoal > 0 ? (totalRaised / fundingGoal) * 100 : 0;

      // Calculate NFT holder percentage
      const nftHolderPercentage = totalContributors.total > 0 ? 
        (nftHolderStats.nftHolderCount / totalContributors.total) * 100 : 0;

      const metrics: LaunchMetrics = {
        currentPrice: launch.currentTokenPrice,
        priceChange24h: priceChange24h.toFixed(4),
        marketCap: launch.currentMarketCap,
        volume24h: contributions24h.totalVolume || "0",
        totalRaised: launch.totalRaised,
        participantCount: launch.participantCount,
        progressToGoal: progressToGoal.toFixed(2),
        avgContributionSize: contributions24h.avgContribution || "0",
        nftHolderPercentage: nftHolderPercentage.toFixed(2)
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching launch metrics:", error);
      res.status(500).json({ error: "Failed to fetch launch metrics" });
    }
  });

  // Get aggregated market data for all launches
  app.get("/api/launchpad/market-overview", async (req: Request, res: Response) => {
    try {
      // Get all active launches with their latest data
      const activeLaunches = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.status, "active"))
        .orderBy(desc(tokenLaunches.totalRaised))
        .limit(20);

      const marketData = await Promise.all(
        activeLaunches.map(async launch => {
          // Get latest price history
          const [latestPrice] = await db
            .select()
            .from(bondingCurvePriceHistory)
            .where(eq(bondingCurvePriceHistory.launchId, launch.id))
            .orderBy(desc(bondingCurvePriceHistory.createdAt))
            .limit(1);

          // Get 24h volume
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const [volume24h] = await db
            .select({
              volume: sum(presaleContributions.amount)
            })
            .from(presaleContributions)
            .where(
              eq(presaleContributions.launchId, launch.id)
            );

          return {
            id: launch.id,
            tokenName: launch.tokenName,
            tokenSymbol: launch.tokenSymbol,
            tokenLogo: launch.tokenLogo,
            chainType: launch.chainType,
            currentPrice: launch.currentTokenPrice,
            marketCap: launch.currentMarketCap,
            volume24h: volume24h.volume || "0",
            totalRaised: launch.totalRaised,
            participantCount: launch.participantCount,
            fundingGoal: launch.fundingGoal,
            useBondingCurve: launch.useBondingCurve,
            enableNftGating: launch.enableNftGating,
            autoLaunchTriggered: launch.autoLaunchTriggered,
            progressPercentage: parseFloat(launch.fundingGoal) > 0 ? 
              (parseFloat(launch.totalRaised) / parseFloat(launch.fundingGoal)) * 100 : 0
          };
        })
      );

      res.json({
        launches: marketData,
        totalActiveLaunches: activeLaunches.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching market overview:", error);
      res.status(500).json({ error: "Failed to fetch market overview" });
    }
  });

  // Real-time price update endpoint (for WebSocket alternative)
  app.post("/api/launchpad/update-price/:launchId", async (req: Request, res: Response) => {
    try {
      const launchId = parseInt(req.params.launchId);
      const { contributionId } = req.body;

      if (isNaN(launchId)) {
        return res.status(400).json({ error: "Invalid launch ID" });
      }

      // Get the launch
      const [launch] = await db
        .select()
        .from(tokenLaunches)
        .where(eq(tokenLaunches.id, launchId));

      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      // Calculate new price based on bonding curve if enabled
      if (launch.useBondingCurve) {
        try {
          const response = await fetch('http://localhost:5000/api/devtools/bonding-curve/calculate-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              basePrice: launch.basePrice,
              curveCoefficient: launch.curveCoefficient,
              totalInvested: launch.totalRaised,
              fundingGoal: launch.fundingGoal,
              newInvestment: "0" // Just for current price calculation
            })
          });

          if (response.ok) {
            const pricingData = await response.json() as any;
            
            // Update launch with new pricing
            await db.update(tokenLaunches)
              .set({ 
                currentTokenPrice: pricingData.currentPrice,
                currentMarketCap: pricingData.currentMarketCap,
                updatedAt: new Date()
               } as any)
              .where(eq(tokenLaunches.id, launchId));

            // Add to price history
            await db.insert(bondingCurvePriceHistory).values({
              launchId,
              tokenPrice: pricingData.currentPrice,
              marketCap: pricingData.currentMarketCap,
              totalInvested: launch.totalRaised,
              tokensCirculating: pricingData.tokensReceived || "0",
              contributionId: contributionId || null
            } as any);

            res.json({
              success: true,
              newPrice: pricingData.currentPrice,
              newMarketCap: pricingData.currentMarketCap
            });
          } else {
            throw new Error('Failed to calculate bonding curve price');
          }
        } catch (error) {
          console.error('Error calculating bonding curve price:', error);
          res.status(500).json({ error: "Failed to update price" });
        }
      } else {
        res.json({ success: true, message: "Static pricing - no update needed" });
      }
    } catch (error) {
      console.error("Error updating price:", error);
      res.status(500).json({ error: "Failed to update price" });
    }
  });

  // Get price comparison data (multiple launches)
  app.post("/api/launchpad/price-comparison", async (req: Request, res: Response) => {
    try {
      const { launchIds, range = '24h' } = req.body;
      
      if (!Array.isArray(launchIds) || launchIds.length === 0) {
        return res.status(400).json({ error: "Invalid launch IDs array" });
      }

      const timeFilter = getTimeRangeFilter(range);
      const comparisonData = [];

      for (const launchId of launchIds) {
        const [launch] = await db
          .select()
          .from(tokenLaunches)
          .where(eq(tokenLaunches.id, launchId));

        if (!launch) continue;

        const priceHistory = await db
          .select()
          .from(bondingCurvePriceHistory)
          .where(eq(bondingCurvePriceHistory.launchId, launchId))
          .orderBy(desc(bondingCurvePriceHistory.createdAt))
          .limit(100);

        const filteredHistory = priceHistory.filter(point => 
          new Date(point.createdAt!) >= timeFilter
        );

        comparisonData.push({
          launchId,
          tokenName: launch.tokenName,
          tokenSymbol: launch.tokenSymbol,
          currentPrice: launch.currentTokenPrice,
          priceHistory: filteredHistory.map(point => ({
            timestamp: point.createdAt!.toISOString(),
            price: point.tokenPrice
          }))
        });
      }

      res.json(comparisonData);
    } catch (error) {
      console.error("Error fetching price comparison:", error);
      res.status(500).json({ error: "Failed to fetch price comparison" });
    }
  });
}