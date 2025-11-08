import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Star, Heart, Code, Lightbulb, Target, MessageCircle, Github, Twitter } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  handle: string;
  role: string;
  description: string;
  skills: string[];
  avatar: string;
  socials?: {
    twitter?: string;
    github?: string;
    discord?: string;
  };
}

export default function TeamPage() {
  const coreTeam: TeamMember[] = [
    {
      id: '1',
      name: 'DippyDoge',
      handle: '@dippydoge',
      role: 'Dev & Lead Community Member/Founder',
      description: 'Passionate advocate for decentralized finance and community governance. Leading the charge in building accessible DeFi tools for everyone.',
      skills: ['Community Building', 'DeFi Strategy', 'Product Vision', 'Development'],
      avatar: '/17544152079292174535157331549738_1754415221678.jpg',
      socials: {
        discord: '@dippydoge'
      }
    }
  ];

  const contributorRoles = [
    {
      title: 'Core Developers',
      description: 'Full-time contributors building the platform',
      count: 'Expanding',
      requirements: ['React/TypeScript', 'Blockchain experience', 'DeFi knowledge']
    },
    {
      title: 'Community Managers',
      description: 'Building and nurturing our global community',
      count: 'Growing',
      requirements: ['Social media expertise', 'Community engagement', 'Content creation']
    },
    {
      title: 'Security Auditors',
      description: 'Ensuring platform security and reliability',
      count: 'Recruiting',
      requirements: ['Smart contract auditing', 'Security research', 'Penetration testing']
    },
    {
      title: 'UI/UX Designers',
      description: 'Creating beautiful and intuitive user experiences',
      count: 'Open',
      requirements: ['DeFi UI experience', 'Design systems', 'User research']
    }
  ];

  const handleConnectWallet = () => {
    // Wallet connection handled by swap pages
  };

  return (
    <div className="min-h-screen bg-background">
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blue-600 mb-6">
            👥 Meet the Team
          </h1>
          <p className="text-2xl text-gray-800 font-bold max-w-4xl mx-auto leading-relaxed mb-4">
            The passionate individuals building the future of multi-chain DeFi
          </p>
          <div className="bg-white border-2 border-blue-200 rounded-xl p-6 max-w-4xl mx-auto shadow-lg">
            <p className="text-lg text-gray-800 font-semibold">
              We are a community-built DeFi system, set to revolutionize the way you pay.
            </p>
          </div>
        </div>

        {/* Core Team */}
        <Card className="mb-16 bg-white border-blue-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-blue-700 font-bold flex items-center justify-center gap-3">
              <Star className="w-8 h-8" />
              Core Leadership Team
            </CardTitle>
            <CardDescription className="text-center text-gray-700 text-lg font-medium">
              The visionaries driving RiddleSwap's mission forward
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto px-4 sm:px-0">
              {coreTeam.map((member) => (
                <Card key={member.id} className="bg-white border-indigo-200 shadow-lg transition-transform">
                  <CardHeader className="text-center">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border-2 border-indigo-300 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                      {member.avatar.startsWith('/') ? (
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">{member.avatar}</span>
                      )}
                    </div>
                    <CardTitle className="text-lg sm:text-xl text-indigo-700 font-bold">{member.name}</CardTitle>
                    <CardDescription className="text-purple-700 font-semibold">{member.handle}</CardDescription>
                    <Badge className="bg-purple-100 text-purple-700 border border-purple-300 mx-auto">{member.role}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm mb-4 text-center font-medium">
                      {member.description}
                    </p>
                    
                    <div className="mb-4">
                      <h5 className="text-indigo-700 font-bold mb-2 text-center">Expertise</h5>
                      <div className="flex flex-wrap justify-center gap-2">
                        {member.skills.map((skill, index) => (
                          <Badge key={index} variant="outline" className="border-indigo-300 text-indigo-700 text-xs font-medium">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {member.socials && (
                      <div className="flex justify-center gap-3">
                        {member.socials.discord && (
                          <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 font-medium">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Discord
                          </Button>
                        )}
                        {member.socials.twitter && (
                          <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 font-medium">
                            <Twitter className="w-4 h-4 mr-2" />
                            Twitter
                          </Button>
                        )}
                        {member.socials.github && (
                          <Button size="sm" variant="outline" className="border-gray-300 text-gray-700 font-medium">
                            <Github className="w-4 h-4 mr-2" />
                            GitHub
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Community Contributors */}
        <Card className="mb-16 bg-white border-green-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-green-700 font-bold flex items-center justify-center gap-3">
              <Users className="w-8 h-8" />
              Community Contributors
            </CardTitle>
            <CardDescription className="text-center text-gray-700 text-lg font-medium">
              Amazing individuals contributing to RiddleSwap's growth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {contributorRoles.map((role, index) => (
                <Card key={index} className="bg-white border-teal-200 shadow-lg">
                  <CardHeader className="text-center">
                    <CardTitle className="text-lg text-teal-700 font-bold">{role.title}</CardTitle>
                    <Badge className="bg-green-100 text-green-700 border border-green-300 mx-auto">{role.count}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 text-sm mb-4 text-center font-medium">
                      {role.description}
                    </p>
                    
                    <div>
                      <h6 className="text-teal-700 font-bold mb-2 text-center text-xs">Requirements</h6>
                      <div className="space-y-1">
                        {role.requirements.map((req, reqIndex) => (
                          <div key={reqIndex} className="text-xs text-gray-700 text-center font-medium">
                            • {req}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Values */}
        <Card className="mb-16 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-purple-700 font-bold">💫 Our Team Values</CardTitle>
            <CardDescription className="text-center text-gray-700 text-lg font-medium">
              The principles that unite us as a team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="bg-blue-100 border-2 border-blue-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-bold text-blue-700 mb-2">Community First</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Every decision we make is guided by what's best for our community and users.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-green-100 border-2 border-green-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Code className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-lg font-bold text-green-700 mb-2">Technical Excellence</h4>
                <p className="text-gray-700 text-sm font-medium">
                  We strive for the highest standards in code quality, security, and performance.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-purple-100 border-2 border-purple-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Lightbulb className="w-8 h-8 text-purple-600" />
                </div>
                <h4 className="text-lg font-bold text-purple-700 mb-2">Innovation</h4>
                <p className="text-gray-700 text-sm font-medium">
                  We constantly push boundaries and explore new possibilities in DeFi.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 border-2 border-orange-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-orange-600" />
                </div>
                <h4 className="text-lg font-bold text-orange-700 mb-2">Transparency</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Open communication and transparent decision-making at every level.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-teal-100 border-2 border-teal-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-teal-600" />
                </div>
                <h4 className="text-lg font-bold text-teal-700 mb-2">Collaboration</h4>
                <p className="text-gray-700 text-sm font-medium">
                  We achieve more together than we ever could individually.
                </p>
              </div>

              <div className="text-center">
                <div className="bg-pink-100 border-2 border-pink-300 w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-pink-600" />
                </div>
                <h4 className="text-lg font-bold text-pink-700 mb-2">Quality</h4>
                <p className="text-gray-700 text-sm font-medium">
                  We deliver polished, reliable products that exceed user expectations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Join the Team */}
        <Card className="mb-16 bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl text-center text-indigo-700 font-bold">🚀 Join Our Mission</CardTitle>
            <CardDescription className="text-center text-gray-700 text-lg font-medium">
              Help us build the future of multi-chain DeFi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-8">
              <p className="text-gray-700 font-medium max-w-2xl mx-auto leading-relaxed">
                We're always looking for passionate individuals who share our vision of accessible, 
                community-driven DeFi. Whether you're a developer, designer, community manager, 
                or just someone who believes in our mission, there's a place for you on our team.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-lg text-center shadow-lg">
                <Code className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-blue-700 mb-2">Developers</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Full-stack, blockchain, and smart contract developers needed
                </p>
              </div>

              <div className="bg-purple-50 border-2 border-purple-200 p-6 rounded-lg text-center shadow-lg">
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-purple-700 mb-2">Community</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Community managers, content creators, and social media experts
                </p>
              </div>

              <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg text-center shadow-lg">
                <Target className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-green-700 mb-2">Specialists</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Security auditors, UI/UX designers, and marketing specialists
                </p>
              </div>
            </div>

            <div className="text-center">
              <Button className="bg-indigo-600 hover:bg-indigo-700 mr-4 font-medium">
                <MessageCircle className="w-4 h-4 mr-2" />
                Join Discord
              </Button>
              <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50 font-medium">
                View Open Positions
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-700 mb-2">2</div>
              <div className="text-gray-700 font-medium">Core Leaders</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-700 mb-2">Growing</div>
              <div className="text-gray-700 font-medium">Contributors</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-700 mb-2">100%</div>
              <div className="text-gray-700 font-medium">Community Owned</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-orange-700 mb-2">24/7</div>
              <div className="text-gray-700 font-medium">Community Support</div>
            </CardContent>
          </Card>
        </div>
      </div>
      
    </div>
  );
}
