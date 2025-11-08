import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Target, Map, Zap } from "lucide-react";

export const DeploymentCenter = () => {
  return (
    <Card className="gaming-component-card border-green-500/30">
      <CardHeader>
        <CardTitle className="text-green-300 font-mono flex items-center gap-2">
          <Shield className="h-5 w-5" />
          DEPLOYMENT CENTER
        </CardTitle>
        <CardDescription className="text-slate-400">
          Deploy forces, manage strategic positions, and coordinate military operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Shield className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Deployment system coming soon</p>
        </div>
      </CardContent>
    </Card>
  );
};
