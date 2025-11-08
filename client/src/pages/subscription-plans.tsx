import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  ArrowLeft, 
  Zap, 
  Crown, 
  Wallet,
  Shield,
  Clock,
  BarChart3,
  Globe,
  Package
} from 'lucide-react';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  icon: any;
  popular?: boolean;
  features: string[];
  cryptoPrice: {
    XRP: number;
    ETH: number;
    BTC: number;
    SOL: number;
  };
}

export default function SubscriptionPlans() {
  const [planSelected, setPlanSelected] = useState<string | null>(null);
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get project ID and plan from URL params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const projectId = urlParams.get('project');
  const selectedPlanFromUrl = urlParams.get('plan');
  
  // Fetch project details if projectId is provided
  const { data: project } = useQuery({
    queryKey: ['/api/devtools/projects', projectId],
    enabled: !!projectId,
  });

  const plans: SubscriptionPlan[] = [
    {
      id: 'bronze',
      name: 'Bronze Plan',
      price: 199.99,
      currency: 'USD',
      period: 'month',
      icon: Zap,
      features: [
        'Up to 5 blockchain projects',
        'Basic monitoring & alerts',
        'API access for supported chains',
        'Community support',
        'Standard rate limits',
        'Basic analytics'
      ],
      cryptoPrice: {
        XRP: 350,
        ETH: 0.06,
        BTC: 0.0032,
        SOL: 1.2
      }
    },
    {
      id: 'gold',
      name: 'Gold Plan',
      price: 499.99,
      currency: 'USD',
      period: 'month',
      icon: Crown,
      popular: true,
      features: [
        'Unlimited blockchain projects',
        'Advanced monitoring & custom alerts',
        'Premium API access with higher limits',
        'Priority support & dedicated channel',
        'Enhanced rate limits',
        'Advanced analytics & insights',
        'Custom webhooks',
        'Multi-team collaboration',
        'Advanced security features'
      ],
      cryptoPrice: {
        XRP: 875,
        ETH: 0.15,
        BTC: 0.008,
        SOL: 3.0
      }
    }
  ];

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: { planId: string; paymentMethod: string; cryptoAmount: number; projectId?: string }) => {
      const response = await apiRequest('/api/devtools/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          projectId: projectId || data.projectId
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Store payment data in localStorage for crypto payment page
      localStorage.setItem('pending_payment', JSON.stringify({
        ...data,
        projectId,
        projectName: project?.name
      }));
      
      toast({
        title: 'Subscription Created',
        description: projectId ? `Complete payment to activate ${project?.name} subscription` : 'Complete payment to activate your subscription',
      });
      
      // Navigate to crypto payment page
      navigate('/devtools/crypto-payment');
    },
    onError: (error: any) => {
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive',
      });
    },
  });

  const handleSelectPlan = (planId: string, cryptoType: string, amount: number) => {
    createSubscriptionMutation.mutate({
      planId,
      paymentMethod: cryptoType,
      cryptoAmount: amount,
      projectId
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-slate-600 dark:text-slate-400"
              onClick={() => navigate('/devtools')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to DevTools
            </Button>
          </div>
          
          {projectId && project && (
            <div className="mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{project.name}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{project.description || 'DevTools Project'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {projectId ? 'Choose Plan for Project' : 'Choose Your DevTools Plan'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {projectId ? 'Select a subscription plan for this specific project' : 'Pay with cryptocurrency to unlock advanced blockchain development tools'}
          </p>
        </div>

        {/* Subscription Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-2 border-blue-500 shadow-xl' : 'border border-slate-200 dark:border-slate-700'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className={`p-3 rounded-full ${plan.popular ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <plan.icon className={`w-8 h-8 ${plan.popular ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'}`} />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-lg">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${plan.price}
                  </span>
                  <span className="text-slate-500">/{plan.period}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Features */}
                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Crypto Payment Options */}
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Pay with Crypto
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            XRP
                          </div>
                          <span className="text-sm font-medium">XRP</span>
                        </div>
                        <span className="text-sm font-bold">{plan.cryptoPrice.XRP}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id, 'XRP', plan.cryptoPrice.XRP)}
                        disabled={createSubscriptionMutation.isPending}
                      >
                        Pay with XRP
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            ETH
                          </div>
                          <span className="text-sm font-medium">ETH</span>
                        </div>
                        <span className="text-sm font-bold">{plan.cryptoPrice.ETH}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id, 'ETH', plan.cryptoPrice.ETH)}
                        disabled={createSubscriptionMutation.isPending}
                      >
                        Pay with ETH
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            BTC
                          </div>
                          <span className="text-sm font-medium">BTC</span>
                        </div>
                        <span className="text-sm font-bold">{plan.cryptoPrice.BTC}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id, 'BTC', plan.cryptoPrice.BTC)}
                        disabled={createSubscriptionMutation.isPending}
                      >
                        Pay with BTC
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            SOL
                          </div>
                          <span className="text-sm font-medium">SOL</span>
                        </div>
                        <span className="text-sm font-bold">{plan.cryptoPrice.SOL}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleSelectPlan(plan.id, 'SOL', plan.cryptoPrice.SOL)}
                        disabled={createSubscriptionMutation.isPending}
                      >
                        Pay with SOL
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Plan Benefits Summary */}
                <div className="pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Monthly billing</span>
                    <Badge variant="outline">Auto-renew</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Cancel anytime</span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payment Info */}
        <div className="max-w-4xl mx-auto mt-12">
          <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Shield className="w-5 h-5" />
                Crypto Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Instant Activation</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Access granted immediately after payment confirmation
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Live Pricing</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Crypto amounts updated with real-time exchange rates
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Multi-Chain</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Pay from any supported blockchain
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Free Trial Option */}
        <div className="max-w-2xl mx-auto mt-8">
          <Card className="text-center border-2 border-dashed border-slate-300 dark:border-slate-600">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Start with Pay-as-You-Go
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Test our DevTools without commitment. Pay only for what you use.
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate('/devtools/new-project')}
                className="w-full"
              >
                Start Free Trial
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
