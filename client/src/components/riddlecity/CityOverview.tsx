import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Coins, Shield, Users, TrendingUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CityOverviewProps {
  city: any;
  onRefresh: () => void;
}

export function CityOverview({ city, onRefresh }: CityOverviewProps) {
  const stats = [
    {
      icon: Building2,
      label: "Total Buildings",
      value: city.totalBuildings,
      color: "text-orange-600"
    },
    {
      icon: Coins,
      label: "Economic Value",
      value: `${parseFloat(city.economicValue).toLocaleString()} credits`,
      color: "text-yellow-600"
    },
    {
      icon: Shield,
      label: "Defense Rating",
      value: city.defenseRating,
      color: "text-red-600"
    },
    {
      icon: Users,
      label: "Population",
      value: `${city.population}/${city.populationCapacity}`,
      color: "text-purple-600"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-2 border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-orange-200 dark:border-orange-900">
        <CardHeader>
          <CardTitle>City Information</CardTitle>
          <CardDescription>Overview of your medieval settlement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">City Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">City Level:</span>
                  <span className="font-medium">Level {city.cityLevel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                  <span className="font-medium">{city.experiencePoints} XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Plot Size:</span>
                  <span className="font-medium">{city.plotSize} sq units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Happiness:</span>
                  <span className="font-medium">{city.happiness}%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Activity</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Founded:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(city.foundedAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Last Active:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(city.lastActive), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {city.cityDescription && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {city.cityDescription}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
