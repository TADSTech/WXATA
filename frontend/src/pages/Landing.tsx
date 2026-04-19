import { motion } from 'framer-motion';
import { Chain, Mist } from '../components/Visuals';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center font-sans overflow-hidden">
      <Mist />
      
      <Chain x="5%" delay={0} />
      <Chain x="15%" delay={0.5} />
      <Chain x="85%" delay={0.2} />
      <Chain x="95%" delay={0.7} />

      <motion.div 
        className="z-10 text-center space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <motion.h1 
          className="text-8xl font-black tracking-tighter text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.5)] cursor-pointer"
          onClick={() => navigate('/dashboard')}
          animate={{ 
            textShadow: [
              "0 0 15px rgba(34,197,94,0.5)",
              "0 0 30px rgba(34,197,94,0.8)",
              "0 0 15px rgba(34,197,94,0.5)"
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          WXATA
        </motion.h1>
        
        <div className="space-y-2">
          <motion.p 
            className="text-2xl font-light tracking-[0.5em] uppercase text-gray-400"
            initial={{ letterSpacing: "0.2em", opacity: 0 }}
            animate={{ letterSpacing: "0.5em", opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.5 }}
          >
            Coming Soon
          </motion.p>
          <div className="h-1 w-24 bg-green-500 mx-auto rounded-full" />
        </div>

        <motion.div 
          className="pt-12 text-sm text-gray-500 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          [ BAILEYS_SYSTEM_INITIALIZING... ]
        </motion.div>
      </motion.div>

      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-50" />
    </div>
  );
};

export default Landing;
