import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";

const DOC_TITLES: Record<string, string> = {
  "platform-overview": "Platform Overview",
  "wallet-walletconnect": "Wallet & WalletConnect",
  "multi-chain-swap": "Multi-Chain Swap System",
  "cross-chain-bridge": "Cross-Chain Bridge",
  "nft-marketplace": "NFT Marketplace",
  "token-scanner": "Token Scanner",
  "developer-tools": "Developer Tools",
  "oracle-social-media": "Oracle Social Media System"
};

export default function DocViewer() {
  const [, params] = useRoute("/docs/:docId");
  const [, navigate] = useLocation();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const docId = params?.docId || "";
  const title = DOC_TITLES[docId] || "Documentation";

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/docs/${docId}.md`);
        
        if (!response.ok) {
          throw new Error("Documentation not found");
        }
        
        const text = await response.text();
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documentation");
      } finally {
        setLoading(false);
      }
    };

    if (docId) {
      loadMarkdown();
    }
  }, [docId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
        <Card className="bg-slate-900/80 border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button 
              onClick={() => navigate('/docs')}
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Documentation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/docs')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Documentation
          </Button>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-4xl font-bold text-white">
              {title}
            </h1>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                onClick={() => window.print()}
              >
                <Download className="w-4 h-4 mr-2" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card className="bg-slate-900/80 border-blue-500/30">
          <CardContent className="p-8 md:p-12">
            <div className="prose prose-invert prose-blue max-w-none">
              <ReactMarkdown
                components={{
                  h1: (props) => <h1 className="text-4xl font-bold text-white mb-6 pb-4 border-b border-slate-700" {...props} />,
                  h2: (props) => <h2 className="text-3xl font-bold text-white mt-12 mb-4" {...props} />,
                  h3: (props) => <h3 className="text-2xl font-semibold text-blue-400 mt-8 mb-3" {...props} />,
                  h4: (props) => <h4 className="text-xl font-semibold text-purple-400 mt-6 mb-2" {...props} />,
                  p: (props) => <p className="text-gray-300 leading-relaxed mb-4" {...props} />,
                  a: (props) => <a className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                  ul: (props) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2" {...props} />,
                  ol: (props) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-2" {...props} />,
                  code: ({ inline, ...props }: any) => 
                    inline ? 
                      <code className="bg-slate-800 text-orange-400 px-2 py-1 rounded text-sm" {...props} /> :
                      <code className="block bg-slate-800 text-green-400 p-4 rounded-lg overflow-x-auto mb-4 text-sm" {...props} />,
                  pre: (props) => <pre className="bg-slate-800 p-0 rounded-lg overflow-hidden mb-4" {...props} />,
                  blockquote: (props) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-400 my-4" {...props} />,
                  table: (props) => <div className="overflow-x-auto mb-4"><table className="min-w-full border border-slate-700" {...props} /></div>,
                  th: (props) => <th className="border border-slate-700 bg-slate-800 px-4 py-2 text-left text-white font-semibold" {...props} />,
                  td: (props) => <td className="border border-slate-700 px-4 py-2 text-gray-300" {...props} />,
                  tr: (props) => <tr className="hover:bg-slate-800/50" {...props} />,
                  hr: (props) => <hr className="border-slate-700 my-8" {...props} />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <Button 
            variant="outline"
            onClick={() => navigate('/docs')}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documentation
          </Button>
          
          <Button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
          >
            Back to Top
          </Button>
        </div>
      </div>
    </div>
  );
}
