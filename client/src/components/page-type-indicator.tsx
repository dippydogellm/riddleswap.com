import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PAGE_TYPES, type PageTypeConfig } from '@/lib/metadata-manager';

interface PageTypeIndicatorProps {
  pageType: string;
  title?: string;
  description?: string;
  className?: string;
  variant?: 'badge' | 'card' | 'inline';
  showIcon?: boolean;
  showDescription?: boolean;
}

const PageTypeIndicator: React.FC<PageTypeIndicatorProps> = ({
  pageType,
  title,
  description,
  className,
  variant = 'badge',
  showIcon = true,
  showDescription = false
}) => {
  const config = PAGE_TYPES[pageType];
  
  if (!config) {
    return null;
  }

  const renderBadge = () => (
    <Badge 
      className={cn(
        "flex items-center space-x-1 text-xs font-medium",
        config.color,
        className
      )}
      data-testid={`page-type-badge-${pageType}`}
    >
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </Badge>
  );

  const renderCard = () => (
    <Card className={cn("border-l-4", className)} data-testid={`page-type-card-${pageType}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {showIcon && (
            <div className="text-2xl">{config.icon}</div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-lg">{title || config.label}</h3>
              <Badge className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {description || config.description}
            </p>
            {showDescription && (
              <p className="text-xs text-muted-foreground mt-2">
                Category: {config.category}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderInline = () => (
    <div 
      className={cn("flex items-center space-x-2", className)}
      data-testid={`page-type-inline-${pageType}`}
    >
      {showIcon && <span className="text-lg">{config.icon}</span>}
      <span className="text-sm font-medium text-muted-foreground">
        {config.label}
      </span>
      {showDescription && (
        <span className="text-xs text-muted-foreground">
          • {config.description}
        </span>
      )}
    </div>
  );

  switch (variant) {
    case 'card':
      return renderCard();
    case 'inline':
      return renderInline();
    case 'badge':
    default:
      return renderBadge();
  }
};

export default PageTypeIndicator;
