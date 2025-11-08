import { Card } from "@/components/ui/card";
import { Coins, Package, Zap, Wheat, Users, Heart, Shield, Star } from "lucide-react";

interface ResourceHUDProps {
  city: any;
}

export function ResourceHUD({ city }: ResourceHUDProps) {
  const resources = [
    {
      icon: Coins,
      label: "Credits",
      value: parseFloat(city.credits).toLocaleString(),
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Package,
      label: "Materials",
      value: parseFloat(city.materials).toLocaleString(),
      color: "text-gray-600 dark:text-gray-400",
      bgColor: "bg-gray-50 dark:bg-gray-900/20"
    },
    {
      icon: Zap,
      label: "Energy",
      value: parseFloat(city.energy).toLocaleString(),
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      icon: Wheat,
      label: "Food",
      value: parseFloat(city.food).toLocaleString(),
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      icon: Users,
      label: "Population",
      value: `${city.population}/${city.populationCapacity}`,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      icon: Heart,
      label: "Happiness",
      value: `${city.happiness}%`,
      color: "text-pink-600 dark:text-pink-400",
      bgColor: "bg-pink-50 dark:bg-pink-900/20"
    },
    {
      icon: Shield,
      label: "Defense",
      value: city.defenseRating.toString(),
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    },
    {
      icon: Star,
      label: "Level",
      value: city.cityLevel.toString(),
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {resources.map((resource) => (
        <Card
          key={resource.label}
          className={`${resource.bgColor} border-2 border-orange-200 dark:border-orange-900`}
        >
          <div className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <resource.icon className={`w-4 h-4 ${resource.color}`} />
            </div>
            <div>
              <div className={`text-lg font-bold ${resource.color}`}>
                {resource.value}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {resource.label}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
