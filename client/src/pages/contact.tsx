import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Mail, Clock, Users, Heart, ExternalLink, Instagram, Music, Link as LinkIcon } from 'lucide-react';

export default function ContactPage() {
  const handleConnectWallet = () => {
    // Wallet connection handled by swap pages
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would go here

  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen">
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-blue-600 mb-6">
            📧 Contact Us
          </h1>
          <p className="text-lg sm:text-xl text-gray-700 font-medium max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
            Get in touch with the RiddleSwap team - we're here to help and always excited to hear from our community!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 px-4 sm:px-0">
          {/* Contact Form */}
          <Card className="bg-white border-2 border-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl text-blue-700 font-bold flex items-center gap-3">
                <Mail className="w-6 h-6" />
                Send us a Message
              </CardTitle>
              <CardDescription className="text-gray-700 font-medium">
                Fill out the form below and we'll get back to you as soon as possible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Name *
                    </label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Your name"
                      required
                      className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Email *
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your.email@example.com"
                      required
                      className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Subject *
                  </label>
                  <Input
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="What's this about?"
                    required
                    className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Message *
                  </label>
                  <Textarea
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Tell us more about your question, feedback, or how we can help..."
                    required
                    rows={6}
                    className="bg-white border-2 border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500"
                  />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-bold">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information & Community */}
          <div className="space-y-8">
            {/* Community Support */}
            <Card className="bg-white border-2 border-purple-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-purple-700 font-bold flex items-center gap-3">
                  <MessageCircle className="w-6 h-6" />
                  Community Support
                </CardTitle>
                <CardDescription className="text-gray-700 font-medium">
                  Get instant help from our community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <a 
                    href="https://discord.gg/NfKPdjxF" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 hover:bg-indigo-100 transition-colors shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <MessageCircle className="w-5 h-5 text-indigo-700" />
                        <span className="text-indigo-700 font-bold">Discord Community</span>
                        <Badge className="bg-green-100 text-green-700 border border-green-300 text-xs font-medium">Most Active</Badge>
                      </div>
                      <p className="text-gray-700 font-medium text-sm">
                        Join our Discord for real-time support, community discussions, and direct access to the team.
                      </p>
                    </div>
                  </a>

                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <Mail className="w-5 h-5 text-blue-700" />
                      <span className="text-blue-700 font-bold">Email Support</span>
                    </div>
                    <p className="text-gray-700 font-medium text-sm mb-2">
                      For direct support, you can reach us at:
                    </p>
                    <a 
                      href="mailto:support@riddleswap.com" 
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm underline"
                    >
                      support@riddleswap.com
                    </a>
                    <p className="text-gray-600 text-xs mt-2">
                      Response time: Within 24-48 hours
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* Social Media */}
            <Card className="bg-pink-50 border-2 border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-pink-700 font-bold flex items-center gap-3">
                  <Heart className="w-6 h-6" />
                  Connect With Us
                </CardTitle>
                <CardDescription className="text-gray-700 font-medium">
                  Follow us on social media for updates and community content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <a 
                    href="https://t.me/riddlexrp" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center hover:bg-blue-100 transition-colors shadow-sm"
                  >
                    <Send className="w-6 h-6 text-blue-700 mx-auto mb-2" />
                    <div className="text-gray-900 font-bold text-sm">Telegram</div>
                    <div className="text-gray-600 font-medium text-xs">Daily Updates</div>
                  </a>
                  
                  <a 
                    href="https://www.instagram.com/riddlechainxrp/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-pink-50 border-2 border-pink-200 rounded-lg p-4 text-center hover:bg-pink-100 transition-colors shadow-sm"
                  >
                    <Instagram className="w-6 h-6 text-pink-700 mx-auto mb-2" />
                    <div className="text-gray-900 font-bold text-sm">Instagram</div>
                    <div className="text-gray-600 font-medium text-xs">Visual Content</div>
                  </a>
                  
                  <a 
                    href="https://www.tiktok.com/@riddlechainxrp" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 text-center hover:bg-purple-100 transition-colors shadow-sm"
                  >
                    <Music className="w-6 h-6 text-purple-700 mx-auto mb-2" />
                    <div className="text-gray-900 font-bold text-sm">TikTok</div>
                    <div className="text-gray-600 font-medium text-xs">Fun Videos</div>
                  </a>
                  
                  <a 
                    href="https://linktr.ee/riddlechain" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center hover:bg-green-100 transition-colors shadow-sm"
                  >
                    <LinkIcon className="w-6 h-6 text-green-700 mx-auto mb-2" />
                    <div className="text-gray-900 font-bold text-sm">Linktree</div>
                    <div className="text-gray-600 font-medium text-xs">All Links</div>
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Contact Types */}
            <Card className="bg-orange-50 border-2 border-orange-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-orange-700 font-bold">What can we help with?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-sm font-medium">Technical support and bug reports</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <span className="text-sm font-medium">Feature requests and suggestions</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    <span className="text-sm font-medium">Partnership and collaboration inquiries</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                    <span className="text-sm font-medium">Community questions and feedback</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-pink-600 rounded-full"></div>
                    <span className="text-sm font-medium">Press and media inquiries</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-teal-600 rounded-full"></div>
                    <span className="text-sm font-medium">Developer and integration support</span>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                  <div className="text-yellow-700 font-bold mb-2">🕵️ Found a Hidden Code?</div>
                  <p className="text-sm text-gray-700 font-medium">
                    If you discovered one of our easter eggs (codes 3210 or 589), mention it in your message for a special response!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Quick Links */}
        <Card className="mt-16 bg-gray-50 border-2 border-gray-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-gray-700 font-bold">❓ Quick Help</CardTitle>
            <CardDescription className="text-center text-gray-600 font-medium">
              Common questions and instant answers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-blue-700 font-bold mb-2">How do I connect my wallet?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Visit any swap page and click the wallet connection button. We support Xaman for XRPL and WalletConnect for EVM/Solana.
                </p>
              </div>
              
              <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-green-700 font-bold mb-2">What are the trading fees?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  RiddleSwap charges a 1% platform fee on all trades, which goes directly to community development and platform maintenance.
                </p>
              </div>
              
              <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-purple-700 font-bold mb-2">Which chains are supported?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  We support XRPL, 7 EVM chains (Ethereum, Polygon, etc.), and Solana with plans to add more based on community demand.
                </p>
              </div>
              
              <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-orange-700 font-bold mb-2">Is RiddleSwap secure?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Yes! We use non-custodial architecture, trusted APIs, and have no access to your funds.
                </p>
              </div>
              
              <div className="bg-teal-50 border-2 border-teal-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-teal-700 font-bold mb-2">How can I contribute?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Join our Discord community! We welcome developers, designers, content creators, and anyone passionate about DeFi.
                </p>
              </div>
              
              <div className="bg-pink-50 border-2 border-pink-200 p-4 rounded-lg shadow-sm">
                <h4 className="text-pink-700 font-bold mb-2">When will new features launch?</h4>
                <p className="text-gray-700 text-sm font-medium">
                  Check our roadmap and follow our social media for updates. Major releases like RiddleBridge have countdown timers on the homepage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
    </div>
  );
}
