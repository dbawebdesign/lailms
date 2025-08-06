/**
 * Logo Preloader Component
 * 
 * Preloads both light and dark logos to ensure smooth theme switching
 * Uses display: none to prevent rendering but ensures images are cached
 */

'use client'

import * as React from "react"
import Image from "next/image"

export const LogoPreloader: React.FC = () => {
  return (
    <div style={{ display: 'none' }} aria-hidden="true">
      {/* Preload both logo variants for smooth theme switching */}
      <Image
        src="/Horizontal white text.png"
        alt=""
        width={1}
        height={1}
        unoptimized={true}
        priority={false}
        loading="eager"
      />
      <Image
        src="/Horizontal black text.png"
        alt=""
        width={1}
        height={1}
        unoptimized={true}
        priority={false}
        loading="eager"
      />
    </div>
  )
}

LogoPreloader.displayName = "LogoPreloader"