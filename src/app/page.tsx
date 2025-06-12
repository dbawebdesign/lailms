'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Zap, Users, BookOpen, Brain, TrendingUp, Shield, Star, Play, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShinyButton } from '@/components/ui/shiny-button'

export default function LandingPage() {
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
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-800 relative z-50">
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
      <section className="relative min-h-screen flex flex-col justify-center items-center px-8 py-12 md:px-16 md:py-20 overflow-hidden">
        {/* Grid Background */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(107,93,229,0.25)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Main grid lines */}
          <line x1="0" y1="20%" x2="100%" y2="20%" className="grid-line" style={{animationDelay: '0.5s'}} />
          <line x1="0" y1="80%" x2="100%" y2="80%" className="grid-line" style={{animationDelay: '1s'}} />
          <line x1="20%" y1="0" x2="20%" y2="100%" className="grid-line" style={{animationDelay: '1.5s'}} />
          <line x1="80%" y1="0" x2="80%" y2="100%" className="grid-line" style={{animationDelay: '2s'}} />
          
          {/* Accent lines */}
          <line x1="50%" y1="0" x2="50%" y2="100%" className="grid-line opacity-10" style={{animationDelay: '2.5s'}} />
          <line x1="0" y1="50%" x2="100%" y2="50%" className="grid-line opacity-10" style={{animationDelay: '3s'}} />
          
          {/* Detail dots */}
          <circle cx="20%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3s'}} />
          <circle cx="80%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3.2s'}} />
          <circle cx="20%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.4s'}} />
          <circle cx="80%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.6s'}} />
          <circle cx="50%" cy="50%" r="1.5" className="detail-dot" style={{animationDelay: '4s'}} />
        </svg>

        {/* Corner Elements */}
        <div className="corner-element top-8 left-8" style={{animationDelay: '4s'}}>
          <div className="absolute top-0 left-0 w-2 h-2 bg-[#6B5DE5] opacity-60"></div>
        </div>
        <div className="corner-element top-8 right-8" style={{animationDelay: '4.2s'}}>
          <div className="absolute top-0 right-0 w-2 h-2 bg-[#E45DE5] opacity-60"></div>
        </div>
        <div className="corner-element bottom-8 left-8" style={{animationDelay: '4.4s'}}>
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#FF835D] opacity-60"></div>
        </div>
        <div className="corner-element bottom-8 right-8" style={{animationDelay: '4.6s'}}>
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#6B5DE5] opacity-60"></div>
        </div>

        {/* Floating Elements */}
        <div className="floating-element" style={{top: '25%', left: '15%', animationDelay: '5s'}}></div>
        <div className="floating-element" style={{top: '60%', left: '85%', animationDelay: '5.5s'}}></div>
        <div className="floating-element" style={{top: '40%', left: '10%', animationDelay: '6s'}}></div>
        <div className="floating-element" style={{top: '75%', left: '90%', animationDelay: '6.5s'}}></div>

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
          <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.2s'}}>
            Book a Consultation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <ShinyButton className="px-8 py-3 flex items-center opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.4s'}}>
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
