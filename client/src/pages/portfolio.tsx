import { Button } from "@/components/ui/button";
import { useMetadata } from '@/hooks/use-metadata';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, BarChart3, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import "../styles/portfolio.css";

export default function PortfolioPage() {
  // Set SEO metadata for portfolio page
  useMetadata();
  
  return (
    <div className="portfolio-page">
      <div className="portfolio-container">
        <Card className="portfolio-card">
          <CardHeader className="portfolio-header">
            <div className="portfolio-icon">
              <div className="icon-main">
                <Wallet className="w-14 h-14 sm:w-12 sm:h-12 text-white" />
              </div>
              <div className="icon-badge">
                <TrendingUp className="w-5 h-5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <CardTitle className="portfolio-title">Portfolio Tracker</CardTitle>
            <div className="portfolio-subtitle">Coming Soon</div>
          </CardHeader>

          <CardContent className="portfolio-content">
            <p className="portfolio-description">
              Track your XRPL token holdings, view detailed performance analytics, 
              and monitor your investment portfolio in real-time. Get comprehensive 
              insights into your trading history and asset allocation.
            </p>

            <div className="features-grid">
              <Card className="feature-card">
                <CardContent className="feature-content">
                  <BarChart3 className="feature-icon" />
                  <h3 className="feature-title">Real-time Balance</h3>
                  <p className="feature-desc">Live portfolio valuation</p>
                </CardContent>
              </Card>
              <Card className="feature-card">
                <CardContent className="feature-content">
                  <TrendingUp className="feature-icon" />
                  <h3 className="feature-title">P&L Analytics</h3>
                  <p className="feature-desc">Track gains and losses</p>
                </CardContent>
              </Card>
            </div>

            <div className="portfolio-actions">
              <Link href="/" className="w-full sm:w-auto">
                <Button className="action-button primary w-full sm:w-auto min-h-[44px] px-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Button variant="outline" className="action-button secondary w-full sm:w-auto min-h-[44px] px-4" disabled>
                Notify When Ready
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
