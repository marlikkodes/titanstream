import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MACHINE_CATALOG } from '../../data/machines';
import { 
  Cpu, 
  Server, 
  Database, 
  Zap, 
  ShieldCheck, 
  Globe, 
  ArrowRight, 
  CheckCircle2,
  TrendingUp,
  Clock,
  Lock,
  Sparkles,
  ServerIcon,
  HardDrive,
  Network,
  Activity,
  DollarSign,
  Flame,
  Award,
  ChevronRight
} from 'lucide-react';

export const CloudServices: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'investor' | 'startup'>('investor');
  const [isScrolled, setIsScrolled] = useState(false);
  const [modalContent, setModalContent] = useState<string | null>(null);

  const handleJoinTitanStream = () => {
    // Keep the public landing page at `/`; `/start` is the explicit
    // pre-auth onboarding entrypoint before authentication begins.
    window.location.href = '/start';
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:info@titanstream.us';
  };



  const services = {
    investor: {
      title: 'For Investors',
      subtitle: 'Turn your capital into daily passive income with GPU compute',
      icon: <Cpu className="w-8 h-8" />,
      color: 'from-usdt-green to-emerald-400',
      description: 'Invest in high-performance GPU compute infrastructure that generates daily returns 24/7. Your money works for you automatically with real-time tracking and instant withdrawals.',
      features: [
        { icon: <Zap className="w-5 h-5" />, text: 'Daily Passive Income', detail: 'Earn money every single day without lifting a finger' },
        { icon: <TrendingUp className="w-5 h-5" />, text: 'Unlimited Scaling', detail: 'Invest more to exponentially increase your daily earnings' },
        { icon: <Clock className="w-5 h-5" />, text: 'Zero Waiting Time', detail: 'Your investment starts generating yield the moment you buy' },
        { icon: <ShieldCheck className="w-5 h-5" />, text: 'Capital Protected', detail: 'Your investment is secured by tangible GPU hardware assets' },
        { icon: <Activity className="w-5 h-5" />, text: 'Live Earnings Dashboard', detail: 'Watch your money grow in real-time with transparent tracking' },
        { icon: <Network className="w-5 h-5" />, text: 'Instant Cash Out', detail: 'Withdraw your earnings anytime to crypto or mobile wallets' }
      ],
      useCases: [
        { title: 'Build Wealth While You Sleep', description: 'Your GPUs work 24/7 generating income automatically' },
        { title: 'Compound Your Returns', description: 'Reinvest daily earnings to exponentially grow your portfolio' },
        { title: 'Start Small Scale Big', description: 'Begin with as little as $10 and grow into thousands' },
        { title: 'Never Miss a Payment', description: 'Daily payouts ensure consistent cash flow every single day' }
      ],
      pricing: MACHINE_CATALOG.filter(m => m.tierCode !== 'TS_TRIAL').map(machine => {
        const buttonTextMap: Record<string, string> = {
          'TS_C10': 'Get Started',
          'TS_A50': 'Upgrade Now',
          'TS_P250': 'Start Making Money',
          'TS_X1000': 'Scale Up',
          'TS_Q2500': 'Go Premium',
          'TS_X5000': 'Maximize Returns'
        };
        return {
          name: machine.name,
          specs: `${machine.capacityGhs} GH/s Capacity`,
          price: `$${machine.priceUsdt.toFixed(2)} USDT`,
          dailyYield: `$${machine.dailyYieldUsdt.toFixed(2)}/day`,
          roi: `${((machine.dailyYieldUsdt * 365 / machine.priceUsdt) * 100).toFixed(0)}% Annual ROI`,
          features: [
            `${machine.capacityGhs} GH/s Processing Power`,
            `$${machine.dailyYieldUsdt.toFixed(2)} Daily Yield`,
            `${machine.powerRatingW}W Power Rating`,
            machine.performanceLevel
          ],
          popular: machine.isPopular,
          buttonText: buttonTextMap[machine.tierCode] || 'Invest Now'
        };
      })
    },
    startup: {
      title: 'For Startups',
      subtitle: 'Flexible GPU commitments from 1 week to 1 year',
      icon: <Server className="w-8 h-8" />,
      color: 'from-blue-500 to-cyan-500',
      description: 'Access powerful GPU infrastructure with flexible commitment periods. Choose from 1 week to 1 year plans with savings up to 34% on longer commitments.',
      features: [
        { icon: <Globe className="w-5 h-5" />, text: '90% Cost Savings', detail: 'Fraction of the cost of buying hardware' },
        { icon: <ServerIcon className="w-5 h-5" />, text: 'Flexible Commitments', detail: 'Choose from 1 week to 1 year plans' },
        { icon: <Lock className="w-5 h-5" />, text: 'Enterprise GPUs', detail: 'Access NVIDIA A100 and H100 without buying them' },
        { icon: <Sparkles className="w-5 h-5" />, text: 'Lock In Low Rates', detail: 'Save up to 34% with longer commitments' },
        { icon: <Activity className="w-5 h-5" />, text: 'Predictable Costs', detail: 'Fixed hourly rates for your commitment period' },
        { icon: <Award className="w-5 h-5" />, text: 'Startup Friendly', detail: 'As low as 1 week minimum commitment' }
      ],
      useCases: [
        { title: 'AI/ML Training Sprints', description: 'Short term GPU access for model training projects' },
        { title: 'Render Farm Projects', description: 'Dedicated GPU capacity for video production timelines' },
        { title: 'Research Experiments', description: 'Flexible compute for scientific research with known duration' },
        { title: 'Startup Prototyping', description: 'Test products with guaranteed GPU availability' }
      ],
      pricing: [
        { name: '1 Week Commitment', specs: '1x NVIDIA A100 (40GB)', price: '$0.89/hr', totalCost: '$149.52', features: ['40GB VRAM', '2 vCPU', '15GB RAM', '100GB SSD', '1 week minimum'], popular: false },
        { name: '1 Month Commitment', specs: '2x NVIDIA A100 (80GB)', price: '$0.79/hr', totalCost: '$569.76', features: ['80GB VRAM', '4 vCPU', '30GB RAM', '200GB SSD', 'NVLink', 'Save 11%'], popular: true },
        { name: '1 Year Commitment', specs: '4x NVIDIA H100 (320GB)', price: '$0.59/hr', totalCost: '$5,168.40', features: ['320GB VRAM', '16 vCPU', '120GB RAM', '1TB NVMe', 'InfiniBand', 'Save 34%'] }
      ]
    }
  };

  const currentService = services[activeTab];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#090b10] text-text-primary">
      {/* User Type Switch */}
      <AnimatePresence>
        {!isScrolled && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-2 sm:top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] sm:w-auto"
          >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex bg-[#121620]/80 backdrop-blur-xl border border-white/10 rounded-full p-1 relative overflow-hidden shadow-2xl mx-auto"
        >
          {/* Animated Background Glow */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: activeTab === 'investor' 
              ? 'radial-gradient(circle at 50% 50%, rgba(38, 161, 123, 0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.2) 0%, transparent 70%)'
            }}
            transition={{ duration: 0.3 }}
          />
          
          <motion.span 
            animate={{ 
              opacity: isScrolled ? 0 : 1,
              width: isScrolled ? 0 : 'auto',
              padding: isScrolled ? 0 : '0 6px sm:px-3'
            }}
            transition={{ duration: 0.3 }}
            className="text-text-tertiary text-xs sm:text-sm font-medium flex items-center hidden sm:flex"
          >
            I am a:
          </motion.span>
          
          <motion.button
            onClick={() => setActiveTab('investor')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative px-3 sm:px-4 py-2 sm:py-2 rounded-full font-semibold transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
              activeTab === 'investor'
                ? 'bg-gradient-to-r from-usdt-green to-emerald-400 text-white shadow-lg shadow-usdt-green/20'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <motion.div
              animate={activeTab === 'investor' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Cpu className="w-3 h-3 sm:w-4 sm:h-4" />
            </motion.div>
            <motion.span
              animate={{ opacity: isScrolled ? 1 : 1 }}
            >
              Investor
            </motion.span>
          </motion.button>
          
          <motion.button
            onClick={() => setActiveTab('startup')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative px-3 sm:px-4 py-2 sm:py-2 rounded-full font-semibold transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
              activeTab === 'startup'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20'
                : 'text-text-secondary hover:text-white'
            }`}
          >
            <motion.div
              animate={activeTab === 'startup' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Server className="w-3 h-3 sm:w-4 sm:h-4" />
            </motion.div>
            <motion.span
              animate={{ opacity: isScrolled ? 1 : 1 }}
            >
              Startup
            </motion.span>
          </motion.button>
        </motion.div>
      </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Tech Grid Background with Sketch Feel */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(38, 161, 123, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(38, 161, 123, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px'
          }} />
        </div>
        
        {/* Animated Circuit Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
          <motion.path
            d="M 0 100 Q 200 50 400 100 T 800 100"
            stroke="rgba(38, 161, 123, 0.5)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 0 300 Q 300 250 600 300 T 1200 300"
            stroke="rgba(38, 161, 123, 0.4)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
          />
          <motion.path
            d="M 100 0 Q 150 200 100 400"
            stroke="rgba(38, 161, 123, 0.3)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear", delay: 2 }}
          />
        </svg>
        
        {/* Animated Background Glows */}
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 left-1/4 w-96 h-96 bg-usdt-green/10 rounded-full blur-3xl pointer-events-none" 
        />
        <motion.div 
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" 
        />
        
        {/* Animated Drawing Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.line
              key={i}
              x1={`${10 + i * 12}%`}
              y1="0"
              x2={`${10 + i * 12}%`}
              y2="100%"
              stroke="rgba(38, 161, 123, 0.4)"
              strokeWidth="0.5"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 3 + i * 0.3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
            />
          ))}
        </svg>
        
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-usdt-green/30 rounded-full"
              initial={{
                x: Math.random() * 100 + '%',
                y: Math.random() * 100 + '%',
                opacity: 0
              }}
              animate={{
                y: [null, '-100%'],
                opacity: [0, 0.5, 0]
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 5
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* 3D Animated Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex justify-center mb-8"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotateX: [0, 5, 0],
                  rotateY: [0, -5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative"
                style={{ perspective: "1000px" }}
              >
                <div className="relative w-16 h-16 sm:w-24 sm:h-24">
                  {/* 3D Sphere Effect */}
                  <motion.div
                    animate={{
                      scale: [1, 1.05, 1],
                      boxShadow: [
                        "0 0 60px rgba(0,230,118,0.5),0 20px 40px rgba(0,0,0,0.3)",
                        "0 0 80px rgba(0,230,118,0.7),0 25px 50px rgba(0,0,0,0.4)",
                        "0 0 60px rgba(0,230,118,0.5),0 20px 40px rgba(0,0,0,0.3)"
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-usdt-green via-[#00c853] to-app-bg 
                          border-2 border-white/20 flex items-center justify-center text-app-bg 
                          font-extrabold text-3xl sm:text-5xl"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    ₮
                  </motion.div>
                  
                  {/* Floating Glow */}
                  <motion.div
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.2, 0.5, 0.2],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-usdt-green/30 blur-3xl"
                  />
                  
                  {/* Pulsing Ring */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-usdt-green/30"
                  />
                  
                  {/* Floating Particles */}
                  {[...Array(4)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1.5 h-1.5 bg-usdt-green/60 rounded-full"
                      animate={{
                        y: [0, -20, 0],
                        x: [0, (i % 2 === 0 ? 10 : -10), 0],
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{
                        duration: 3 + i * 0.5,
                        repeat: Infinity,
                        delay: i * 0.4,
                        ease: "easeInOut"
                      }}
                      style={{
                        left: `${20 + i * 20}%`,
                        top: `${20 + (i % 2) * 30}%`
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-usdt-green/10 border border-usdt-green/30 rounded-full text-usdt-green text-sm font-bold mb-6"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              <span>Daily Passive Income Machine</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4"
            >
              {activeTab === 'investor' ? (
                <span className="text-gradient-neon">Make Money While You Sleep</span>
              ) : (
                <span className="text-gradient-neon">Access Affordable GPUs</span>
              )}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-base sm:text-lg md:text-xl text-text-primary max-w-3xl mx-auto mb-6 sm:mb-8"
            >
              {activeTab === 'investor' ? (
                'Transform your capital into a daily income stream. Your GPUs work 24/7 to generate returns while you sleep.'
              ) : (
                'Access powerful GPU infrastructure with flexible commitments. Choose from 1 week to 1 year plans and save up to 34%.'
              )}
            </motion.p>
            
            {/* Animated Underline */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
              className="h-0.5 bg-gradient-to-r from-usdt-green to-transparent max-w-3xl mx-auto mb-8"
            />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={activeTab === 'investor' ? handleJoinTitanStream : handleContactSales}
                className={`px-6 sm:px-8 py-3 sm:py-4 text-white font-extrabold rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                  activeTab === 'investor'
                    ? 'bg-gradient-to-r from-usdt-green to-emerald-400 shadow-usdt-green/20'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-500/20'
                }`}
              >
                <span>{activeTab === 'investor' ? 'Start Earning Now' : 'Access GPUs'}</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.div>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleContactSales}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                Contact Sales
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Infrastructure Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
        {/* Sketch Lines Background */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.line
              key={i}
              x1="0"
              y1={`${20 + i * 15}%`}
              x2="100%"
              y2={`${20 + i * 15}%`}
              stroke="rgba(38, 161, 123, 0.5)"
              strokeWidth="0.5"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
            />
          ))}
        </svg>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="web3-card rounded-3xl p-4 sm:p-6 md:p-8 mb-8 sm:mb-12 relative"
        >
          <div className="flex items-center gap-3 mb-6">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-usdt-green to-emerald-600 flex items-center justify-center"
            >
              <Server className="w-6 h-6 text-app-bg" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-white">Global Infrastructure Network</h2>
              <p className="text-text-secondary text-sm">Enterprise-grade GPU services across 50+ data centers worldwide</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { name: 'GPU Clusters', spec: 'H100/A100' },
              { name: 'Cloud VMs', spec: 'Auto scaling' },
              { name: 'Data Centers', spec: 'Tier 4' },
              { name: 'Network', spec: '10Gbps+' },
              { name: 'Storage', spec: 'Petabyte' },
              { name: 'Security', spec: 'Enterprise' }
            ].map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-[#1a202c] border border-white/10 rounded-xl p-4 text-center cursor-pointer"
              >
                <motion.div 
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  className="flex justify-center mb-2"
                >
                  <Zap className="w-8 h-8 text-usdt-green" />
                </motion.div>
                <div className="text-xs font-bold text-white mb-1">{service.name}</div>
                <div className="text-[10px] text-text-secondary">{service.spec}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Active Service Canvas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`relative overflow-hidden rounded-3xl border p-4 sm:p-6 md:p-8 ${
            activeTab === 'investor'
              ? 'border-usdt-green/30 bg-gradient-to-br from-usdt-green/20 to-emerald-600/20'
              : 'border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-cyan-900/20'
          }`}
        >
          {/* Animated Background */}
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full">
              {activeTab === 'investor' ? (
                <>
                  <motion.circle
                    cx="20%"
                    cy="30%"
                    r="100"
                    fill="rgba(38, 161, 123, 0.3)"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <motion.circle
                    cx="80%"
                    cy="70%"
                    r="80"
                    fill="rgba(16, 185, 129, 0.3)"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                  />
                </>
              ) : (
                <>
                  <motion.circle
                    cx="80%"
                    cy="30%"
                    r="100"
                    fill="rgba(59, 130, 246, 0.3)"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <motion.circle
                    cx="20%"
                    cy="70%"
                    r="80"
                    fill="rgba(6, 182, 212, 0.3)"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                  />
                </>
              )}
            </svg>
          </div>

          <div className="relative z-10">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className={`w-16 h-16 mb-6 rounded-2xl flex items-center justify-center ${
                activeTab === 'investor'
                  ? 'bg-gradient-to-r from-usdt-green to-emerald-400'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}
            >
              {currentService.icon}
            </motion.div>

            <h3 className="text-2xl font-bold text-white mb-2">{currentService.title}</h3>
            <p className="text-text-primary mb-6">{currentService.subtitle}</p>

            <div className="space-y-4 mb-6">
              {currentService.features.slice(0, 3).map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1">{feature.icon}</div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{feature.text}</h4>
                    <p className="text-text-tertiary text-xs">{feature.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={activeTab === 'investor' ? handleJoinTitanStream : handleContactSales}
              className={`w-full py-3 text-white font-bold rounded-xl ${
                activeTab === 'investor'
                  ? 'bg-gradient-to-r from-usdt-green to-emerald-400'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}
            >
              {activeTab === 'investor' ? 'Start Investing' : 'Get Started'}
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Service Details */}
      <div id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative">
        {/* Circuit Pattern Background */}
        <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
          <motion.rect
            x="10%"
            y="10%"
            width="80%"
            height="80%"
            stroke="rgba(38, 161, 123, 0.3)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.rect
            x="15%"
            y="15%"
            width="70%"
            height="70%"
            stroke="rgba(38, 161, 123, 0.2)"
            strokeWidth="0.5"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
          />
        </svg>
        
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-8 relative"
        >
          {/* Service Header */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block mb-4"
            >
              <div className={`p-4 rounded-2xl bg-gradient-to-br ${currentService.color} bg-opacity-20 text-white inline-block`}>
                {currentService.icon}
              </div>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{currentService.title}</h2>
            <p className="text-text-primary max-w-2xl mx-auto">{currentService.description}</p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative">
            {/* Sketch Lines */}
            <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
              {[...Array(4)].map((_, i) => (
                <motion.line
                  key={i}
                  x1="0"
                  y1={`${20 + i * 20}%`}
                  x2="100%"
                  y2={`${20 + i * 20}%`}
                  stroke="rgba(38, 161, 123, 0.5)"
                  strokeWidth="0.5"
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                />
              ))}
            </svg>
            
            {currentService.features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ scale: 1.03, y: -5 }}
                className="web3-card rounded-2xl p-6 hover:border-usdt-green/30 transition-all cursor-pointer"
              >
                <motion.div 
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className={`p-3 rounded-xl bg-gradient-to-br ${currentService.color} bg-opacity-20 text-white mb-4 w-fit`}
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.text}</h3>
                <p className="text-text-primary text-sm">{feature.detail}</p>
              </motion.div>
            ))}
          </div>

          {/* Use Cases */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="web3-card rounded-3xl p-4 sm:p-6 md:p-8 relative"
          >
            {/* Dotted Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
              {[...Array(15)].map((_, i) => (
                <motion.circle
                  key={i}
                  cx={`${10 + (i % 5) * 20}%`}
                  cy={`${10 + Math.floor(i / 5) * 25}%`}
                  r="1.5"
                  fill="rgba(38, 161, 123, 0.4)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                />
              ))}
            </svg>
            <motion.h3 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xl font-bold text-white mb-6 flex items-center gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-5 h-5 text-gold" />
              </motion.div>
              Use Cases
            </motion.h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {currentService.useCases.map((useCase, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  className="bg-[#1a202c] border border-white/10 rounded-xl p-5 hover:border-usdt-green/30 transition-all cursor-pointer"
                >
                  <h4 className="font-bold text-white mb-2">{useCase.title}</h4>
                  <p className="text-text-primary text-sm">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="web3-card rounded-3xl p-4 sm:p-6 md:p-8 relative"
          >
            {/* Zigzag Lines */}
            <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
              <motion.path
                d="M 0 30% L 25% 20% L 50% 30% L 75% 20% L 100% 30%"
                stroke="rgba(38, 161, 123, 0.5)"
                strokeWidth="1"
                fill="none"
                strokeDasharray="1000"
                strokeDashoffset="1000"
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              <motion.path
                d="M 0 70% L 25% 60% L 50% 70% L 75% 60% L 100% 70%"
                stroke="rgba(38, 161, 123, 0.4)"
                strokeWidth="1"
                fill="none"
                strokeDasharray="1000"
                strokeDashoffset="1000"
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
              />
            </svg>
            <motion.h3 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xl font-bold text-white mb-6 flex items-center gap-2"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Award className="w-5 h-5 text-gold" />
              </motion.div>
              {activeTab === 'investor' ? 'Choose Your Income Level' : 'Startup GPU Plans'}
            </motion.h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {currentService.pricing.map((plan, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  className={`relative rounded-2xl border transition-all cursor-pointer ${
                    plan.popular
                      ? 'bg-gradient-to-br from-usdt-green/20 to-emerald-600/20 border-usdt-green/40'
                      : 'bg-[#1a202c] border-white/10'
                  }`}
                >
                  {plan.popular && (
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-3 left-6 px-3 py-1 bg-gradient-to-r from-usdt-green to-emerald-400 text-black text-xs font-bold rounded-full"
                    >
                      Most Popular
                    </motion.div>
                  )}
                  
                  <div className="p-4 sm:p-6">
                    <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
                    <p className="text-text-primary text-sm mb-4">{plan.specs}</p>
                    
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-2xl sm:text-3xl font-black text-white mb-2"
                    >
                      {plan.price}
                    </motion.div>
                    
                    {plan.totalCost && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm font-bold text-text-tertiary mb-4"
                      >
                        Total: {plan.totalCost}
                      </motion.div>
                    )}
                    
                    {plan.dailyYield && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xl font-bold text-usdt-green mb-1"
                      >
                        {plan.dailyYield}
                      </motion.div>
                    )}
                    
                    {plan.roi && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm font-bold text-gold mb-4"
                      >
                        {plan.roi}
                      </motion.div>
                    )}
                    
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((feature, idx) => (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.05, duration: 0.3 }}
                          className="flex items-center gap-2 text-sm text-text-primary"
                        >
                          <motion.div
                            whileHover={{ scale: 1.2, rotate: 10 }}
                          >
                            <CheckCircle2 className="w-4 h-4 text-usdt-green" />
                          </motion.div>
                          {feature}
                        </motion.li>
                      ))}
                    </ul>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={activeTab === 'investor' ? handleJoinTitanStream : handleContactSales}
                      className={`w-full py-3 rounded-xl font-bold transition-all ${
                        plan.popular
                          ? 'bg-gradient-to-r from-usdt-green to-emerald-400 text-black'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {activeTab === 'investor' ? plan.buttonText : (plan.popular ? 'Access GPUs' : 'Contact Sales')}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        {/* Animated Dots Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.circle
              key={i}
              cx={`${10 + (i % 5) * 20}%`}
              cy={`${10 + Math.floor(i / 5) * 20}%`}
              r="2"
              fill="rgba(38, 161, 123, 0.4)"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.3 }}
            />
          ))}
        </svg>
        
        <motion.h3 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl font-bold text-white text-center mb-8"
        >
          {activeTab === 'investor' ? 'Investment Performance Metrics' : 'Commitment Benefits'}
        </motion.h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 relative">
          {(activeTab === 'investor' ? [
            { value: '24/7', label: 'Yield Generation', icon: <Zap className="w-6 h-6" /> },
            { value: '365', label: 'Days Annual Returns', icon: <TrendingUp className="w-6 h-6" /> },
            { value: '100%', label: 'Secure Investment', icon: <ShieldCheck className="w-6 h-6" /> },
            { value: 'Instant', label: 'Yield Activation', icon: <Clock className="w-6 h-6" /> }
          ] : [
            { value: '34%', label: 'Max Savings', icon: <DollarSign className="w-6 h-6" /> },
            { value: '1W', label: 'Min Commitment', icon: <Clock className="w-6 h-6" /> },
            { value: 'Flexible', label: 'Time Periods', icon: <Activity className="w-6 h-6" /> },
            { value: 'Lock', label: 'Lowest Rates', icon: <Sparkles className="w-6 h-6" /> }
          ]).map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="web3-card rounded-2xl p-6 text-center cursor-pointer"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20 + index * 5, repeat: Infinity, ease: "linear" }}
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeTab === 'investor' ? 'from-usdt-green to-emerald-400' : 'from-blue-500 to-cyan-500'} bg-opacity-20 text-white flex items-center justify-center mx-auto mb-4`}
              >
                {stat.icon}
              </motion.div>
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
                className="text-2xl sm:text-3xl font-black text-gradient-neon mb-2"
              >
                {stat.value}
              </motion.div>
              <div className="text-text-secondary text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Documentation & Articles */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        {/* Animated Grid Background */}
        <svg className="absolute inset-0 w-full h-full opacity-5 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.rect
              key={i}
              x={`${10 + (i % 3) * 30}%`}
              y={`${10 + Math.floor(i / 3) * 30}%`}
              width="20%"
              height="20%"
              stroke="rgba(38, 161, 123, 0.4)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
            />
          ))}
        </svg>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 relative"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Platform Documentation</h2>
          <p className="text-text-primary max-w-2xl mx-auto">
            Comprehensive guides for investors and startups to maximize the platform
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 relative">
          {(activeTab === 'investor' ? [
            {
              title: "Getting Started as an Investor",
              description: "Learn how to purchase compute capacity and start earning daily yield",
              category: "Guide",
              readTime: "5 min read",
              icon: <Cpu className="w-6 h-6" />
            },
            {
              title: "Understanding Daily Yield Calculations",
              description: "How your machine generates returns and factors affecting your daily earnings",
              category: "Tutorial",
              readTime: "8 min read",
              icon: <Server className="w-6 h-6" />
            },
            {
              title: "Instant Withdrawals Guide",
              description: "How to withdraw earnings instantly to crypto wallets and mobile wallets",
              category: "Documentation",
              readTime: "5 min read",
              icon: <Network className="w-6 h-6" />
            },
            {
              title: "Portfolio Diversification Strategies",
              description: "Build a balanced machine portfolio for optimal returns and risk management",
              category: "Technical",
              readTime: "12 min read",
              icon: <Database className="w-6 h-6" />
            },
            {
              title: "ROI Optimization Guide",
              description: "Maximize your investment returns through strategic machine selection and timing",
              category: "Case Study",
              readTime: "7 min read",
              icon: <TrendingUp className="w-6 h-6" />
            },
            {
              title: "Investment Security & Protection",
              description: "How TitanStream protects your compute investment and ensures reliable payouts",
              category: "Guide",
              readTime: "10 min read",
              icon: <ShieldCheck className="w-6 h-6" />
            }
          ] : [
            {
              title: "Getting Started as Startup",
              description: "How startups can access affordable GPU infrastructure with flexible commitments",
              category: "Guide",
              readTime: "5 min read",
              icon: <Cpu className="w-6 h-6" />
            },
            {
              title: "Choosing Your Commitment",
              description: "How to select the right commitment period for your project needs",
              category: "Tutorial",
              readTime: "8 min read",
              icon: <Server className="w-6 h-6" />
            },
            {
              title: "Startup Security Overview",
              description: "Understanding our security measures for startup workloads",
              category: "Documentation",
              readTime: "10 min read",
              icon: <ShieldCheck className="w-6 h-6" />
            },
            {
              title: "API Integration Guide",
              description: "Connect your applications with TitanStream's powerful API",
              category: "Technical",
              readTime: "12 min read",
              icon: <Database className="w-6 h-6" />
            },
            {
              title: "Maximizing Savings",
              description: "How to save up to 34% with longer commitment periods",
              category: "Case Study",
              readTime: "7 min read",
              icon: <TrendingUp className="w-6 h-6" />
            },
            {
              title: "Commitment Planning",
              description: "Plan your GPU needs from 1 week to 1 year effectively",
              category: "Guide",
              readTime: "6 min read",
              icon: <Network className="w-6 h-6" />
            }
          ]).map((article, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.03, y: -5 }}
              onClick={() => setModalContent('documentation')}
              className="web3-card rounded-2xl p-6 hover:border-usdt-green/30 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${activeTab === 'investor' ? 'from-usdt-green to-emerald-400' : 'from-blue-500 to-cyan-500'} bg-opacity-20 text-white`}>
                  {article.icon}
                </div>
                <span className="text-xs font-bold text-usdt-green bg-usdt-green/10 px-2 py-1 rounded-full">
                  {article.category}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{article.title}</h3>
              <p className="text-text-primary text-sm mb-4">{article.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-text-tertiary text-xs">{article.readTime}</span>
                <motion.div whileHover={{ x: 3 }}>
                  <ArrowRight className="w-4 h-4 text-usdt-green" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center mt-8"
        >
          <button onClick={() => setModalContent('documentation')} className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 transition-all">
            View All Documentation
          </button>
        </motion.div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        {/* Connection Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-8 pointer-events-none">
          <motion.path
            d="M 15% 30% L 40% 30% L 40% 50%"
            stroke="rgba(38, 161, 123, 0.5)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <motion.path
            d="M 40% 50% L 60% 50% L 60% 30%"
            stroke="rgba(38, 161, 123, 0.4)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
          />
          <motion.path
            d="M 60% 30% L 85% 30%"
            stroke="rgba(38, 161, 123, 0.3)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
          />
        </svg>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 relative"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-text-primary max-w-2xl mx-auto">
            {activeTab === 'investor' ? 'Simple path to start earning daily yield' : 'Simple path to access affordable GPU compute'}
          </p>
        </motion.div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-6">
          {(activeTab === 'investor' ? [
            { step: '01', title: 'Choose Machine', description: 'Select GPU compute capacity that fits your investment goals' },
            { step: '02', title: 'Purchase Capacity', description: 'Secure your compute capacity with USDT payment' },
            { step: '03', title: 'Start Earning', description: 'Your machine activates and begins generating daily yield' },
            { step: '04', title: 'Instant Withdraw', description: 'Withdraw earnings to crypto or mobile wallets instantly' }
          ] : [
            { step: '01', title: 'Sign Up Free', description: 'Create account with no commitment or credit card' },
            { step: '02', title: 'Choose Commitment', description: 'Select from 1 week to 1 year GPU plans' },
            { step: '03', title: 'Deploy Workloads', description: 'Run AI/ML, rendering, or HPC jobs instantly' },
            { step: '04', title: 'Save Long Term', description: 'Lower rates with longer commitments' }
          ]).map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="text-center cursor-pointer"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                className="text-4xl font-black text-usdt-green/30 mb-4"
              >
                {item.step}
              </motion.div>
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-text-primary text-sm">{item.description}</p>
              {index < 3 && (
                <motion.div 
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.3 }}
                  className="hidden md:flex justify-center mt-4"
                >
                  <ChevronRight className="w-6 h-6 text-text-tertiary" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative">
        {/* Radiating Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <motion.line
              key={i}
              x1="50%"
              y1="50%"
              x2={`${50 + Math.cos(i * Math.PI / 4) * 100}%`}
              y2={`${50 + Math.sin(i * Math.PI / 4) * 100}%`}
              stroke="rgba(255, 179, 0, 0.5)"
              strokeWidth="1"
              strokeDasharray="1000"
              strokeDashoffset="1000"
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 2 + i * 0.2, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
            />
          ))}
        </svg>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="web3-card-gold rounded-3xl p-6 sm:p-8 md:p-12 text-center relative overflow-hidden"
        >
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute top-0 right-0 w-64 h-64 bg-gold/10 rounded-full blur-3xl pointer-events-none" 
          />
          
          {/* Scanning line effect */}
          <motion.div
            animate={{ y: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/5 to-transparent pointer-events-none"
          />
          
          <div className="relative z-10">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-3xl sm:text-4xl font-black text-white mb-4"
            >
              {activeTab === 'investor' ? 'Ready to Start Making Money?' : 'Ready to Access Affordable GPUs?'}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-text-primary max-w-2xl mx-auto mb-8"
            >
              {activeTab === 'investor' 
                ? 'Join thousands of investors who wake up to earnings every single day.' 
                : 'Start with as little as 1 week commitment and scale up to 1 year for maximum savings.'}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={activeTab === 'investor' ? handleJoinTitanStream : handleContactSales}
                className={`px-6 sm:px-8 py-3 sm:py-4 text-white font-extrabold rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                  activeTab === 'investor'
                    ? 'bg-gradient-to-r from-usdt-green to-emerald-400 shadow-usdt-green/20'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-500/20'
                }`}
              >
                <span>{activeTab === 'investor' ? 'Start Earning Now' : 'Access GPUs'}</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.div>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleContactSales}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                Contact Sales
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="border-t border-white/10 py-8 mt-16 relative"
      >
        {/* Animated Sketch Line */}
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: "100%" }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-0 left-0 h-px bg-gradient-to-r from-transparent via-usdt-green to-transparent"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
            {/* Company */}
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-text-tertiary text-sm">
                <motion.li whileHover={{ x: 5 }}>
                  <a href="/" className="hover:text-usdt-green transition-colors">About TitanStream</a>
                </motion.li>
                <motion.li whileHover={{ x: 5 }}>
                  <a href="mailto:info@titanstream.us" className="hover:text-usdt-green transition-colors">Contact Us</a>
                </motion.li>
              </ul>
            </div>

            {/* Products */}
            <div>
              <h4 className="text-white font-bold mb-4">Products</h4>
              <ul className="space-y-2 text-text-tertiary text-sm">
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setActiveTab('investor')} className="hover:text-usdt-green transition-colors text-left w-full">Invest in GPU</button>
                </motion.li>
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setActiveTab('startup')} className="hover:text-usdt-green transition-colors text-left w-full">GPU Compute Services</button>
                </motion.li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-white font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-text-tertiary text-sm">
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setModalContent('documentation')} className="hover:text-usdt-green transition-colors text-left w-full cursor-pointer">Documentation</button>
                </motion.li>
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setModalContent('api')} className="hover:text-usdt-green transition-colors text-left w-full cursor-pointer">API Documentation</button>
                </motion.li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-text-tertiary text-sm">
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setModalContent('privacy')} className="hover:text-usdt-green transition-colors text-left w-full cursor-pointer">Privacy Policy</button>
                </motion.li>
                <motion.li whileHover={{ x: 5 }}>
                  <button onClick={() => setModalContent('terms')} className="hover:text-usdt-green transition-colors text-left w-full cursor-pointer">Terms of Service</button>
                </motion.li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-text-tertiary text-sm">
              © {new Date().getFullYear()} TitanStream Cloud Computing Technologies Ltd. · All rights reserved.
            </div>
            <div className="flex gap-4 text-text-tertiary text-sm">
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => setModalContent('status')}
                className="transition-colors hover:text-usdt-green"
              >
                Status
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={handleContactSales}
                className="transition-colors hover:text-usdt-green"
              >
                Contact
              </motion.button>
            </div>
          </div>
        </div>
      </motion.footer>

      {/* Documentation Modal */}
      <AnimatePresence>
        {modalContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setModalContent(null);
              }
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Sketch Lines Background */}
            <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
              {[...Array(4)].map((_, i) => (
                <motion.line
                  key={i}
                  x1="0"
                  y1={`${20 + i * 20}%`}
                  x2="100%"
                  y2={`${20 + i * 20}%`}
                  stroke="rgba(38, 161, 123, 0.5)"
                  strokeWidth="0.5"
                  strokeDasharray="1000"
                  strokeDashoffset="1000"
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                />
              ))}
            </svg>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="web3-card rounded-3xl p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative"
            >
              <button
                onClick={() => setModalContent(null)}
                className="absolute top-4 right-4 text-text-tertiary hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {modalContent === 'documentation' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Platform Documentation</h2>
                  <div className="space-y-4 text-text-primary max-h-[60vh] overflow-y-auto">
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Getting Started as an Investor</h3>
                      <p className="text-sm">Complete walkthrough for purchasing compute capacity and earning daily yield. Learn how to fund GPU infrastructure and start generating passive income.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Getting Started as a Startup</h3>
                      <p className="text-sm">How startups can access affordable GPU infrastructure with flexible commitments from 1 week to 1 year. Learn to choose the right commitment period for your needs.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Understanding Daily Yield Calculations</h3>
                      <p className="text-sm">How your machine generates returns and factors affecting your daily earnings. Learn about yield mechanics, promotional periods, and calculation formulas.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Instant Withdrawals Guide</h3>
                      <p className="text-sm">How to withdraw earnings instantly to crypto wallets and mobile wallets. Step-by-step instructions for accessing your funds anytime.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Portfolio Diversification Strategies</h3>
                      <p className="text-sm">Build a balanced machine portfolio for optimal returns and risk management. Learn how to spread investments across different machine tiers.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">ROI Optimization Guide</h3>
                      <p className="text-sm">Maximize your investment returns through strategic machine selection and timing. Learn about compounding strategies and optimal reinvestment approaches.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Investment Security & Protection</h3>
                      <p className="text-sm">How TitanStream protects your compute investment and ensures reliable payouts. Understand security measures and protection mechanisms.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Choosing Your Commitment</h3>
                      <p className="text-sm">How to select the right commitment period for your project needs. Compare 1 week, 1 month, and 1 year options with their respective savings.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Startup Security Overview</h3>
                      <p className="text-sm">Understanding our security measures for startup workloads. Learn about data protection, access controls, and compliance standards.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Maximizing Savings</h3>
                      <p className="text-sm">How to save up to 34% with longer commitment periods. Learn to plan your GPU needs from 1 week to 1 year effectively.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Commitment Planning</h3>
                      <p className="text-sm">Plan your GPU needs from 1 week to 1 year effectively. Learn to match commitment periods to project timelines and budget constraints.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Platform Overview</h3>
                      <p className="text-sm">Understanding how the platform serves both investors and startups. Learn about the two-sided model and how it creates value for both parties.</p>
                    </div>
                  </div>
                </div>
              )}

              {modalContent === 'api' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Platform API</h2>
                  <div className="space-y-4 text-text-primary max-h-[60vh] overflow-y-auto">
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Authentication</h3>
                      <p className="text-sm">Secure API access using JWT tokens for both investors and startups. Obtain your API key from your account settings.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Investment Endpoints</h3>
                      <p className="text-sm">Purchase capacity, track yield, and manage investment portfolio. Endpoints include /machines, /purchases, /earnings, and /withdrawals.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Compute Endpoints</h3>
                      <p className="text-sm">Deploy workloads, manage resources, and monitor performance on-demand. Endpoints include /instances, /workloads, /resources, and /metrics.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Rate Limiting</h3>
                      <p className="text-sm">API requests are rate-limited to ensure fair usage. Standard limits: 1000 requests per minute for authenticated users.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Webhooks</h3>
                      <p className="text-sm">Configure webhooks to receive real-time notifications about yield payouts, machine status changes, and workload events.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Error Handling</h3>
                      <p className="text-sm">All API responses include standardized error codes and messages. Implement proper error handling in your applications.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">SDK Support</h3>
                      <p className="text-sm">Official SDKs available for Python, JavaScript, and Go. Visit our GitHub repository for documentation and examples.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Sandbox Environment</h3>
                      <p className="text-sm">Test your API integrations in our sandbox environment without affecting production data or real investments.</p>
                    </div>
                  </div>
                </div>
              )}

              {modalContent === 'privacy' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Privacy Policy</h2>
                  <div className="space-y-4 text-text-primary max-h-[60vh] overflow-y-auto">
                    <p className="text-xs text-text-tertiary">Last updated: {new Date().toLocaleDateString()}</p>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">1. Voluntary Participation</h3>
                      <p className="text-sm">All participation in TitanStream platform services is entirely voluntary and at your own discretion. You choose to engage with the platform on your own accord.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">2. Data Collection</h3>
                      <p className="text-sm">We collect only necessary data for service provision, account management, and platform security. This includes user credentials, transaction records, and investment data.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">3. Data Usage</h3>
                      <p className="text-sm">Your data is used solely for service delivery, account management, yield calculation, and platform security. We never sell or share your data with third parties for marketing purposes.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">4. Data Security</h3>
                      <p className="text-sm">We implement industry-standard security measures to protect your data. However, no system is completely secure, and we cannot guarantee absolute security.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">5. Financial Data Protection</h3>
                      <p className="text-sm">Your financial information is encrypted and stored securely. We do not store sensitive payment details on our servers.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">6. Your Rights</h3>
                      <p className="text-sm">You have the right to access, modify, or delete your personal data. You may request account closure at any time, subject to outstanding obligations.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">7. Cookies and Tracking</h3>
                      <p className="text-sm">We use essential cookies for platform functionality. You may disable non-essential cookies through your browser settings.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">8. Third-Party Services</h3>
                      <p className="text-sm">We may use third-party services for payment processing and infrastructure. These services have their own privacy policies.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">9. Data Retention</h3>
                      <p className="text-sm">We retain your data only as long as necessary for service provision, legal obligations, or legitimate business purposes.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">10. Policy Updates</h3>
                      <p className="text-sm">We may update this privacy policy. Continued use of the platform after changes constitutes acceptance of the updated policy.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">11. Contact Information</h3>
                      <p className="text-sm">For privacy-related inquiries, contact us at privacy@titanstream.us</p>
                    </div>
                  </div>
                </div>
              )}

              {modalContent === 'terms' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Terms of Service</h2>
                  <div className="space-y-4 text-text-primary max-h-[60vh] overflow-y-auto">
                    <p className="text-xs text-text-tertiary">Last updated: {new Date().toLocaleDateString()}</p>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">1. Voluntary Participation</h3>
                      <p className="text-sm">All participation in TitanStream platform services is entirely voluntary. You choose to engage with the platform on your own accord and at your sole discretion.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">2. No Investment Advice</h3>
                      <p className="text-sm">TitanStream does not provide financial, investment, or legal advice. All investment decisions are your sole responsibility. Consult with qualified professionals before investing.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">3. Investment Risk Acknowledgment</h3>
                      <p className="text-sm">You acknowledge that all investments carry risk, including the risk of loss of principal. Past performance does not guarantee future results. You may lose some or all of your investment.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">4. No Liability for Loss of Funds</h3>
                      <p className="text-sm">TitanStream is not liable for any loss of funds, investment losses, or financial damages. You accept full responsibility for all financial decisions and outcomes.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">5. No Guaranteed Returns</h3>
                      <p className="text-sm">Daily yield figures are estimates based on current conditions and are not guaranteed. Actual returns may vary significantly. TitanStream makes no promises about future performance.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">6. Platform Availability</h3>
                      <p className="text-sm">We strive for 99.99% uptime but cannot guarantee uninterrupted service. We are not liable for downtime, service interruptions, or losses resulting from such events.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">7. User Responsibilities</h3>
                      <p className="text-sm">You are responsible for maintaining the security of your account credentials. You agree not to share your login information with others and to notify us immediately of unauthorized access.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">8. Prohibited Activities</h3>
                      <p className="text-sm">You agree not to engage in fraudulent activities, money laundering, unauthorized access, or any illegal use of the platform. Violations may result in immediate account termination.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">9. Indemnification</h3>
                      <p className="text-sm">You agree to indemnify and hold harmless TitanStream, its officers, directors, employees, and affiliates from any claims arising from your use of the platform.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">10. Limitation of Liability</h3>
                      <p className="text-sm">To the maximum extent permitted by law, TitanStream shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">11. Force Majeure</h3>
                      <p className="text-sm">TitanStream is not liable for failures or delays due to circumstances beyond our control, including natural disasters, wars, or government actions.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">12. Governing Law</h3>
                      <p className="text-sm">These terms are governed by the laws of the jurisdiction in which TitanStream operates. Any disputes shall be resolved in the applicable courts.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">13. Terms Modifications</h3>
                      <p className="text-sm">We reserve the right to modify these terms at any time. Continued use of the platform after modifications constitutes acceptance of the updated terms.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">14. Severability</h3>
                      <p className="text-sm">If any provision of these terms is found invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">15. Agreement to Terms</h3>
                      <p className="text-sm">By using TitanStream, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</p>
                    </div>
                  </div>
                </div>
              )}

              {modalContent === 'status' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Platform Status</h2>
                  <div className="space-y-4 text-text-primary">
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white">All Systems Operational</h3>
                        <p className="text-sm">Platform running normally</p>
                      </div>
                      <div className="w-3 h-3 bg-usdt-green rounded-full animate-pulse" />
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Compute Capacity: 98% Utilized</h3>
                      <p className="text-sm">Current infrastructure utilization</p>
                    </div>
                    <div className="bg-[#1a202c] border border-white/10 rounded-xl p-4">
                      <h3 className="font-bold text-white mb-2">Yield Payout Success: 99.99%</h3>
                      <p className="text-sm">Average across all regions</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
