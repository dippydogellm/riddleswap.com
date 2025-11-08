import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  ArrowLeft, 
  Search, 
  FileText, 
  Trophy, 
  Zap,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import ProjectClaimForm from './project-claim-form';

export interface ClaimingWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

enum WizardStep {
  INTRO = 0,
  COLLECTION_SEARCH = 1,
  PROJECT_DETAILS = 2,
  REVIEW_SUBMIT = 3,
  COMPLETE = 4,
}

interface WizardStepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isCompleted: boolean;
  isCurrent: boolean;
}

export default function ClaimingWizard({ onComplete, onCancel, className }: ClaimingWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.INTRO);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [claimData, setClaimData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps: WizardStepConfig[] = [
    {
      id: WizardStep.INTRO,
      title: "Getting Started",
      description: "Learn about the claiming process",
      icon: Info,
      isCompleted: completedSteps.has(WizardStep.INTRO),
      isCurrent: currentStep === WizardStep.INTRO,
    },
    {
      id: WizardStep.COLLECTION_SEARCH,
      title: "Find Collection",
      description: "Enter your collection details",
      icon: Search,
      isCompleted: completedSteps.has(WizardStep.COLLECTION_SEARCH),
      isCurrent: currentStep === WizardStep.COLLECTION_SEARCH,
    },
    {
      id: WizardStep.PROJECT_DETAILS,
      title: "Project Setup",
      description: "Configure your project",
      icon: FileText,
      isCompleted: completedSteps.has(WizardStep.PROJECT_DETAILS),
      isCurrent: currentStep === WizardStep.PROJECT_DETAILS,
    },
    {
      id: WizardStep.REVIEW_SUBMIT,
      title: "Submit Claim",
      description: "Review and submit",
      icon: Trophy,
      isCompleted: completedSteps.has(WizardStep.REVIEW_SUBMIT),
      isCurrent: currentStep === WizardStep.REVIEW_SUBMIT,
    },
    {
      id: WizardStep.COMPLETE,
      title: "Complete",
      description: "Claim submitted successfully",
      icon: CheckCircle2,
      isCompleted: completedSteps.has(WizardStep.COMPLETE),
      isCurrent: currentStep === WizardStep.COMPLETE,
    },
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const progress = (currentStepIndex / (steps.length - 1)) * 100;

  const markStepCompleted = (step: WizardStep) => {
    setCompletedSteps(prev => new Set([...Array.from(prev), step]));
  };

  const nextStep = () => {
    if (currentStep < WizardStep.COMPLETE) {
      markStepCompleted(currentStep);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > WizardStep.INTRO) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClaimSubmitted = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      markStepCompleted(WizardStep.REVIEW_SUBMIT);
      setCurrentStep(WizardStep.COMPLETE);
      setIsSubmitting(false);
    }, 2000);
  };

  const handleComplete = () => {
    markStepCompleted(WizardStep.COMPLETE);
    onComplete?.();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case WizardStep.INTRO:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Claim Your XRPL NFT Project</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                  Take control of your NFT collection on the Riddle platform. This wizard will guide you through
                  the process of claiming ownership and setting up your project dashboard.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <Search className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Find Your Collection</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter your issuer address and token taxon to locate your NFT collection
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Configure Project</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Set up your project details, vanity URL, and social links
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Automatic Setup</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We'll automatically configure services and fetch collection data
                </p>
              </div>
            </div>

            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription>
                <strong>What you'll need:</strong> Your collection's issuer wallet address and NFT token taxon.
                If you don't have these, you can find them on Bithomp or other XRPL explorers.
              </AlertDescription>
            </Alert>

            <div className="flex justify-center">
              <Button 
                onClick={nextStep}
                size="lg"
                data-testid="start-claiming-button"
              >
                Start Claiming Process
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case WizardStep.COLLECTION_SEARCH:
      case WizardStep.PROJECT_DETAILS:
      case WizardStep.REVIEW_SUBMIT:
        return (
          <ProjectClaimForm
            onClaimSubmitted={handleClaimSubmitted}
            onCancel={onCancel}
            className="max-w-4xl mx-auto"
          />
        );

      case WizardStep.COMPLETE:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-2 text-green-600 dark:text-green-400">
                Claim Submitted Successfully!
              </h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Your project claim has been submitted and is now pending review. 
                You'll receive a notification once your claim has been processed.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h4 className="font-semibold mb-3">What happens next?</h4>
              <div className="space-y-3 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Admin Review</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Our team will review your claim to verify ownership
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Automatic Setup</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Once approved, we'll automatically set up your project services
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Access Granted</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      You'll get full access to your project dashboard and tools
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-4">
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                data-testid="view-claims-button"
              >
                View My Claims
              </Button>
              <Button 
                onClick={handleComplete}
                data-testid="finish-button"
              >
                Finish
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${className}`}>
      {/* Progress Header */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-xl">Project Claiming Wizard</CardTitle>
              <CardDescription>
                Step {currentStepIndex + 1} of {steps.length}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium mb-1">Progress</div>
              <div className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</div>
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
        </CardHeader>
        
        <CardContent>
          {/* Step Navigation */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div 
                  key={step.id} 
                  className="flex flex-col items-center space-y-2 flex-1"
                  data-testid={`wizard-step-${step.id}`}
                >
                  <div className={`
                    w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
                    ${step.isCompleted 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : step.isCurrent 
                        ? 'bg-blue-500 border-blue-500 text-white' 
                        : 'bg-slate-100 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-600'
                    }
                  `}>
                    {step.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <div className={`text-sm font-medium ${
                      step.isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-slate-500 hidden sm:block">
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className="min-h-[600px]">
        {isSubmitting ? (
          <Card className="border-2">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center space-y-4">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Submitting Your Claim...</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Please wait while we process your project claim.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          renderStepContent()
        )}
      </div>

      {/* Navigation Footer */}
      {currentStep !== WizardStep.INTRO && 
       currentStep !== WizardStep.COMPLETE && 
       !isSubmitting && (
        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={currentStep <= WizardStep.INTRO}
            data-testid="previous-step-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex space-x-2">
            {onCancel && (
              <Button 
                variant="ghost" 
                onClick={onCancel}
                data-testid="cancel-wizard-button"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
