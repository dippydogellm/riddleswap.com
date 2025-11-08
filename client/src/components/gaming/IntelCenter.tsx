import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Target } from "lucide-react";

export const IntelCenter = () => {
  return (
    <Card className="gaming-component-card border-cyan-500/30">
      <CardHeader>
        <CardTitle className="text-cyan-300 font-mono flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          FIELD INTELLIGENCE REPORT
        </CardTitle>
        <CardDescription className="text-slate-400">
          Leaderboards, analytics, and strategic intelligence
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Trophy className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Intelligence data coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
};
