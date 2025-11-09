import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaCheckCircle, FaExternalLinkAlt, FaTwitter, FaGlobe } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";

interface ProjectData {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  issuer_wallet: string | null;
  nft_token_taxon: number | null;
  asset_type: string;
  claim_status: string;
  verified: boolean;
  vanity_slug: string;
}

export default function ProjectVanityPage() {
  const [, params] = useRoute<{ vanityUrl: string }>("/project/:vanityUrl");
  const vanityUrl = params?.vanityUrl || '';

  const { data: project, isLoading, error } = useQuery<ProjectData>({
    queryKey: [`/api/devtools/projects/vanity/${vanityUrl}`],
    enabled: !!vanityUrl,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AiOutlineLoading3Quarters className="h-12 w-12 animate-spin text-blue-400" />
          <p className="text-white/60">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Project Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              The project you're looking for doesn't exist or has been removed.
            </p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Set SEO metadata
  useEffect(() => {
    if (!project) return;

    const pageTitle = `${project.name} | RiddleSwap`;
    const pageDescription = project.description || `Explore ${project.name} on RiddleSwap - Multi-chain DeFi platform`;
    const pageImage = project.banner_url || project.logo_url || 'https://riddleswap.com/og-image.png';
    const pageUrl = `https://riddleswap.com/project/${project.vanity_slug}`;

    // Set document title
    document.title = pageTitle;

    // Set or update meta tags
    const setMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Basic meta
    setMetaTag('description', pageDescription);

    // Open Graph
    setMetaTag('og:type', 'website', true);
    setMetaTag('og:url', pageUrl, true);
    setMetaTag('og:title', pageTitle, true);
    setMetaTag('og:description', pageDescription, true);
    setMetaTag('og:image', pageImage, true);

    // Twitter
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:url', pageUrl);
    setMetaTag('twitter:title', pageTitle);
    setMetaTag('twitter:description', pageDescription);
    setMetaTag('twitter:image', pageImage);

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;
  }, [project]);

  return (
    <>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        {/* Banner Section */}
        {project.banner_url && (
          <div className="w-full h-64 md:h-96 relative">
            <img
              src={project.banner_url}
              alt={`${project.name} banner`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
          </div>
        )}

        {/* Content Section */}
        <div className="container mx-auto px-4 py-8 -mt-20 relative z-10">
          <Card className="border-white/10 bg-slate-900/80 backdrop-blur-lg">
            <CardContent className="p-8">
              {/* Project Header */}
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-8">
                {project.logo_url && (
                  <img
                    src={project.logo_url}
                    alt={`${project.name} logo`}
                    className="w-24 h-24 rounded-xl border-2 border-white/20"
                  />
                )}
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl font-bold text-white">{project.name}</h1>
                    {project.verified && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-400/30">
                        <FaCheckCircle className="w-4 h-4 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  
                  {project.description && (
                    <p className="text-white/70 text-lg">{project.description}</p>
                  )}
                  
                  {/* Asset Type Badge */}
                  <Badge variant="outline" className="mt-3">
                    {project.asset_type === 'nft' ? 'NFT Collection' : 'Token'}
                  </Badge>
                </div>
              </div>

              {/* Links Section */}
              <div className="flex flex-wrap gap-3 mb-8">
                {project.website_url && (
                  <Button variant="outline" asChild>
                    <a href={project.website_url} target="_blank" rel="noopener noreferrer">
                      <FaGlobe className="w-4 h-4 mr-2" />
                      Website
                      <FaExternalLinkAlt className="w-3 h-3 ml-2" />
                    </a>
                  </Button>
                )}
                
                {project.social_links?.twitter && (
                  <Button variant="outline" asChild>
                    <a href={project.social_links.twitter} target="_blank" rel="noopener noreferrer">
                      <FaTwitter className="w-4 h-4 mr-2" />
                      Twitter
                      <FaExternalLinkAlt className="w-3 h-3 ml-2" />
                    </a>
                  </Button>
                )}
              </div>

              {/* View Collection/Token Button */}
              {project.asset_type === 'nft' && project.issuer_wallet && (
                <Link href={`/nft-collection/${project.issuer_wallet}/${project.nft_token_taxon || 0}`}>
                  <Button className="w-full md:w-auto">
                    View NFT Collection
                  </Button>
                </Link>
              )}
              
              {project.asset_type === 'token' && project.issuer_wallet && (
                <Link href={`/token-analytics?issuer=${project.issuer_wallet}`}>
                  <Button className="w-full md:w-auto">
                    View Token Analytics
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
