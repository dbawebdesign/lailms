'use client'

import { useEffect } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AnimatedHero() {
  useEffect(() => {
    // Word by word animation
    function animateWords() {
      const words = document.querySelectorAll('.word')
      
      words.forEach(word => {
        const delay = parseInt(word.getAttribute('data-delay') || '0')
        
        setTimeout(() => {
          (word as HTMLElement).style.animation = 'word-appear 0.8s ease-out forwards'
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
        (gradient as HTMLElement).style.left = (mouseX - 192) + 'px'
        ;(gradient as HTMLElement).style.top = (mouseY - 192) + 'px'
        ;(gradient as HTMLElement).style.opacity = '1'
      }
    }

    const handleMouseLeave = () => {
      if (gradient) {
        (gradient as HTMLElement).style.opacity = '0'
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
    <>
      <section className="relative min-h-screen flex flex-col justify-center items-center px-8 py-12 md:px-16 md:py-20 overflow-hidden">
        {/* Grid Background */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(107,93,229,0.08)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Main grid lines */}
          <line x1="0" y1="20%" x2="100%" y2="20%" className="grid-line" style={{animationDelay: '0.5s'}} />
          <line x1="0" y1="80%" x2="100%" y2="80%" className="grid-line" style={{animationDelay: '1s'}} />
          <line x1="20%" y1="0" x2="20%" y2="100%" className="grid-line" style={{animationDelay: '1.5s'}} />
          <line x1="80%" y1="0" x2="80%" y2="100%" className="grid-line" style={{animationDelay: '2s'}} />
          
          {/* Accent lines */}
          <line x1="50%" y1="0" x2="50%" y2="100%" className="grid-line opacity-5" style={{animationDelay: '2.5s'}} />
          <line x1="0" y1="50%" x2="100%" y2="50%" className="grid-line opacity-5" style={{animationDelay: '3s'}} />
          
          {/* Detail dots */}
          <circle cx="20%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3s'}} />
          <circle cx="80%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3.2s'}} />
          <circle cx="20%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.4s'}} />
          <circle cx="80%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.6s'}} />
          <circle cx="50%" cy="50%" r="1.5" className="detail-dot" style={{animationDelay: '4s'}} />
        </svg>

        {/* Corner Elements */}
        <div className="corner-element top-8 left-8" style={{animationDelay: '4s'}}>
          <div className="absolute top-0 left-0 w-2 h-2 bg-[#6B5DE5] opacity-30"></div>
        </div>
        <div className="corner-element top-8 right-8" style={{animationDelay: '4.2s'}}>
          <div className="absolute top-0 right-0 w-2 h-2 bg-[#E45DE5] opacity-30"></div>
        </div>
        <div className="corner-element bottom-8 left-8" style={{animationDelay: '4.4s'}}>
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#FF835D] opacity-30"></div>
        </div>
        <div className="corner-element bottom-8 right-8" style={{animationDelay: '4.6s'}}>
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#6B5DE5] opacity-30"></div>
        </div>

        {/* Floating Elements */}
        <div className="floating-element floating-element-1" style={{animationDelay: '5s'}}></div>
        <div className="floating-element floating-element-2" style={{animationDelay: '5.5s'}}></div>
        <div className="floating-element floating-element-3" style={{animationDelay: '6s'}}></div>
        <div className="floating-element floating-element-4" style={{animationDelay: '6.5s'}}></div>

        {/* Top Text */}
        <div className="text-center mb-16">
          <h2 className="text-xs md:text-sm font-mono font-light text-gray-400 uppercase tracking-[0.2em] opacity-80">
            <span className="word" data-delay="0">Transform</span>
            <span className="word" data-delay="200">education</span>
            <span className="word" data-delay="400">with</span>
            <span className="word" data-delay="600">intelligence.</span>
          </h2>
          <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-[#6B5DE5] to-transparent opacity-30"></div>
        </div>

        {/* Center Text */}
        <div className="text-center max-w-6xl mx-auto mb-16 relative">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extralight leading-tight tracking-tight text-white text-decoration">
            <div className="mb-4 md:mb-6">
              <span className="word" data-delay="800">The</span>
              <span className="word" data-delay="950">world's</span>
              <span className="word" data-delay="1100">first</span>
              <span className="word bg-gradient-to-r from-[#FF835D] via-[#E45DE5] to-[#6B5DE5] bg-clip-text text-transparent" data-delay="1250"> AI-first </span>
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
            Start Building Today
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Link href="https://calendly.com/zjones-learnologyai/learnology-ai-demo?month=2025-07" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="border-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center opacity-0" style={{animation: 'word-appear 1s ease-out forwards', animationDelay: '4.4s'}}>
              <Play className="mr-2 h-4 w-4" />
              Watch Demo
            </Button>
          </Link>
        </div>

        {/* Bottom Text */}
        <div className="text-center">
          <div className="mb-4 w-16 h-px bg-gradient-to-r from-transparent via-[#FF835D] to-transparent opacity-30"></div>
          <h2 className="text-xs md:text-sm font-mono font-light text-gray-400 uppercase tracking-[0.2em] opacity-80">
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
    </>
  )
} 