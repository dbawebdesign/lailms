/**
 * Color Contrast Analyzer for LearnologyAI
 * 
 * Analyzes all color combinations in our design system to ensure
 * WCAG 2.1 AA compliance (4.5:1 for normal text, 3:1 for large text)
 */

// Color values from globals.css
const colors = {
  light: {
    background: '#FFFFFF',
    foreground: '#1A1A1A',
    'text-primary': '#1A1A1A',
    'text-secondary': '#4A4A4A',
    surface: '#F7F7F7',
    divider: '#E0E0E0',
    card: '#F7F7F7',
    'card-foreground': '#1A1A1A',
    primary: '#6B5DE5',
    'primary-foreground': '#FFFFFF',
    secondary: '#F7F7F7',
    'secondary-foreground': '#1A1A1A',
    muted: '#F7F7F7',
    'muted-foreground': '#4A4A4A',
    accent: '#E45DE5',
    'accent-foreground': '#FFFFFF',
    destructive: '#DC2626',
    'destructive-foreground': '#FFFFFF',
    border: '#E0E0E0',
    success: '#10B981',
    'success-foreground': '#FFFFFF',
    warning: '#F59E0B',
    'warning-foreground': '#FFFFFF',
    info: '#3B82F6',
    'info-foreground': '#FFFFFF',
  },
  dark: {
    background: '#121212',
    foreground: '#EDEDED',
    'text-primary': '#EDEDED',
    'text-secondary': '#A0A0A0',
    surface: '#1E1E1E',
    divider: '#333333',
    card: '#1E1E1E',
    'card-foreground': '#EDEDED',
    primary: '#6B5DE5',
    'primary-foreground': '#FFFFFF',
    secondary: '#1E1E1E',
    'secondary-foreground': '#EDEDED',
    muted: '#1E1E1E',
    'muted-foreground': '#A0A0A0',
    accent: '#E45DE5',
    'accent-foreground': '#FFFFFF',
    destructive: '#EF4444',
    'destructive-foreground': '#FFFFFF',
    border: '#333333',
    success: '#10B981',
    'success-foreground': '#FFFFFF',
    warning: '#F59E0B',
    'warning-foreground': '#000000',
    info: '#3B82F6',
    'info-foreground': '#FFFFFF',
  }
}

// Convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

// Calculate relative luminance
function getLuminance(rgb) {
  const { r, g, b } = rgb
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Calculate contrast ratio
function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return 0
  
  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)
  
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

// Check WCAG compliance
function checkWCAGCompliance(ratio) {
  return {
    AANormal: ratio >= 4.5,    // WCAG AA for normal text
    AALarge: ratio >= 3.0,     // WCAG AA for large text
    AAANormal: ratio >= 7.0,   // WCAG AAA for normal text
    AAALarge: ratio >= 4.5     // WCAG AAA for large text
  }
}

// Common color combinations to test
const colorCombinations = [
  // Text on backgrounds
  { fg: 'foreground', bg: 'background', context: 'Main text on background' },
  { fg: 'text-primary', bg: 'background', context: 'Primary text on background' },
  { fg: 'text-secondary', bg: 'background', context: 'Secondary text on background' },
  { fg: 'muted-foreground', bg: 'background', context: 'Muted text on background' },
  
  // Card content
  { fg: 'card-foreground', bg: 'card', context: 'Card text on card background' },
  { fg: 'muted-foreground', bg: 'card', context: 'Muted text on card' },
  
  // Buttons
  { fg: 'primary-foreground', bg: 'primary', context: 'Primary button text' },
  { fg: 'secondary-foreground', bg: 'secondary', context: 'Secondary button text' },
  { fg: 'accent-foreground', bg: 'accent', context: 'Accent button text' },
  { fg: 'destructive-foreground', bg: 'destructive', context: 'Destructive button text' },
  
  // Status colors
  { fg: 'success-foreground', bg: 'success', context: 'Success message text' },
  { fg: 'warning-foreground', bg: 'warning', context: 'Warning message text' },
  { fg: 'info-foreground', bg: 'info', context: 'Info message text' },
  
  // Surface content
  { fg: 'foreground', bg: 'surface', context: 'Text on surface' },
  { fg: 'muted-foreground', bg: 'surface', context: 'Muted text on surface' },
  
  // Border visibility
  { fg: 'border', bg: 'background', context: 'Border on background (visibility)' },
  { fg: 'border', bg: 'card', context: 'Border on card (visibility)' },
]

// Analyze color combinations
function analyzeColorContrast() {
  console.log('🎨 Color Contrast Analysis for LearnologyAI\n')
  console.log('=' .repeat(80))
  
  const results = {
    light: { passed: 0, failed: 0, details: [] },
    dark: { passed: 0, failed: 0, details: [] }
  }
  
  Object.entries(colors).forEach(([theme, themeColors]) => {
    console.log(`\n📋 ${theme.toUpperCase()} THEME ANALYSIS`)
    console.log('-'.repeat(50))
    
    colorCombinations.forEach(({ fg, bg, context }) => {
      const fgColor = themeColors[fg]
      const bgColor = themeColors[bg]
      
      if (!fgColor || !bgColor) {
        console.log(`⚠️  Missing color: ${fg} or ${bg}`)
        return
      }
      
      const ratio = getContrastRatio(fgColor, bgColor)
      const compliance = checkWCAGCompliance(ratio)
      
      const status = compliance.AANormal ? '✅' : '❌'
      const aaStatus = compliance.AANormal ? 'PASS' : 'FAIL'
      const aaaStatus = compliance.AAANormal ? 'AAA' : 'AA'
      
      console.log(`${status} ${context}`)
      console.log(`   ${fgColor} on ${bgColor}`)
      console.log(`   Ratio: ${ratio.toFixed(2)}:1 | ${aaStatus} (${aaaStatus})`)
      
      if (compliance.AANormal) {
        results[theme].passed++
      } else {
        results[theme].failed++
        results[theme].details.push({
          context,
          fg: fgColor,
          bg: bgColor,
          ratio: ratio.toFixed(2),
          required: '4.5:1'
        })
      }
      
      console.log('')
    })
  })
  
  // Summary
  console.log('\n📊 SUMMARY')
  console.log('=' .repeat(80))
  
  Object.entries(results).forEach(([theme, result]) => {
    const total = result.passed + result.failed
    const percentage = total > 0 ? ((result.passed / total) * 100).toFixed(1) : 0
    
    console.log(`\n${theme.toUpperCase()} Theme:`)
    console.log(`✅ Passed: ${result.passed}/${total} (${percentage}%)`)
    console.log(`❌ Failed: ${result.failed}/${total}`)
    
    if (result.failed > 0) {
      console.log(`\nFailed combinations in ${theme} theme:`)
      result.details.forEach(({ context, fg, bg, ratio, required }) => {
        console.log(`  • ${context}: ${ratio}:1 (needs ${required})`)
        console.log(`    ${fg} on ${bg}`)
      })
    }
  })
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS')
  console.log('=' .repeat(80))
  
  const allFailed = [...results.light.details, ...results.dark.details]
  if (allFailed.length === 0) {
    console.log('🎉 All color combinations meet WCAG AA standards!')
  } else {
    console.log('The following improvements are recommended:')
    
    // Group by context to avoid duplicates
    const uniqueFailures = allFailed.reduce((acc, failure) => {
      if (!acc[failure.context]) {
        acc[failure.context] = failure
      }
      return acc
    }, {})
    
    Object.values(uniqueFailures).forEach(({ context, ratio, required }) => {
      console.log(`\n• ${context}`)
      console.log(`  Current: ${ratio}:1 | Required: ${required}`)
      
      if (context.includes('Muted text')) {
        console.log(`  💡 Consider darkening muted text color or using it only for non-essential content`)
      } else if (context.includes('Border')) {
        console.log(`  💡 Consider darkening border color or adding shadow for better visibility`)
      } else if (context.includes('Warning')) {
        console.log(`  💡 Consider using dark text on warning background instead of white text`)
      } else {
        console.log(`  💡 Increase color contrast by adjusting foreground or background color`)
      }
    })
  }
  
  console.log('\n🔍 For detailed color contrast checking, visit:')
  console.log('https://webaim.org/resources/contrastchecker/')
  
  return results
}

// Run analysis
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyzeColorContrast, getContrastRatio, checkWCAGCompliance }
} else {
  analyzeColorContrast()
} 