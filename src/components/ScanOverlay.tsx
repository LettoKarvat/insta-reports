import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

interface ScanOverlayProps {
  isActive: boolean;
}

export default function ScanOverlay({ isActive }: ScanOverlayProps) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0">
        <div className="grid grid-cols-12 grid-rows-12 h-full w-full">
          {Array.from({ length: 144 }).map((_, i) => (
            <motion.div
              key={i}
              className="border-blue-400/20 border-[0.5px]"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: isActive ? [0, 0.3, 0] : 0,
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                delay: (i % 12) * 0.1 + Math.floor(i / 12) * 0.05
              }}
            />
          ))}
        </div>
      </div>

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
        initial={{ top: '0%' }}
        animate={isActive ? {
          top: ['0%', '100%'],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear'
        }}
      />

      {/* Center shield icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={isActive ? {
            scale: [0.8, 1.1, 1],
            opacity: [0, 1, 0.8],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <Shield className="w-16 h-16 text-blue-400" />
        </motion.div>
      </div>

      {/* Corner brackets */}
      <div className="absolute top-16 left-16 w-8 h-8">
        <motion.div
          className="w-full border-t-2 border-l-2 border-blue-400"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isActive ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        />
      </div>
      <div className="absolute top-16 right-16 w-8 h-8">
        <motion.div
          className="w-full border-t-2 border-r-2 border-blue-400"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isActive ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
      </div>
      <div className="absolute bottom-16 left-16 w-8 h-8">
        <motion.div
          className="w-full border-b-2 border-l-2 border-blue-400"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isActive ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
        />
      </div>
      <div className="absolute bottom-16 right-16 w-8 h-8">
        <motion.div
          className="w-full border-b-2 border-r-2 border-blue-400"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={isActive ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        />
      </div>
    </motion.div>
  );
}