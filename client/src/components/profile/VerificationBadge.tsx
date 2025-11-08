import { CheckCircle, Shield, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VerificationBadgeProps {
  verified: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'premium';
  showText?: boolean;
  className?: string;
  tooltipContent?: string;
}

export function VerificationBadge({ 
  verified, 
  size = 'md', 
  variant = 'default',
  showText = false,
  className,
  tooltipContent
}: VerificationBadgeProps) {
  const sizeConfig = {
    xs: { 
      icon: 'w-3 h-3', 
      badge: 'h-5 px-1.5 text-xs',
      text: 'text-xs'
    },
    sm: { 
      icon: 'w-3.5 h-3.5', 
      badge: 'h-6 px-2 text-xs',
      text: 'text-sm'
    },
    md: { 
      icon: 'w-4 h-4', 
      badge: 'h-7 px-2.5 text-sm',
      text: 'text-sm'
    },
    lg: { 
      icon: 'w-5 h-5', 
      badge: 'h-8 px-3 text-base',
      text: 'text-base'
    }
  };

  const config = sizeConfig[size];

  if (!verified) {
    return null;
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'minimal':
        return {
          badge: 'bg-transparent border-none p-0 h-auto',
          icon: 'text-blue-500',
          text: 'text-blue-600 dark:text-blue-400'
        };
      case 'premium':
        return {
          badge: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none hover:from-blue-600 hover:to-purple-600',
          icon: 'text-white',
          text: 'text-white'
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          text: 'text-blue-700 dark:text-blue-300'
        };
    }
  };

  const styles = getVariantStyles();

  const getIcon = () => {
    switch (variant) {
      case 'premium':
        return <Star className={cn(config.icon, styles.icon)} fill="currentColor" />;
      case 'minimal':
        return <CheckCircle className={cn(config.icon, styles.icon)} fill="currentColor" />;
      default:
        return <Shield className={cn(config.icon, styles.icon)} />;
    }
  };

  const badge = (
    <Badge 
      className={cn(
        config.badge,
        styles.badge,
        'flex items-center space-x-1 font-medium transition-colors',
        className
      )}
      data-testid="verification-badge"
    >
      {getIcon()}
      {showText && (
        <span className={cn(config.text, styles.text)}>
          Verified
        </span>
      )}
    </Badge>
  );

  const defaultTooltip = variant === 'premium' 
    ? 'Premium verified project with Gold subscription'
    : 'This project has been verified by Riddle';

  if (tooltipContent || !showText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent || defaultTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

// Convenience components for common use cases
export function ProjectVerificationBadge({ verified, className }: { verified: boolean; className?: string }) {
  return (
    <VerificationBadge
      verified={verified}
      size="sm"
      showText={true}
      className={className}
      tooltipContent="This project has been verified and can publish custom overrides"
    />
  );
}

export function CollectionVerificationBadge({ verified, className }: { verified: boolean; className?: string }) {
  return (
    <VerificationBadge
      verified={verified}
      size="xs"
      variant="minimal"
      className={className}
      tooltipContent="Verified collection"
    />
  );
}

export function PremiumVerificationBadge({ verified, className }: { verified: boolean; className?: string }) {
  return (
    <VerificationBadge
      verified={verified}
      size="sm"
      variant="premium"
      showText={true}
      className={className}
      tooltipContent="Premium verified project with advanced features"
    />
  );
}
