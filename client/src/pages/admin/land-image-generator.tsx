import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Image, CheckCircle2 } from 'lucide-react';

export function LandImageGenerator() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState({
    total: 478,
    generated: 0,
    remaining: 478,
    currentBatch: 0
  });

  const generateBatch = async (batchSize: number = 10) => {
    try {
      setIsGenerating(true);
      
      const response: any = await apiRequest('/api/land/batch-generate-images', {
        method: 'POST',
        body: JSON.stringify({ batchSize })
      });

      if (response.success) {
        setStats({
          total: stats.total,
          generated: stats.generated + response.generated,
          remaining: response.remaining,
          currentBatch: stats.currentBatch + 1
        });

        toast({
          title: '✅ Batch Complete',
          description: `Generated ${response.generated} images. ${response.remaining} remaining.`
        });

        // Auto-continue if there are more to generate
        if (response.remaining > 0) {
          // Wait 1 second before next batch
          await new Promise(resolve => setTimeout(resolve, 1000));
          await generateBatch(batchSize);
        } else {
          toast({
            title: '🎉 All Images Generated!',
            description: 'All land plot images have been generated successfully.'
          });
          setIsGenerating(false);
        }
      }
    } catch (error: any) {
      console.error('Batch generation error:', error);
      toast({
        title: '❌ Generation Failed',
        description: error.message || 'Failed to generate images',
        variant: 'destructive'
      });
      setIsGenerating(false);
    }
  };

  const startFullGeneration = () => {
    if (confirm('This will generate images for ALL remaining land plots. This may take a while and use OpenAI credits. Continue?')) {
      generateBatch(10); // 10 images per batch
    }
  };

  const progress = stats.total > 0 ? ((stats.generated / stats.total) * 100) : 0;

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-6 w-6" />
            Land Plot Image Generator
          </CardTitle>
          <CardDescription>
            Batch generate AI images for all land plots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.total}
              </div>
              <div className="text-sm text-muted-foreground">Total Plots</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.generated}
              </div>
              <div className="text-sm text-muted-foreground">Generated</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                {stats.remaining}
              </div>
              <div className="text-sm text-muted-foreground">Remaining</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Current Batch Info */}
          {isGenerating && (
            <div className="text-center text-sm text-muted-foreground">
              Processing batch #{stats.currentBatch + 1} (10 images per batch, 2s delay between each)
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={startFullGeneration}
              disabled={isGenerating || stats.remaining === 0}
              className="flex-1"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Images...
                </>
              ) : stats.remaining === 0 ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  All Images Generated
                </>
              ) : (
                <>
                  <Image className="mr-2 h-5 w-5" />
                  Generate All Remaining ({stats.remaining})
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg space-y-2">
            <div className="font-semibold">How it works:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Generates 10 images per batch</li>
              <li>2 second delay between each image (rate limiting)</li>
              <li>Automatically continues until all plots have images</li>
              <li>Can be stopped and resumed anytime</li>
              <li>Uses DALL-E 3 for high-quality fantasy landscape images</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
