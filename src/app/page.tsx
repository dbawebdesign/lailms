'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap, Users, BookOpen, Brain, TrendingUp, Shield, Star, Play, ChevronRight, Home, Sparkles, Target, Award, Lightbulb, MessageCircle, Menu, X, Facebook, Instagram, Linkedin, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShinyButton } from '@/components/ui/shiny-button'
import AnimatedGridBackground from '@/components/layout/AnimatedGridBackground'
import { ContactModal } from '@/components/ui/ContactModal'
import QuickGuideModal from '@/components/layout/QuickGuideModal'

export default function LandingPage() {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(false)

  useEffect(() => {
    // Word by word animation
    function animateWords() {
      const words = document.querySelectorAll('.word')
      const containers = document.querySelectorAll('h1, h2')
      
      // Show containers immediately
      containers.forEach(container => {
        ;(container as HTMLElement).style.animation = 'word-appear 0.3s ease-out forwards'
      })
      
      words.forEach(word => {
        const delay = parseInt(word.getAttribute('data-delay') || '0')
        
        setTimeout(() => {
          ;(word as HTMLElement).style.animation = 'word-appear 0.8s ease-out forwards'
        }, delay)
      })
    }

    // Mouse interaction
    let mouseX = 0, mouseY = 0
    const gradient = document.getElementById('mouse-gradient')
    
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      
      if (gradient) {
        gradient.style.left = (mouseX - 192) + 'px'
        gradient.style.top = (mouseY - 192) + 'px'
        gradient.style.opacity = '1'
      }
    }

    const handleMouseLeave = () => {
      if (gradient) {
        gradient.style.opacity = '0'
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    // Word hover effects
    document.querySelectorAll('.word').forEach(word => {
      word.addEventListener('mouseenter', () => {
        ;(word as HTMLElement).style.textShadow = '0 0 20px rgba(107, 93, 229, 0.5)'
      })
      
      word.addEventListener('mouseleave', () => {
        ;(word as HTMLElement).style.textShadow = 'none'
      })
    })

    // Click ripple effect
    const handleClick = (e: MouseEvent) => {
      const ripple = document.createElement('div')
      ripple.style.position = 'fixed'
      ripple.style.left = e.clientX + 'px'
      ripple.style.top = e.clientY + 'px'
      ripple.style.width = '4px'
      ripple.style.height = '4px'
      ripple.style.background = 'rgba(107, 93, 229, 0.6)'
      ripple.style.borderRadius = '50%'
      ripple.style.transform = 'translate(-50%, -50%)'
      ripple.style.pointerEvents = 'none'
      ripple.style.animation = 'pulse-glow 1s ease-out forwards'
      document.body.appendChild(ripple)
      
      setTimeout(() => ripple.remove(), 1000)
    }

    document.addEventListener('click', handleClick)

    // Initialize animations
    setTimeout(animateWords, 500)

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('click', handleClick)
    }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="relative px-6 py-4 flex items-center justify-between border-b border-gray-800 z-50">
        <AnimatedGridBackground 
          opacity={0.02}
          patternId="nav-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="flex items-center space-x-8 relative z-10">
          <Image
            src="/Horizontal white text.png"
            alt="Learnology AI"
            width={160}
            height={32}
            className="h-8 w-auto"
          />
          <div className="hidden md:flex items-center space-x-6 text-sm">
            <Link href="#homeschool" className="text-gray-300 hover:text-white transition-colors">Homeschool</Link>
            <Link href="#features" className="text-gray-300 hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</Link>
            <button 
              onClick={() => setIsContactModalOpen(true)}
              className="text-gray-300 hover:text-white transition-colors"
            >
              Contact
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-4 relative z-10">
          <Link href="/login" className="hidden md:block text-sm text-gray-300 hover:text-white transition-colors">Sign In</Link>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white text-sm px-6 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Get Started
            </Button>
          </Link>
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-[73px] left-0 right-0 bg-black border-b border-gray-800 z-40">
          <div className="flex flex-col py-4 px-6 space-y-4">
            <Link 
              href="#homeschool" 
              className="text-gray-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Homeschool
            </Link>
            <Link 
              href="#features" 
              className="text-gray-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link 
              href="#pricing" 
              className="text-gray-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Pricing
            </Link>

            <button 
              onClick={() => {
                setIsContactModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="text-gray-300 hover:text-white transition-colors py-2 text-left"
            >
              Contact
            </button>
            <hr className="border-gray-700 my-2" />
            <Link 
              href="/login" 
              className="text-gray-300 hover:text-white transition-colors py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center px-8 py-12 md:px-16 md:py-20 overflow-hidden">
        <AnimatedGridBackground 
          opacity={0.25}
          patternId="hero-grid"
          showFloatingElements={true}
          showCornerElements={true}
          showDetailDots={true}
        />

        {/* Top Text */}
        <div className="text-center mb-16">
          <h2 className="text-xs md:text-sm font-mono font-light text-gray-400 uppercase tracking-[0.2em] opacity-0">
            <span className="word" data-delay="0">Transform</span>
            <span className="word" data-delay="200">education</span>
            <span className="word" data-delay="400">with</span>
            <span className="word" data-delay="600">intelligence.</span>
          </h2>
          <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-[#6B5DE5] to-transparent opacity-30"></div>
        </div>

        {/* Center Text */}
        <div className="text-center max-w-6xl mx-auto mb-16 relative">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight leading-tight tracking-tight text-white text-decoration opacity-0">
            <div className="mb-4 md:mb-6">
              <span className="word" data-delay="800">The</span>
              <span className="word" data-delay="950">world's</span>
              <span className="word" data-delay="1100">first</span>
              <span className="word bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent" data-delay="1250"> AI-native </span>
              <span className="word" data-delay="1400">LMS.</span>
            </div>
            <div className="text-xl md:text-2xl lg:text-3xl font-thin text-gray-300 leading-relaxed">
              <span className="word" data-delay="1700">Where</span>
              <span className="word" data-delay="1850">artificial</span>
              <span className="word" data-delay="2000">intelligence</span>
              <span className="word" data-delay="2150">meets</span>
              <span className="word" data-delay="2300">personalized</span>
              <span className="word" data-delay="2450">learning,</span>
              <span className="word" data-delay="2600">creating</span>
              <span className="word" data-delay="2750">adaptive</span>
              <span className="word" data-delay="2900">experiences</span>
              <span className="word" data-delay="3050">that</span>
              <span className="word" data-delay="3200">evolve</span>
              <span className="word" data-delay="3350">with</span>
              <span className="word" data-delay="3500">every</span>
              <span className="word" data-delay="3650">student.</span>
            </div>
          </h1>
          
          {/* Details around main text */}
          <div className="absolute -left-8 top-1/2 w-4 h-px bg-[#6B5DE5] opacity-20 hidden md:block" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '3.8s'}}></div>
          <div className="absolute -right-8 top-1/2 w-4 h-px bg-[#E45DE5] opacity-20 hidden md:block" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4s'}}></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link href="https://calendly.com/zjones-learnologyai/learnology-ai-demo?month=2025-07" target="_blank" rel="noopener noreferrer">
            <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.2s'}}>
              Book a Consultation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <ShinyButton 
            className="px-8 py-3 flex items-center opacity-0" 
            style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.4s'}}
            onClick={() => setIsQuickGuideOpen(true)}
          >
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </ShinyButton>
        </div>

        {/* Bottom Text */}
        <div className="text-center">
          <div className="mb-4 w-16 h-px bg-gradient-to-r from-transparent via-[#FF835D] to-transparent opacity-30"></div>
          <h2 className="text-xs md:text-sm font-mono font-light text-gray-400 uppercase tracking-[0.2em] opacity-0">
            <span className="word" data-delay="4600">Generate</span>
            <span className="word" data-delay="4750">complete</span>
            <span className="word" data-delay="4900">courses</span>
            <span className="word" data-delay="5050">in</span>
            <span className="word" data-delay="5200">minutes.</span>
          </h2>
          
          {/* Additional details */}
          <div className="mt-6 flex justify-center space-x-4 opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '5.5s'}}>
            <div className="w-1 h-1 bg-[#6B5DE5] rounded-full opacity-40"></div>
            <div className="w-1 h-1 bg-[#E45DE5] rounded-full opacity-60"></div>
            <div className="w-1 h-1 bg-[#FF835D] rounded-full opacity-40"></div>
          </div>
        </div>

        {/* Interactive Gradient */}
        <div id="mouse-gradient" className="fixed pointer-events-none w-96 h-96 bg-gradient-radial from-[#6B5DE5]/10 to-transparent rounded-full blur-3xl transition-all duration-500 ease-out opacity-0"></div>
      </section>



      {/* Homeschool Section */}
      <section id="homeschool" className="relative px-6 py-20">
        <AnimatedGridBackground 
          opacity={0.06}
          patternId="homeschool-grid"
          showFloatingElements={true}
          showCornerElements={false}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-4">
              <Home className="w-8 h-8 text-[#E45DE5] mr-3" />
              <h2 className="text-4xl font-bold">Homeschool Education</h2>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Empower your homeschool journey with AI that adapts to your child's unique learning style, creates personalized curricula, and provides comprehensive progress tracking.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Sparkles className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Personalized Curriculum</h3>
              <p className="text-gray-300">AI creates custom learning paths tailored to your child's interests, learning style, and pace, ensuring engaging and effective education.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <BookOpen className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Multi-Grade Support</h3>
              <p className="text-gray-300">Effortlessly manage multiple children across different grade levels with AI-powered lesson planning and progress tracking.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <Award className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">State Standards Alignment</h3>
              <p className="text-gray-300">Automatically align your curriculum with state standards and generate compliance reports for easy record-keeping.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Lightbulb className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Interactive Learning</h3>
              <p className="text-gray-300">Engage children with AI-generated interactive activities, virtual field trips, and hands-on projects that make learning fun.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Users className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Parent Support</h3>
              <p className="text-gray-300">Get AI-powered teaching suggestions, lesson plans, and guidance to help you become the best educator for your child.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <TrendingUp className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Progress Insights</h3>
              <p className="text-gray-300">Comprehensive analytics and reporting to track your child's progress, identify strengths, and address learning gaps.</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#E45DE5]/10 to-[#FF835D]/10 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Start Your AI-Powered Homeschool Journey</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join thousands of homeschool families who have discovered the power of AI-personalized education that grows with their children.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-[#E45DE5] via-[#FF835D] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity">
                  Get started today
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative px-6 py-20 bg-gray-900/50">
        <AnimatedGridBackground 
          opacity={0.04}
          patternId="features-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">AI-Native Features That Transform Homeschool Learning</h2>
            <p className="text-xl text-gray-300">Powered by advanced AI designed specifically for homeschool families</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <Brain className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Luna AI Assistant</h3>
              <p className="text-gray-300">24/7 intelligent tutoring with context-aware responses, Socratic dialogue, and multi-persona support for diverse learning needs.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <TrendingUp className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Adaptive Assessments</h3>
              <p className="text-gray-300">AI-powered assessments that adjust difficulty in real-time, providing accurate skill measurement and personalized feedback.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Zap className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Instant Content Generation</h3>
              <p className="text-gray-300">Transform any document into complete courses with lessons, quizzes, and multimedia content in minutes, not weeks.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <BookOpen className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Smart Knowledge Base</h3>
              <p className="text-gray-300">Secure document ingestion with automatic chunking, embeddings, and AI-powered content discovery for your homeschool curriculum.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Users className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Family Learning Support</h3>
              <p className="text-gray-300">AI-powered tools to help parents track multiple children's progress, coordinate learning activities, and connect with other homeschool families.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Shield className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Privacy & Security</h3>
              <p className="text-gray-300">Secure, family-focused AI environments with privacy protection and data security designed specifically for homeschool families.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative px-6 py-20">
        <AnimatedGridBackground 
          opacity={0.08}
          patternId="stats-grid"
          showFloatingElements={true}
          showCornerElements={true}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto text-center relative z-10">
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
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">75%</div>
              <div className="text-gray-300">Reduction in Admin Tasks</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">99.9%</div>
              <div className="text-gray-300">Platform Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Tools Showcase */}
      <section className="relative px-6 py-20 bg-gray-900/50">
        <AnimatedGridBackground 
          opacity={0.04}
          patternId="ai-tools-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-7xl mx-auto relative z-10">
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
            </div>
            
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">AI Teacher Dashboard</h3>
                    <div className="text-xs text-gray-400">Live Demo</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-[#6B5DE5]/20 to-[#E45DE5]/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">24</div>
                      <div className="text-xs text-gray-300">Lessons Generated</div>
                    </div>
                    <div className="bg-gradient-to-r from-[#E45DE5]/20 to-[#FF835D]/20 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">16</div>
                      <div className="text-xs text-gray-300">Assessments Created</div>
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
                        <span>🎯 Lesson Planner</span>
                        <span className="text-yellow-400">Processing</span>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>🧠 Luna AI Tutor</span>
                        <span className="text-blue-400">Active</span>
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
      <section className="relative px-6 py-20">
        <AnimatedGridBackground 
          opacity={0.06}
          patternId="student-grid"
          showFloatingElements={true}
          showCornerElements={false}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold">JS</span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Jane's Learning Space</div>
                      <div className="text-xs text-gray-400">Biology - Cell Structure</div>
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-sm font-medium mb-2">Learning Progress</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Mastery Level</span>
                        <span className="text-[#6B5DE5]">87%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#6B5DE5] to-[#E45DE5] h-2 rounded-full w-[87%]"></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-[#6B5DE5]/20 to-[#E45DE5]/20 rounded-lg p-3 text-sm">
                      🎯 Personalized pathway adapted
                    </div>
                    <div className="bg-gradient-to-r from-[#E45DE5]/20 to-[#FF835D]/20 rounded-lg p-3 text-sm">
                      🧠 AI tutor session completed
                    </div>
                    <div className="bg-gradient-to-r from-[#FF835D]/20 to-[#6B5DE5]/20 rounded-lg p-3 text-sm">
                      📊 Assessment feedback ready
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8 order-1 lg:order-2">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold">AI-Powered Student Experience</h2>
                <p className="text-xl text-gray-300">
                  Personalized learning companions that adapt to each student's needs, providing support and guidance every step of the way.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Adaptive Learning Paths</div>
                    <div className="text-gray-300 text-sm">AI adjusts content difficulty and pacing based on individual progress</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#E45DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Intelligent Tutoring</div>
                    <div className="text-gray-300 text-sm">24/7 AI support with personalized explanations and guidance</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#FF835D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Real-time Feedback</div>
                    <div className="text-gray-300 text-sm">Instant assessment and suggestions for improvement</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Progress Analytics</div>
                    <div className="text-gray-300 text-sm">Detailed insights into learning patterns and achievements</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* Pricing Section */}
      <section id="pricing" className="relative py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <AnimatedGridBackground 
          opacity={0.06}
          patternId="pricing-grid"
          showFloatingElements={true}
          showCornerElements={false}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Choose the plan that best fits your family's needs. All plans come with 
              our full suite of AI-powered learning tools.
            </p>
          </div>

          {/* Homeschool Pricing */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] p-0.5 rounded-full mb-4">
                <div className="bg-black rounded-full px-6 py-2 flex items-center space-x-2">
                  <Home className="w-5 h-5 text-white" />
                  <span className="text-white font-semibold">Homeschool Families</span>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Single Family */}
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 flex flex-col">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Single Family</h3>
                  <p className="text-gray-400 mb-6">For families joining after initial launch offer</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$40</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Up to 6 users included</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">$7/month for each additional user</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Full access to all features</span>
                  </li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white py-3 rounded-lg hover:opacity-90 transition-opacity">
                    Get started today
                  </Button>
                </Link>
              </div>

              {/* Micro-Academies & Networks */}
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 flex flex-col">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Micro-Academies & Networks</h3>
                  <p className="text-gray-400 mb-6">Ideal for co-ops and small learning groups</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$5</span>
                    <span className="text-gray-400">/mo/user</span>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2 rounded-lg mb-6 text-sm font-semibold">
                    30 days FREE for the network!
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Billed per active user</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Admin dashboard for user management</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Full access to all features</span>
                  </li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white py-3 rounded-lg hover:opacity-90 transition-opacity">
                    Get started today
                  </Button>
                </Link>
              </div>
            </div>
          </div>



          {/* FAQ Section */}
          <div className="border-t border-gray-800 pt-20 mt-20">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Frequently Asked Questions</h3>
              <p className="text-gray-400">Everything you need to know about our pricing</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">What's included in all plans?</h4>
                  <p className="text-gray-400 text-sm">All plans include AI-powered course generation, personalized learning paths, assessment tools, progress tracking, and 24/7 support.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Can I change plans anytime?</h4>
                  <p className="text-gray-400 text-sm">Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the next billing cycle.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Is there a free trial?</h4>
                  <p className="text-gray-400 text-sm">Yes! 30 days free for homeschool co-op and networks.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">What counts as a user?</h4>
                  <p className="text-gray-400 text-sm">A user is anyone who has an active account and can access the platform - this includes students, teachers, parents, and administrators.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Do you offer discounts for nonprofits?</h4>
                  <p className="text-gray-400 text-sm">Yes, we offer special pricing for qualifying nonprofit organizations and educational institutions. Contact us for details.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">How does billing work?</h4>
                  <p className="text-gray-400 text-sm">All plans are billed monthly. For organizations, billing is based on active users at the time of billing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Guides Section */}
      <section id="video-guides" className="relative py-24 px-6 bg-gradient-to-b from-gray-900 to-black">
        <AnimatedGridBackground 
          opacity={0.05}
          patternId="video-guides-grid"
          showFloatingElements={true}
          showCornerElements={false}
          showDetailDots={true}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6">
              <span className="word" data-delay="0">Learn</span>{' '}
              <span className="word" data-delay="200">How</span>{' '}
              <span className="word" data-delay="400">to</span>{' '}
              <span className="word" data-delay="600">Get</span>{' '}
              <span className="word" data-delay="800">Started</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
              Watch our step-by-step video guides to master the platform quickly. 
              No account required - these resources are available to everyone.
            </p>
            <div className="flex justify-center">
              <Button 
                className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-4 rounded-lg hover:opacity-90 transition-all duration-200 ease-in-out text-lg"
                onClick={() => setIsQuickGuideOpen(true)}
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Video Guides
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Getting Started */}
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-200 ease-in-out">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#FF835D] to-[#E45DE5] p-4 rounded-xl mr-4">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Getting Started</h3>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Learn the basics of setting up your account, navigating the interface, and creating your first course.
              </p>

            </div>

            {/* For Teachers */}
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-200 ease-in-out">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#E45DE5] to-[#6B5DE5] p-4 rounded-xl mr-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">For Teachers</h3>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Discover advanced features like AI-powered course generation, assessment creation, and student progress tracking.
              </p>

            </div>

            {/* For Parents */}
            <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-gray-600 transition-all duration-200 ease-in-out">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-[#6B5DE5] to-[#FF835D] p-4 rounded-xl mr-4">
                  <Home className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">For Parents</h3>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Learn how to monitor your child's progress, set learning goals, and collaborate with teachers effectively.
              </p>

            </div>
          </div>

          <div className="text-center mt-16">
            <p className="text-gray-400 mb-8 text-lg max-w-2xl mx-auto">
              Need help with something specific? Our comprehensive video library covers everything from basic setup to advanced features.
            </p>
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                className="border-gray-600 text-gray-300 hover:bg-gray-800 transition-all duration-200 ease-in-out px-6 py-3"
                onClick={() => setIsQuickGuideOpen(true)}
              >
                <Play className="w-4 h-4 mr-2" />
                Browse All Videos
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-gray-800 px-6 py-16">
        <AnimatedGridBackground 
          opacity={0.03}
          patternId="footer-grid"
          showFloatingElements={false}
          showCornerElements={false}
          showDetailDots={false}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Main Footer Content */}
          <div className="grid lg:grid-cols-3 gap-12 mb-12">
            {/* Logo and Description - Takes up more space */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <Image
                  src="/Horizontal white text.png"
                  alt="Learnology AI"
                  width={280}
                  height={56}
                  className="h-12 w-auto"
                />
                <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
                  AI-first learning management system transforming education through intelligent automation and personalization. 
                  Empowering educators with cutting-edge tools to create engaging, adaptive learning experiences.
                </p>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white">Get in Touch</h4>
                <div className="space-y-1 text-sm text-gray-400">
                  <div>
                    <a 
                      href="mailto:zjones@learnologyai.com?subject=General Inquiry&body=Hello,%0D%0A%0D%0AI'm interested in learning more about Learnology AI and how it can benefit our educational institution.%0D%0A%0D%0AThank you!"
                      className="hover:text-white transition-colors"
                    >
                      zjones@learnologyai.com
                    </a>
                  </div>
                  <div>
                    <a 
                      href="https://calendly.com/zjones-learnologyai/learnology-ai-demo?month=2025-01"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors"
                    >
                      Schedule a Demo
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Navigation Links */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Solutions</h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <div><Link href="#homeschool" className="hover:text-white transition-colors">Homeschool</Link></div>
                  <div><Link href="#features" className="hover:text-white transition-colors">Features</Link></div>
                  <div><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Resources</h4>
                <div className="space-y-2 text-sm text-gray-400">
                  <div><button type="button" onClick={() => setIsQuickGuideOpen(true)} className="hover:text-white transition-colors text-left">Video Guides</button></div>
                  <div><Link href="/affiliate" className="hover:text-white transition-colors">Become an Affiliate</Link></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Follow Us</h4>
                <div className="flex space-x-4">
                  <a 
                    href="https://www.facebook.com/p/Learnology-AI-61573064702124/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] hover:opacity-80 transition-opacity"
                    aria-label="Follow us on Facebook"
                  >
                    <Facebook className="w-5 h-5 text-white" />
                  </a>
                  <a 
                    href="https://www.instagram.com/learnologyai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] hover:opacity-80 transition-opacity"
                    aria-label="Follow us on Instagram"
                  >
                    <Instagram className="w-5 h-5 text-white" />
                  </a>
                  <a 
                    href="https://www.linkedin.com/company/learnology-ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] hover:opacity-80 transition-opacity"
                    aria-label="Follow us on LinkedIn"
                  >
                    <Linkedin className="w-5 h-5 text-white" />
                  </a>
                  <a 
                    href="https://www.tiktok.com/@learnologyai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] hover:opacity-80 transition-opacity"
                    aria-label="Follow us on TikTok"
                  >
                    <Video className="w-5 h-5 text-white" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Footer */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-400">
              © 2025 Learnology AI. All rights reserved.
            </div>
            <div className="flex space-x-6 text-sm text-gray-400 mt-4 md:mt-0">
              <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      <ContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
      />

      <QuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
      />
    </div>
  )
}
