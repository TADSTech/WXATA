import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';

export const Mist = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute bg-gray-500/10 blur-[100px] rounded-full"
          initial={{ 
            width: Math.random() * 400 + 200, 
            height: Math.random() * 400 + 200,
            x: Math.random() * 100 + '%',
            y: Math.random() * 100 + '%',
            opacity: 0.1
          }}
          animate={{
            x: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
            y: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: Math.random() * 20 + 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}
    </div>
  );
};

export const Chain = ({ delay = 0, x = "10%" }: { delay?: number, x?: string }) => {
  return (
    <motion.div 
      className="absolute top-0 bottom-0 flex flex-col items-center gap-1 opacity-20"
      style={{ left: x }}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        repeatType: "reverse", 
        ease: "easeInOut",
        delay 
      }}
    >
      {[...Array(20)].map((_, i) => (
        <Link2 key={i} className="text-green-500 w-8 h-8 rotate-90" />
      ))}
    </motion.div>
  );
};
