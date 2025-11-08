import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  HandCoins, 
  AlertTriangle, 
  Info, 
  MessageSquare,
  Shield,
  Calendar,
  CreditCard,
  User,
  Target
} from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

interface Loan {
  id: string;
  borrowerHandle: string;
  borrowerWallet: string;
  lenderHandle: string | null;
  lenderWallet: string | null;
  requestedAmount: string;
  interestRate: string;
  termDays: number;
  collateralType: string;
  collateralDetails: any;
  purpose: string;
  status: string;
  riskScore: string | null;
  fundedAmount: string | null;
  repaidAmount: string | null;
  dueAt: Date | null;
  fundedAt: Date | null;
  listedAt: Date | null;
  repaidAt: Date | null;
  defaultedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function Loans() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [createLoanDialog, setCreateLoanDialog] = useState<boolean>(false);
  const [fundLoanDialog, setFundLoanDialog] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });
  const [repayLoanDialog, setRepayLoanDialog] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });

  // Form states for create loan
  const [loanForm, setLoanForm] = useState({
    requestedAmount: '',
    interestRate: '',
    termDays: '30',
    collateralType: 'nft',
    collateralDetails: {
      chain: 'xrp',
      contract: '',
      tokenId: '',
      estimatedValue: ''
    },
    purpose: ''
  });

  // Form states for funding
  const [fundAmount, setFundAmount] = useState<string>('');
  const [repayAmount, setRepayAmount] = useState<string>('');

  // Fetch available loans
  const { data: availableLoans = [], isLoading: loansLoading } = useQuery<Loan[]>({
    queryKey: ['/api/loans', 'available'],
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Fetch user's loans
  const { data: myLoans = [], isLoading: myLoansLoading } = useQuery<Loan[]>({
    queryKey: ['/api/loans', 'mine'],
    staleTime: 1000 * 60 * 2,
  });

  // Create loan mutation
  const createLoanMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/loans/create', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Loan Request Created!",
        description: `Your loan request for $${loanForm.requestedAmount} has been posted to the marketplace.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setCreateLoanDialog(false);
      setLoanForm({
        requestedAmount: '',
        interestRate: '',
        termDays: '30',
        collateralType: 'nft',
        collateralDetails: { chain: 'xrp', contract: '', tokenId: '', estimatedValue: '' },
        purpose: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Loan",
        description: error.message || "Failed to create loan request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fund loan mutation
  const fundLoanMutation = useMutation({
    mutationFn: async (data: { loanId: string; amount: string }) => {
      return apiRequest('/api/loans/fund', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Loan Funded!",
        description: `Successfully funded $${fundAmount} to the borrower.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setFundLoanDialog({ open: false, loan: null });
      setFundAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Funding Failed",
        description: error.message || "Failed to fund loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Repay loan mutation
  const repayLoanMutation = useMutation({
    mutationFn: async (data: { loanId: string; amount: string }) => {
      return apiRequest('/api/loans/repay', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Repayment Successful!",
        description: `Successfully repaid $${repayAmount} towards your loan.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      setRepayLoanDialog({ open: false, loan: null });
      setRepayAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Repayment Failed",
        description: error.message || "Failed to process repayment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter loans by status
  const filteredLoans = availableLoans.filter(loan => {
    if (selectedStatus === 'all') return true;
    return loan.status === selectedStatus;
  });

  const formatNumber = (num: string | number) => {
    const value = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(value)) return '0.00';
    if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
    return value.toFixed(2);
  };

  const calculateDaysUntilDue = (dueDate: Date | null) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getRiskColor = (riskScore: string | null) => {
    if (!riskScore) return 'secondary';
    const score = parseFloat(riskScore);
    if (score >= 80) return 'destructive';
    if (score >= 60) return 'outline';
    return 'secondary';
  };

  const handleCreateLoan = () => {
    if (!loanForm.requestedAmount || !loanForm.interestRate || !loanForm.purpose) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createLoanMutation.mutate({
      ...loanForm,
      requestedAmount: parseFloat(loanForm.requestedAmount),
      interestRate: parseFloat(loanForm.interestRate),
      termDays: parseInt(loanForm.termDays),
      collateralDetails: {
        ...loanForm.collateralDetails,
        estimatedValue: parseFloat(loanForm.collateralDetails.estimatedValue)
      }
    });
  };

  const handleFundLoan = () => {
    if (!fundLoanDialog.loan || !fundAmount) return;
    
    const amount = parseFloat(fundAmount);
    const requestedAmount = parseFloat(fundLoanDialog.loan.requestedAmount);

    if (amount > requestedAmount) {
      toast({
        title: "Amount Too High",
        description: `Cannot fund more than the requested amount of $${requestedAmount}`,
        variant: "destructive",
      });
      return;
    }

    fundLoanMutation.mutate({
      loanId: fundLoanDialog.loan.id,
      amount: fundAmount
    });
  };

  const handleRepayLoan = () => {
    if (!repayLoanDialog.loan || !repayAmount) return;
    
    const amount = parseFloat(repayAmount);
    const fundedAmount = parseFloat(repayLoanDialog.loan.fundedAmount || '0');
    const interestRate = parseFloat(repayLoanDialog.loan.interestRate);
    const totalOwed = fundedAmount * (1 + interestRate / 100);
    const alreadyRepaid = parseFloat(repayLoanDialog.loan.repaidAmount || '0');
    const remainingOwed = totalOwed - alreadyRepaid;

    if (amount > remainingOwed) {
      toast({
        title: "Amount Too High",
        description: `You only owe $${remainingOwed.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    repayLoanMutation.mutate({
      loanId: repayLoanDialog.loan.id,
      amount: repayAmount
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
            P2P Lending Marketplace
          </h1>
          <p className="text-lg text-muted-foreground">
            Secure peer-to-peer lending with NFT collateral across multiple chains
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800" data-testid="card-total-volume">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Volume</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    ${formatNumber(availableLoans.reduce((sum, loan) => sum + parseFloat(loan.requestedAmount), 0))}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-active-loans">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Active Loans</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {availableLoans.filter(loan => loan.status === 'funded').length}
                  </p>
                </div>
                <HandCoins className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800" data-testid="card-avg-interest">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Interest</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {availableLoans.length > 0 
                      ? (availableLoans.reduce((sum, loan) => sum + parseFloat(loan.interestRate), 0) / availableLoans.length).toFixed(1)
                      : '0.0'
                    }%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800" data-testid="card-my-loans">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">My Loans</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {myLoans.length}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="marketplace" className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList className="grid grid-cols-2 max-w-md" data-testid="tabs-loans">
              <TabsTrigger value="marketplace" data-testid="tab-marketplace">Marketplace</TabsTrigger>
              <TabsTrigger value="my-loans" data-testid="tab-my-loans">My Loans</TabsTrigger>
            </TabsList>

            <Button onClick={() => setCreateLoanDialog(true)} className="bg-gradient-to-r from-green-600 to-blue-600" data-testid="button-create-loan">
              <Target className="h-4 w-4 mr-2" />
              Request Loan
            </Button>
          </div>

          <TabsContent value="marketplace" className="space-y-6">
            {/* Status Filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter">Filter by Status:</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus} data-testid="select-status-filter">
                  <SelectTrigger className="w-[180px]" id="status-filter">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Loans</SelectItem>
                    <SelectItem value="listed">Available to Fund</SelectItem>
                    <SelectItem value="funded">Active Loans</SelectItem>
                    <SelectItem value="repaid">Completed</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Alert className="max-w-md" data-testid="alert-lending-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  All loans are secured by NFT collateral. Earn competitive returns by funding borrowers.
                </AlertDescription>
              </Alert>
            </div>

            {/* Available Loans */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {loansLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-loan-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredLoans.length === 0 ? (
                <Card className="col-span-full" data-testid="card-no-loans">
                  <CardContent className="text-center py-8">
                    <HandCoins className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Loans Available</h3>
                    <p className="text-muted-foreground">
                      {selectedStatus === 'all' 
                        ? 'No loan requests are currently available.' 
                        : `No loans with status "${selectedStatus}" found.`}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredLoans.map((loan) => {
                  const daysUntilDue = calculateDaysUntilDue(loan.dueAt);
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const collateral = loan.collateralDetails || {};

                  return (
                    <Card key={loan.id} className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary/20" data-testid={`card-loan-${loan.id}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              ${formatNumber(loan.requestedAmount)}
                              <Badge variant={getRiskColor(loan.riskScore)} className="text-xs" data-testid={`badge-risk-${loan.id}`}>
                                {loan.riskScore ? `${loan.riskScore}% Risk` : 'No Risk Score'}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              {loan.borrowerHandle}
                              {loan.status !== 'listed' && loan.lenderHandle && (
                                <>
                                  <span>→</span>
                                  <User className="h-3 w-3" />
                                  {loan.lenderHandle}
                                </>
                              )}
                            </CardDescription>
                          </div>
                          <Badge 
                            variant={
                              loan.status === 'listed' ? 'default' : 
                              loan.status === 'funded' ? 'secondary' :
                              loan.status === 'repaid' ? 'outline' : 'destructive'
                            }
                            className="text-xs"
                            data-testid={`badge-status-${loan.id}`}
                          >
                            {loan.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Interest Rate</p>
                            <p className="font-semibold text-green-600 dark:text-green-400 text-lg" data-testid={`text-interest-${loan.id}`}>
                              {loan.interestRate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Term</p>
                            <p className="font-semibold flex items-center gap-1" data-testid={`text-term-${loan.id}`}>
                              <Clock className="h-3 w-3" />
                              {loan.termDays} days
                            </p>
                          </div>
                        </div>

                        {/* Collateral Info */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Collateral</p>
                          <div className="bg-muted rounded p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Type:</span>
                              <span className="capitalize" data-testid={`text-collateral-type-${loan.id}`}>
                                {loan.collateralType}
                              </span>
                            </div>
                            {collateral.chain && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Chain:</span>
                                <span className="uppercase" data-testid={`text-collateral-chain-${loan.id}`}>
                                  {collateral.chain}
                                </span>
                              </div>
                            )}
                            {collateral.estimatedValue && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Value:</span>
                                <span data-testid={`text-collateral-value-${loan.id}`}>
                                  ${formatNumber(collateral.estimatedValue)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Due Date & Progress for funded loans */}
                        {loan.status === 'funded' && loan.dueAt && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Repayment Progress</span>
                              <span className={isOverdue ? 'text-red-600' : ''} data-testid={`text-due-${loan.id}`}>
                                {isOverdue ? `${Math.abs(daysUntilDue!)} days overdue` : `${daysUntilDue} days left`}
                              </span>
                            </div>
                            {loan.fundedAmount && loan.repaidAmount && (
                              <Progress 
                                value={Math.min(100, (parseFloat(loan.repaidAmount) / parseFloat(loan.fundedAmount)) * 100)} 
                                className="h-2"
                                data-testid={`progress-repayment-${loan.id}`}
                              />
                            )}
                          </div>
                        )}

                        {/* Purpose */}
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Purpose</p>
                          <p className="text-sm text-muted-foreground" data-testid={`text-purpose-${loan.id}`}>
                            {loan.purpose.length > 100 ? `${loan.purpose.substring(0, 100)}...` : loan.purpose}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {loan.status === 'listed' && (
                            <Button
                              size="sm"
                              onClick={() => setFundLoanDialog({ open: true, loan })}
                              data-testid={`button-fund-${loan.id}`}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Fund Loan
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {/* TODO: Open messaging */}}
                            data-testid={`button-message-${loan.id}`}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-loans" className="space-y-6">
            {/* My Loans */}
            <div className="space-y-4">
              {myLoansLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse" data-testid="card-my-loan-skeleton">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : myLoans.length === 0 ? (
                <Card data-testid="card-no-my-loans">
                  <CardContent className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Loan Requests</h3>
                    <p className="text-muted-foreground mb-4">
                      You haven't created any loan requests yet. Get started by requesting a loan today!
                    </p>
                    <Button onClick={() => setCreateLoanDialog(true)} data-testid="button-request-first-loan">
                      Request Your First Loan
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                myLoans.map((loan) => {
                  const daysUntilDue = calculateDaysUntilDue(loan.dueAt);
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const totalOwed = loan.fundedAmount ? parseFloat(loan.fundedAmount) * (1 + parseFloat(loan.interestRate) / 100) : 0;
                  const remainingOwed = totalOwed - parseFloat(loan.repaidAmount || '0');

                  return (
                    <Card key={loan.id} className="hover:shadow-lg transition-shadow duration-200" data-testid={`card-my-loan-${loan.id}`}>
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              ${formatNumber(loan.requestedAmount)} Loan Request
                              <Badge variant={loan.status === 'repaid' ? 'outline' : loan.status === 'funded' ? 'default' : 'secondary'} className="text-xs" data-testid={`badge-my-loan-status-${loan.id}`}>
                                {loan.status}
                              </Badge>
                            </CardTitle>
                            <CardDescription>
                              Created {new Date(loan.createdAt).toLocaleDateString()}
                              {loan.lenderHandle && ` • Funded by ${loan.lenderHandle}`}
                            </CardDescription>
                          </div>
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1" data-testid="badge-overdue">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Interest Rate</p>
                            <p className="font-semibold text-lg" data-testid={`text-my-loan-interest-${loan.id}`}>
                              {loan.interestRate}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Term</p>
                            <p className="font-semibold" data-testid={`text-my-loan-term-${loan.id}`}>
                              {loan.termDays} days
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Funded Amount</p>
                            <p className="font-semibold text-green-600 dark:text-green-400" data-testid={`text-my-loan-funded-${loan.id}`}>
                              {loan.fundedAmount ? `$${formatNumber(loan.fundedAmount)}` : 'Not funded'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="font-semibold capitalize" data-testid={`text-my-loan-detailed-status-${loan.id}`}>
                              {loan.status === 'listed' ? 'Awaiting funding' :
                               loan.status === 'funded' ? 'Active' :
                               loan.status}
                            </p>
                          </div>
                        </div>

                        {loan.status === 'funded' && (
                          <>
                            {loan.dueAt && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Repayment Progress</span>
                                  <span className={isOverdue ? 'text-red-600' : ''} data-testid={`text-my-loan-due-${loan.id}`}>
                                    {isOverdue ? `${Math.abs(daysUntilDue!)} days overdue` : `${daysUntilDue} days left`}
                                  </span>
                                </div>
                                <Progress 
                                  value={Math.min(100, ((totalOwed - remainingOwed) / totalOwed) * 100)} 
                                  className="h-2"
                                  data-testid={`progress-my-loan-repayment-${loan.id}`}
                                />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                  <span>Repaid: ${formatNumber(loan.repaidAmount || '0')}</span>
                                  <span>Remaining: ${formatNumber(remainingOwed)}</span>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        <div className="flex gap-2">
                          {loan.status === 'funded' && remainingOwed > 0 && (
                            <Button
                              size="sm"
                              onClick={() => setRepayLoanDialog({ open: true, loan })}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid={`button-repay-${loan.id}`}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Make Payment
                            </Button>
                          )}
                          {loan.lenderHandle && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {/* TODO: Open messaging with lender */}}
                              data-testid={`button-message-lender-${loan.id}`}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Message Lender
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Loan Dialog */}
        <Dialog open={createLoanDialog} onOpenChange={setCreateLoanDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-create-loan">
            <DialogHeader>
              <DialogTitle>Request a Loan</DialogTitle>
              <DialogDescription>
                Create a loan request backed by NFT collateral. All loans require collateral worth at least 150% of the loan amount.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <Alert data-testid="alert-loan-requirements">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Notice:</strong> Your NFT collateral will be held in escrow until the loan is fully repaid. 
                  Defaulting on your loan may result in loss of collateral.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requested-amount">Requested Amount ($)</Label>
                  <Input
                    id="requested-amount"
                    type="number"
                    placeholder="1000.00"
                    value={loanForm.requestedAmount}
                    onChange={(e) => setLoanForm({...loanForm, requestedAmount: e.target.value})}
                    data-testid="input-requested-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interest-rate">Offered Interest Rate (%)</Label>
                  <Input
                    id="interest-rate"
                    type="number"
                    step="0.1"
                    placeholder="5.0"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({...loanForm, interestRate: e.target.value})}
                    data-testid="input-interest-rate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="term-days">Loan Term (days)</Label>
                  <Select value={loanForm.termDays} onValueChange={(value) => setLoanForm({...loanForm, termDays: value})} data-testid="select-term-days">
                    <SelectTrigger id="term-days">
                      <SelectValue placeholder="Select term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collateral-type">Collateral Type</Label>
                  <Select value={loanForm.collateralType} onValueChange={(value) => setLoanForm({...loanForm, collateralType: value})} data-testid="select-collateral-type">
                    <SelectTrigger id="collateral-type">
                      <SelectValue placeholder="Select collateral" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nft">NFT</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Collateral Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Collateral Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="collateral-chain">Chain</Label>
                    <Select 
                      value={loanForm.collateralDetails.chain} 
                      onValueChange={(value) => setLoanForm({
                        ...loanForm, 
                        collateralDetails: {...loanForm.collateralDetails, chain: value}
                      })}
                      data-testid="select-collateral-chain"
                    >
                      <SelectTrigger id="collateral-chain">
                        <SelectValue placeholder="Select chain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="xrp">XRP Ledger</SelectItem>
                        <SelectItem value="eth">Ethereum</SelectItem>
                        <SelectItem value="sol">Solana</SelectItem>
                        <SelectItem value="bnb">BNB Chain</SelectItem>
                        <SelectItem value="base">Base</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collateral-value">Estimated Value ($)</Label>
                    <Input
                      id="collateral-value"
                      type="number"
                      placeholder="1500.00"
                      value={loanForm.collateralDetails.estimatedValue}
                      onChange={(e) => setLoanForm({
                        ...loanForm, 
                        collateralDetails: {...loanForm.collateralDetails, estimatedValue: e.target.value}
                      })}
                      data-testid="input-collateral-value"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collateral-contract">Contract Address / Issuer</Label>
                    <Input
                      id="collateral-contract"
                      placeholder="Contract address or NFT issuer"
                      value={loanForm.collateralDetails.contract}
                      onChange={(e) => setLoanForm({
                        ...loanForm, 
                        collateralDetails: {...loanForm.collateralDetails, contract: e.target.value}
                      })}
                      data-testid="input-collateral-contract"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collateral-token-id">Token ID</Label>
                    <Input
                      id="collateral-token-id"
                      placeholder="Token ID or NFT identifier"
                      value={loanForm.collateralDetails.tokenId}
                      onChange={(e) => setLoanForm({
                        ...loanForm, 
                        collateralDetails: {...loanForm.collateralDetails, tokenId: e.target.value}
                      })}
                      data-testid="input-collateral-token-id"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loan-purpose">Loan Purpose</Label>
                <Textarea
                  id="loan-purpose"
                  placeholder="Describe what you'll use the loan for (e.g., business expansion, trading capital, etc.)"
                  value={loanForm.purpose}
                  onChange={(e) => setLoanForm({...loanForm, purpose: e.target.value})}
                  rows={3}
                  data-testid="textarea-loan-purpose"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateLoanDialog(false)}
                data-testid="button-cancel-create-loan"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLoan}
                disabled={createLoanMutation.isPending}
                data-testid="button-confirm-create-loan"
              >
                {createLoanMutation.isPending ? 'Creating...' : 'Create Loan Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Fund Loan Dialog */}
        <Dialog open={fundLoanDialog.open} onOpenChange={(open) => setFundLoanDialog({ open, loan: fundLoanDialog.loan })}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-fund-loan">
            <DialogHeader>
              <DialogTitle>Fund Loan</DialogTitle>
              <DialogDescription>
                Fund ${formatNumber(fundLoanDialog.loan?.requestedAmount || '0')} to {fundLoanDialog.loan?.borrowerHandle} 
                at {fundLoanDialog.loan?.interestRate}% interest
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fund-amount">Amount to Fund ($)</Label>
                <Input
                  id="fund-amount"
                  type="number"
                  placeholder="0.00"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  max={fundLoanDialog.loan?.requestedAmount}
                  data-testid="input-fund-amount"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Max: ${fundLoanDialog.loan?.requestedAmount || '0'}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0"
                    onClick={() => setFundAmount(fundLoanDialog.loan?.requestedAmount || '0')}
                    data-testid="button-fund-max"
                  >
                    Fund Full Amount
                  </Button>
                </div>
              </div>
              
              <Alert data-testid="alert-funding-terms">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Expected return: ${fundAmount ? (parseFloat(fundAmount) * (1 + parseFloat(fundLoanDialog.loan?.interestRate || '0') / 100)).toFixed(2) : '0.00'} 
                  over {fundLoanDialog.loan?.termDays} days
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setFundLoanDialog({ open: false, loan: null })}
                data-testid="button-cancel-fund"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFundLoan}
                disabled={!fundAmount || fundLoanMutation.isPending}
                data-testid="button-confirm-fund"
              >
                {fundLoanMutation.isPending ? 'Funding...' : 'Fund Loan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Repay Loan Dialog */}
        <Dialog open={repayLoanDialog.open} onOpenChange={(open) => setRepayLoanDialog({ open, loan: repayLoanDialog.loan })}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-repay-loan">
            <DialogHeader>
              <DialogTitle>Repay Loan</DialogTitle>
              <DialogDescription>
                Make a payment towards your loan. Full repayment will release your collateral.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repay-amount">Repayment Amount ($)</Label>
                <Input
                  id="repay-amount"
                  type="number"
                  placeholder="0.00"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  data-testid="input-repay-amount"
                />
              </div>
              
              {repayLoanDialog.loan && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount:</span>
                    <span>${formatNumber(repayLoanDialog.loan.fundedAmount || '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interest ({repayLoanDialog.loan.interestRate}%):</span>
                    <span>${formatNumber((parseFloat(repayLoanDialog.loan.fundedAmount || '0') * parseFloat(repayLoanDialog.loan.interestRate) / 100).toString())}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Repaid:</span>
                    <span>${formatNumber(repayLoanDialog.loan.repaidAmount || '0')}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total Remaining:</span>
                    <span>${formatNumber(
                      (parseFloat(repayLoanDialog.loan.fundedAmount || '0') * (1 + parseFloat(repayLoanDialog.loan.interestRate) / 100) - 
                       parseFloat(repayLoanDialog.loan.repaidAmount || '0')).toString()
                    )}</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setRepayLoanDialog({ open: false, loan: null })}
                data-testid="button-cancel-repay"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRepayLoan}
                disabled={!repayAmount || repayLoanMutation.isPending}
                data-testid="button-confirm-repay"
              >
                {repayLoanMutation.isPending ? 'Processing...' : 'Make Payment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
