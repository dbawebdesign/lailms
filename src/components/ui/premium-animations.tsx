import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PremiumAnimationProps {
  children: React.ReactNode;
  type?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'shimmer' | 'glow' | 'typewriter';
  duration?: number;
  delay?: number;
  className?: string;
  isAIGenerated?: boolean;
}

// Shimmer effect for AI-generated content
const ShimmerWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    className={cn("relative overflow-hidden", className)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
  >
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/30 to-transparent"
      initial={{ x: '-100%' }}
      animate={{ x: '100%' }}
      transition={{
        duration: 1.5,
        ease: "easeInOut",
        repeat: 2,
      }}
    />
    {children}
  </motion.div>
);

// Glow effect for premium content
const GlowWrapper: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    className={cn("relative", className)}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
  >
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-blue-400/20 rounded-lg blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{
        duration: 2,
        ease: "easeInOut",
        repeat: 1,
      }}
    />
    <div className="relative z-10">
      {children}
    </div>
  </motion.div>
);

// Typewriter effect for text content
const TypewriterText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [displayText, setDisplayText] = React.useState('');
  
  React.useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, 30);
    
    return () => clearInterval(timer);
  }, [text]);
  
  return (
    <motion.div
      className={cn("", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayText}
      <motion.span
        className="inline-block w-0.5 h-4 bg-blue-500 ml-1"
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
      />
    </motion.div>
  );
};

export const PremiumAnimation: React.FC<PremiumAnimationProps> = ({
  children,
  type = 'fadeIn',
  duration = 0.5,
  delay = 0,
  className,
  isAIGenerated = false,
}) => {
  const baseVariants = {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slideUp: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
    },
    scaleIn: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 },
    },
  };

  // Special handling for AI-generated content
  if (isAIGenerated) {
    switch (type) {
      case 'shimmer':
        return (
          <ShimmerWrapper className={className}>
            {children}
          </ShimmerWrapper>
        );
      case 'glow':
        return (
          <GlowWrapper className={className}>
            {children}
          </GlowWrapper>
        );
      case 'typewriter':
        if (typeof children === 'string') {
          return <TypewriterText text={children} className={className} />;
        }
        break;
    }
  }

  const variants = baseVariants[type as keyof typeof baseVariants] || baseVariants.fadeIn;

  return (
    <motion.div
      className={className}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
    >
      {children}
    </motion.div>
  );
};

// Stagger animation for lists
export const StaggeredList: React.FC<{
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
}> = ({ children, className, staggerDelay = 0.1 }) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="visible"
    variants={{
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
  >
    {children.map((child, index) => (
      <motion.div
        key={index}
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {child}
      </motion.div>
    ))}
  </motion.div>
);

// Success notification animation
export const SuccessNotification: React.FC<{
  message: string;
  isVisible: boolean;
  onClose: () => void;
}> = ({ message, isVisible, onClose }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg"
        initial={{ opacity: 0, x: 100, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 bg-white rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
          {message}
        </div>
        <motion.button
          className="absolute top-1 right-1 text-white/70 hover:text-white"
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          ×
        </motion.button>
      </motion.div>
    )}
  </AnimatePresence>
);

// Loading animation for AI operations
export const AILoadingAnimation: React.FC<{
  message?: string;
  className?: string;
}> = ({ message = "AI is working...", className }) => (
  <motion.div
    className={cn("flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200", className)}
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-blue-500 rounded-full"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
    <span className="text-blue-700 font-medium">{message}</span>
  </motion.div>
);

export default PremiumAnimation; 