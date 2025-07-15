'use client'

import { useEffect } from 'react'

interface AnimatedGridBackgroundProps {
  opacity?: number
  strokeOpacity?: number
  className?: string
  showFloatingElements?: boolean
  showCornerElements?: boolean
  showDetailDots?: boolean
  patternId?: string
}

export default function AnimatedGridBackground({
  opacity = 0.08,
  strokeOpacity = 0.25,
  className = '',
  showFloatingElements = true,
  showCornerElements = true,
  showDetailDots = true,
  patternId = 'grid'
}: AnimatedGridBackgroundProps) {
  useEffect(() => {
    // Initialize floating elements animation with a slight delay to ensure DOM is ready
    const initializeAnimations = () => {
      const floatingElements = document.querySelectorAll('.floating-element')
      floatingElements.forEach((element, index) => {
        const delay = 5 + (index * 0.5)
        ;(element as HTMLElement).style.animationDelay = `${delay}s`
        ;(element as HTMLElement).style.animation = `word-appear 1s ease-out forwards, float 4s ease-in-out infinite`
      })

      const cornerElements = document.querySelectorAll('.corner-element')
      cornerElements.forEach((element, index) => {
        const delay = 4 + (index * 0.2)
        ;(element as HTMLElement).style.animationDelay = `${delay}s`
      })
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(initializeAnimations, 100)
    
    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      {/* Grid Background */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={patternId} width="60" height="60" patternUnits="userSpaceOnUse">
            <path 
              d="M 60 0 L 0 0 0 60" 
              fill="none" 
              stroke={`rgba(107,93,229,${opacity})`} 
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        
        {/* Main grid lines */}
        <line x1="0" y1="20%" x2="100%" y2="20%" className="grid-line" style={{animationDelay: '0.5s'}} />
        <line x1="0" y1="80%" x2="100%" y2="80%" className="grid-line" style={{animationDelay: '1s'}} />
        <line x1="20%" y1="0" x2="20%" y2="100%" className="grid-line" style={{animationDelay: '1.5s'}} />
        <line x1="80%" y1="0" x2="80%" y2="100%" className="grid-line" style={{animationDelay: '2s'}} />
        
        {/* Accent lines */}
        <line x1="50%" y1="0" x2="50%" y2="100%" className="grid-line opacity-10" style={{animationDelay: '2.5s'}} />
        <line x1="0" y1="50%" x2="100%" y2="50%" className="grid-line opacity-10" style={{animationDelay: '3s'}} />
        
        {/* Detail dots */}
        {showDetailDots && (
          <>
            <circle cx="20%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3s'}} />
            <circle cx="80%" cy="20%" r="2" className="detail-dot" style={{animationDelay: '3.2s'}} />
            <circle cx="20%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.4s'}} />
            <circle cx="80%" cy="80%" r="2" className="detail-dot" style={{animationDelay: '3.6s'}} />
            <circle cx="50%" cy="50%" r="1.5" className="detail-dot" style={{animationDelay: '4s'}} />
          </>
        )}
      </svg>

      {/* Corner Elements */}
      {showCornerElements && (
        <>
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
        </>
      )}

      {/* Floating Elements */}
      {showFloatingElements && (
        <>
          <div className="floating-element floating-element-1" style={{animationDelay: '5s'}}></div>
          <div className="floating-element floating-element-2" style={{animationDelay: '5.5s'}}></div>
          <div className="floating-element floating-element-3" style={{animationDelay: '6s'}}></div>
          <div className="floating-element floating-element-4" style={{animationDelay: '6.5s'}}></div>
        </>
      )}
    </div>
  )
} 