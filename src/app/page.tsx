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
            <span className="word" data-delay="0">Stop</span>
            <span className="word" data-delay="200">drowning</span>
            <span className="word" data-delay="400">in</span>
            <span className="word" data-delay="600">curriculum</span>
            <span className="word" data-delay="800">chaos.</span>
          </h2>
          <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-[#6B5DE5] to-transparent opacity-30"></div>
        </div>

        {/* Center Text */}
        <div className="text-center max-w-6xl mx-auto mb-16 relative">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight leading-tight tracking-tight text-white text-decoration opacity-0">
            <div className="mb-4 md:mb-6">
              <span className="word" data-delay="800">Get</span>
              <span className="word" data-delay="950">15</span>
              <span className="word" data-delay="1100">hours</span>
              <span className="word" data-delay="1250">back</span>
              <span className="word bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent" data-delay="1400"> every week.</span>
            </div>
            <div className="text-xl md:text-2xl lg:text-3xl font-thin text-gray-300 leading-relaxed">
              <span className="word" data-delay="1700">AI</span>
              <span className="word" data-delay="1850">creates</span>
              <span className="word" data-delay="2000">personalized</span>
              <span className="word" data-delay="2150">lesson</span>
              <span className="word" data-delay="2300">plans</span>
              <span className="word" data-delay="2450">instantly,</span>
              <span className="word" data-delay="2600">adapts</span>
              <span className="word" data-delay="2750">to</span>
              <span className="word" data-delay="2900">each</span>
              <span className="word" data-delay="3050">child's</span>
              <span className="word" data-delay="3200">learning</span>
              <span className="word" data-delay="3350">style,</span>
              <span className="word" data-delay="3500">and</span>
              <span className="word" data-delay="3650">handles</span>
              <span className="word" data-delay="3800">multiple</span>
              <span className="word" data-delay="3950">grades</span>
              <span className="word" data-delay="4100">effortlessly.</span>
              <span className="word" data-delay="4250">Spend</span>
              <span className="word" data-delay="4400">less</span>
              <span className="word" data-delay="4550">time</span>
              <span className="word" data-delay="4700">planning,</span>
              <span className="word" data-delay="4850">and</span>
              <span className="word" data-delay="5000">more</span>
              <span className="word" data-delay="5150">time</span>
              <span className="word" data-delay="5300">engaging</span>
              <span className="word" data-delay="5450">with</span>
              <span className="word" data-delay="5600">your</span>
              <span className="word" data-delay="5750">kids.</span>
            </div>
          </h1>
          
          {/* Details around main text */}
          <div className="absolute -left-8 top-1/2 w-4 h-px bg-[#6B5DE5] opacity-20 hidden md:block" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '3.8s'}}></div>
          <div className="absolute -right-8 top-1/2 w-4 h-px bg-[#E45DE5] opacity-20 hidden md:block" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4s'}}></div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.2s'}}>
              Start Free - See How It Works
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
            <span className="word" data-delay="4600">AI</span>
            <span className="word" data-delay="4750">Powered</span>
            <span className="word" data-delay="4900">Homeschool</span>
            <span className="word" data-delay="5050">Learning</span>
            <span className="word" data-delay="5200">Management</span>
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
              <h2 className="text-4xl font-bold">Finally, Homeschool Without the Overwhelm</h2>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Stop spending 15+ hours a week planning lessons. Our AI instantly creates personalized curricula that adapt to each child's learning style, handles multiple grade levels, and gives you confidence you're providing excellent education.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Sparkles className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">End Curriculum Shopping Forever</h3>
              <p className="text-gray-300">Stop wasting $500+ annually on curricula that don't work. AI creates custom learning paths that actually fit each child's learning style and interests - no more guessing.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <BookOpen className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Teach Multiple Kids Without Losing Your Mind</h3>
              <p className="text-gray-300">AI automatically creates age-appropriate lessons for each child simultaneously. No more juggling different curricula or feeling like you're shortchanging someone.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <Award className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Never Worry About "Am I Doing Enough?"</h3>
              <p className="text-gray-300">Automatically aligns with state standards and generates compliance reports. You'll have confidence you're meeting requirements without the constant second-guessing.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Lightbulb className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Kids Actually Want to Learn</h3>
              <p className="text-gray-300">AI creates engaging activities that match each child's interests. No more battles over "boring" lessons - they'll be excited to start school each day.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Users className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Feel Like a Professional Teacher</h3>
              <p className="text-gray-300">AI gives you expert teaching strategies and explanations for every lesson. You'll have the confidence to tackle any subject, even high school chemistry.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <TrendingUp className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">See Real Progress (Not Just Busy Work)</h3>
              <p className="text-gray-300">Clear analytics show exactly what each child has mastered and where they need support. No more wondering if they're actually learning or just completing assignments.</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#E45DE5]/10 to-[#FF835D]/10 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Transform Your Homeschool Experience in 30 Days</h3>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Join homeschool families who went from overwhelmed and stressed to confident and organized. Get your evenings back, reduce planning time by 90%, and watch your kids thrive with personalized learning.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-[#E45DE5] via-[#FF835D] to-[#6B5DE5] text-white px-8 py-3 rounded-lg hover:opacity-90 transition-opacity">
                  Start Free Trial
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
            <h2 className="text-4xl font-bold mb-4">The Tools That End Homeschool Burnout</h2>
            <p className="text-xl text-gray-300">Everything you need to teach with confidence, save time, and see real results</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <Brain className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Your Personal Teaching Assistant</h3>
              <p className="text-gray-300">Luna AI answers every "How do I explain this?" moment. Get instant teaching strategies, explanations, and support - like having a master teacher on call 24/7.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <TrendingUp className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Know Exactly Where Each Child Stands</h3>
              <p className="text-gray-300">Assessments that adapt to each child's level and give you clear insights into what they've mastered. No more guessing if they're ready to move on.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Zap className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Turn Any Idea Into a Full Curriculum</h3>
              <p className="text-gray-300">Upload a document or describe what you want to teach. AI creates complete lessons, activities, and assessments in minutes. No more spending weekends planning.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#6B5DE5]/50 transition-colors">
              <BookOpen className="w-12 h-12 text-[#6B5DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">All Your Resources in One Place</h3>
              <p className="text-gray-300">Upload textbooks, articles, videos - anything. AI organizes everything and creates lessons from your materials. No more hunting through scattered resources.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#E45DE5]/50 transition-colors">
              <Users className="w-12 h-12 text-[#E45DE5] mb-4" />
              <h3 className="text-xl font-bold mb-3">Finally Feel Supported, Not Alone</h3>
              <p className="text-gray-300">Track all your children's progress in one dashboard. Get guidance when you're stuck. Connect with other homeschool families. You're not doing this alone anymore.</p>
            </div>
            
            <div className="bg-black/50 rounded-2xl p-8 border border-gray-800 hover:border-[#FF835D]/50 transition-colors">
              <Shield className="w-12 h-12 text-[#FF835D] mb-4" />
              <h3 className="text-xl font-bold mb-3">Your Family's Data Stays Safe</h3>
              <p className="text-gray-300">Built with homeschool families in mind. Your children's information and learning data are protected with enterprise-level security. No selling data to advertisers.</p>
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
          <h2 className="text-4xl font-bold mb-4">Real Results from Real Homeschool Families</h2>
          <p className="text-xl text-gray-300 mb-16">See the transformation that happens when you stop struggling and start thriving</p>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">90%</div>
              <div className="text-gray-300">Less Time Planning</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">15hrs</div>
              <div className="text-gray-300">Saved Per Week</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">100%</div>
              <div className="text-gray-300">More Confident Parents</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent">$500+</div>
              <div className="text-gray-300">Saved on Curricula</div>
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
                <h2 className="text-4xl font-bold">Stop Reinventing the Wheel Every Week</h2>
                <p className="text-xl text-gray-300">
                  AI tools that handle the tedious work so you can focus on what matters - actually teaching your children.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Instant Assessment Creation</div>
                    <div className="text-gray-300 text-sm">Generate rubrics and assessments in seconds - no more spending hours creating tests</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#E45DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Professional Lesson Plans Instantly</div>
                    <div className="text-gray-300 text-sm">Turn any topic into detailed lesson plans with activities and objectives - done in minutes</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#FF835D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Perfect-Level Quizzes Every Time</div>
                    <div className="text-gray-300 text-sm">Quizzes that automatically match each child's ability level - no more too-easy or too-hard tests</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">One Lesson, Multiple Reading Levels</div>
                    <div className="text-gray-300 text-sm">Same content automatically adjusted for each child's reading level - teach multiple grades simultaneously</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="rounded-2xl shadow-2xl overflow-hidden">
                <Image
                  src="/teacher-dash.png"
                  alt="Teacher Dashboard - AI-powered homeschool management interface"
                  width={600}
                  height={400}
                  className="w-full h-auto object-cover"
                />
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
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            <div className="relative order-2 lg:order-1 lg:col-span-3">
              <div className="rounded-2xl shadow-2xl overflow-hidden max-w-none">
                <Image
                  src="/study space render.png"
                  alt="Student Study Space - AI-powered personalized learning interface"
                  width={2400}
                  height={1500}
                  className="w-full h-auto object-cover scale-105"
                />
              </div>
            </div>
            
            <div className="space-y-8 order-1 lg:order-2 lg:col-span-2">
              <div className="space-y-4">
                <h2 className="text-4xl font-bold">Your Kids Will Actually Love Learning</h2>
                <p className="text-xl text-gray-300">
                  No more battles over schoolwork. AI creates engaging experiences that adapt to how each child learns best, making education feel like discovery, not drudgery.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">No More "This is Too Hard" Meltdowns</div>
                    <div className="text-gray-300 text-sm">AI automatically adjusts difficulty so each child is challenged but never overwhelmed</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#E45DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Patient Tutor That Never Gets Frustrated</div>
                    <div className="text-gray-300 text-sm">AI explains concepts in different ways until each child understands - no judgment, just support</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#FF835D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Celebrate Every Win</div>
                    <div className="text-gray-300 text-sm">Immediate feedback and encouragement keeps kids motivated and shows exactly what they've mastered</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-[#6B5DE5] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">See Growth Happening Daily</div>
                    <div className="text-gray-300 text-sm">Clear progress tracking shows you and your child exactly how much they're learning and growing</div>
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
              Less Than Your Monthly Curriculum Budget
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Stop buying curricula that don't work. For less than you spend on textbooks, get personalized learning that adapts to every child in your family.
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
                  <p className="text-gray-400 mb-6">Perfect for homeschool families ready to transform their experience</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$40</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Covers your whole family (1 teacher account and up to 4 students)</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">$7/month for each additional user</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Everything you need - no hidden features or upgrades</span>
                  </li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white py-3 rounded-lg hover:opacity-90 transition-opacity">
                    Start Free Trial
                  </Button>
                </Link>
              </div>

              {/* Micro-Academies & Networks */}
              <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 flex flex-col">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-2">Homeschool Co-ops & Groups</h3>
                  <p className="text-gray-400 mb-6">Perfect for co-ops and learning communities</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">$5</span>
                    <span className="text-gray-400">/mo/user</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Only pay for families who actually use it</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Easy admin dashboard to manage your group</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm">Everything you need - no hidden features or upgrades</span>
                  </li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] text-white py-3 rounded-lg hover:opacity-90 transition-opacity">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>



          {/* FAQ Section */}
          <div className="border-t border-gray-800 pt-20 mt-20">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Questions from Homeschool Parents Like You</h3>
              <p className="text-gray-400">Real concerns from real families considering the switch</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">Will this really save me time, or is it just another thing to learn?</h4>
                  <p className="text-gray-400 text-sm">Most parents see immediate time savings within the first week. The AI does the heavy lifting - you just guide and teach. No complex setup required.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">What if my kids don't like it or it doesn't work for our family?</h4>
                  <p className="text-gray-400 text-sm">You can cancel anytime, no contracts. Most families see engagement improve within days because the AI adapts to each child's interests and learning style.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">I'm not tech-savvy. Will I be able to figure this out?</h4>
                  <p className="text-gray-400 text-sm">Absolutely! It's designed for busy parents, not tech experts. If you can use a smartphone, you can use this. Plus we provide step-by-step video guides.</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">Can this really handle high school subjects I'm not confident teaching?</h4>
                  <p className="text-gray-400 text-sm">Yes! The AI provides detailed explanations and teaching strategies for every subject, including advanced math and science. You'll feel confident teaching anything.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Will this replace the personal connection I have with my kids?</h4>
                  <p className="text-gray-400 text-sm">Never! AI handles the planning and prep so you can spend MORE quality time actually teaching and connecting with your children. You'll have deeper conversations about learning.</p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">What if I've already spent money on curricula this year?</h4>
                  <p className="text-gray-400 text-sm">You can upload your existing materials and AI will create lessons from them! Plus, you'll never need to buy another curriculum again. Most families save $500+ annually.</p>
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
                <h3 className="text-xl font-semibold">For Students</h3>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Discover how to navigate your personalized learning space, track your progress, and get the most out of AI-powered tutoring.
              </p>

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
          <div className="grid lg:grid-cols-3 gap-12 mb-12 text-center lg:text-left">
            {/* Logo and Description - Takes up more space */}
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <Image
                  src="/Horizontal white text.png"
                  alt="Learnology AI"
                  width={280}
                  height={56}
                  className="h-12 w-auto mx-auto lg:mx-0"
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
            <div className="space-y-8 flex flex-col items-center lg:items-start">
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
                <div className="flex space-x-4 justify-center lg:justify-start">
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
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-center md:justify-between items-center text-center md:text-left">
            <div className="text-sm text-gray-400">
              © 2025 Learnology AI. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center space-x-6 text-sm text-gray-400 mt-4 md:mt-0">
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
