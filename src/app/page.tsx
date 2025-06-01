import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap, Users, BookOpen, Brain, TrendingUp, Shield, Star, Play, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center space-x-8">
          <Image
            src="/Horizontal white text.png"
            alt="Learnology AI"
            width={160}
            height={32}
            className="h-8 w-auto"
          />
          <div className="hidden md:flex items-center space-x-6 text-sm">
            <Link href="#product" className="text-gray-300 hover:text-white transition-colors">Product</Link>
            <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
            <Link href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">Sign In</Link>
          <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white text-sm px-6 py-2 rounded-lg hover:opacity-90 transition-opacity">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                The world's first
                <span className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">
                  {" "}AI-first LMS
                </span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Transform education with an AI-powered learning management system that creates, adapts, and personalizes content in real-time. Generate complete courses in minutes, not months.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center">
                Start Building Today
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center">
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 text-sm">
                  <div className="text-blue-400">Luna AI:</div>
                  <div className="text-gray-300 mt-1">I've generated a complete Biology course based on your uploaded textbook. Would you like me to create adaptive assessments for each chapter?</div>
                </div>
                <div className="space-y-2">
                  <div className="bg-gradient-to-r from-[#6B5DE5]/20 to-[#E45DE5]/20 rounded-lg p-3 text-sm">
                    ✅ Generated 12 lessons with interactive content
                  </div>
                  <div className="bg-gradient-to-r from-[#E45DE5]/20 to-[#FF835D]/20 rounded-lg p-3 text-sm">
                    🎯 Created personalized learning paths for 127 students
                  </div>
                  <div className="bg-gradient-to-r from-[#FF835D]/20 to-[#6B5DE5]/20 rounded-lg p-3 text-sm">
                    📊 Automated grading with 98% accuracy
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] rounded-full opacity-20 blur-xl"></div>
            <div className="absolute -bottom-8 -left-4 w-32 h-32 bg-gradient-to-r from-[#E45DE5] to-[#FF835D] rounded-full opacity-20 blur-xl"></div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Transform Learning</h2>
            <p className="text-xl text-gray-300">Powered by advanced AI that understands education</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <Brain className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">AI Course Generation</h3>
              <p className="text-gray-300">Upload any document and watch AI generate complete courses with lessons, assessments, and adaptive content in minutes.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <TrendingUp className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Adaptive Learning Paths</h3>
              <p className="text-gray-300">Personalized journeys that adjust in real-time based on student performance, learning style, and engagement patterns.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Zap className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Luna AI Assistant</h3>
              <p className="text-gray-300">24/7 intelligent tutoring with context-aware responses, Socratic dialogue, and multi-persona support for diverse learning needs.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <BookOpen className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Smart Knowledge Base</h3>
              <p className="text-gray-300">Secure document ingestion with automatic chunking, embeddings, and AI-powered content discovery across your institution.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Users className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Collaborative Learning</h3>
              <p className="text-gray-300">AI-moderated group projects, peer matching, and intelligent discussion facilitation for enhanced social learning.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Shield className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Enterprise Security</h3>
              <p className="text-gray-300">Tenant-isolated AI environments, FERPA/GDPR compliance, and comprehensive audit logging for institutional trust.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Transforming Education at Scale</h2>
          <p className="text-xl text-gray-300 mb-16">Join forward-thinking institutions already revolutionizing learning</p>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">98%</div>
              <div className="text-gray-300">Content Generation Accuracy</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">15min</div>
              <div className="text-gray-300">Course Creation Time</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">60%</div>
              <div className="text-gray-300">Instructor Workload Reduction</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">99.9%</div>
              <div className="text-gray-300">Platform Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Tools Showcase */}
      <section className="px-6 py-20 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold">Powerful AI Tools for Every Educator</h2>
                <p className="text-xl text-gray-300">
                  A comprehensive suite of AI-powered generators that streamline instructional tasks and enhance teaching effectiveness.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Smart Rubric Generator</div>
                    <div className="text-gray-300 text-sm">Create custom assessment rubrics aligned with learning objectives</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#E45DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Lesson Plan Generator</div>
                    <div className="text-gray-300 text-sm">Generate comprehensive lesson plans from prompts or documents</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#FF835D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Adaptive Quiz Builder</div>
                    <div className="text-gray-300 text-sm">AI-generated assessments with multiple difficulty levels</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Content Leveler</div>
                    <div className="text-gray-300 text-sm">Automatically adjust reading levels for diverse learners</div>
                  </div>
                </div>
              </div>
              
              <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity">
                Explore All Tools
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Teacher Tools Dashboard</h3>
                    <div className="text-xs text-gray-400">Live Demo</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-[#6B5DE5]/20 to-[#E45DE5]/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">12</div>
                      <div className="text-xs text-gray-300">Lessons Generated</div>
                    </div>
                    <div className="bg-gradient-to-r from-[#E45DE5]/20 to-[#FF835D]/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">8</div>
                      <div className="text-xs text-gray-300">Quizzes Created</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>📝 Rubric Generator</span>
                        <span className="text-green-400">Ready</span>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>🎯 Mind Map Creator</span>
                        <span className="text-yellow-400">Processing</span>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>🎧 BrainBytes Podcast</span>
                        <span className="text-blue-400">Generating</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Student Experience */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold">JS</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Jane's Study Space</div>
                      <div className="text-xs text-gray-400">Biology - Cell Structure</div>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-sm font-medium mb-2">Study Progress</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Understanding Level</span>
                        <span className="text-[#6B5DE5]">87%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] h-2 rounded-full w-[87%]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-[#6B5DE5]/20 to-[#E45DE5]/20 rounded-lg p-3 text-sm">
                      🎯 Personalized learning path adapted
                    </div>
                    <div className="bg-gradient-to-r from-[#E45DE5]/20 to-[#FF835D]/20 rounded-lg p-3 text-sm">
                      🧠 Mind map generated from notes
                    </div>
                    <div className="bg-gradient-to-r from-[#FF835D]/20 to-[#6B5DE5]/20 rounded-lg p-3 text-sm">
                      🎧 Audio summary created
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8 order-1 lg:order-2">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold">Study Space: Your Personal Learning Companion</h2>
                <p className="text-xl text-gray-300">
                  NotebookLM-style study tools that adapt to each student's learning style and provide personalized support.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Smart Note-Taking</div>
                    <div className="text-gray-300 text-sm">Automatic summarization, tagging, and flashcard generation</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#E45DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">AI-Generated Mind Maps</div>
                    <div className="text-gray-300 text-sm">Visual concept mapping from lectures and readings</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#FF835D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Audio Learning Podcasts</div>
                    <div className="text-gray-300 text-sm">One-click audio summaries and teaching explanations</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Contextual AI Tutor</div>
                    <div className="text-gray-300 text-sm">24/7 support with Socratic dialogue and multiple personas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Trusted by Innovative Educators</h2>
            <p className="text-xl text-gray-300">See how Learnology AI is transforming learning experiences</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6">
                "Learnology AI has revolutionized our curriculum development. What used to take weeks now takes minutes, and the quality is exceptional."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">DR</span>
                </div>
                <div>
                  <div className="font-semibold">Dr. Sarah Rodriguez</div>
                  <div className="text-sm text-gray-400">Director of Curriculum, Metro University</div>
                </div>
              </div>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6">
                "The adaptive learning paths have increased student engagement by 200%. Our students are more motivated than ever."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#E45DE5] to-[#FF835D] rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">MJ</span>
                </div>
                <div>
                  <div className="font-semibold">Michael Johnson</div>
                  <div className="text-sm text-gray-400">High School Principal, Innovation Academy</div>
                </div>
              </div>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 mb-6">
                "The AI tutoring system provides 24/7 support that rivals human tutors. Our students love the personalized assistance."
              </p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#FF835D] to-[#6B5DE5] rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold">LC</span>
                </div>
                <div>
                  <div className="font-semibold">Lisa Chen</div>
                  <div className="text-sm text-gray-400">Professor of Computer Science, Tech Institute</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Institution?</h2>
          <p className="text-xl text-gray-300 mb-12">
            Join the AI-first education revolution. Start creating intelligent, adaptive learning experiences today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-12 py-4 text-lg rounded-lg hover:opacity-90 transition-opacity">
              Start Free Trial
            </Button>
            <Button variant="outline" className="border-gray-600 text-white px-12 py-4 text-lg rounded-lg hover:bg-gray-800 transition-colors">
              Schedule Demo
            </Button>
          </div>
          
          <p className="text-sm text-gray-400 mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <Image
                src="/Horizontal white text.png"
                alt="Learnology AI"
                width={160}
                height={32}
                className="h-8 w-auto"
              />
              <p className="text-gray-400 text-sm">
                AI-first learning management system transforming education through intelligent automation and personalization.
              </p>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Product</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div><Link href="#" className="hover:text-white transition-colors">Features</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Pricing</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Security</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Integrations</Link></div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Resources</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div><Link href="#" className="hover:text-white transition-colors">Documentation</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">API Reference</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Best Practices</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Support</Link></div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold">Company</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <div><Link href="#" className="hover:text-white transition-colors">About</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Blog</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Careers</Link></div>
                <div><Link href="#" className="hover:text-white transition-colors">Contact</Link></div>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-400">
              © 2024 Learnology AI. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm text-gray-400 mt-4 md:mt-0">
              <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-white transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
