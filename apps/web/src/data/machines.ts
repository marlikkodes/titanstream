export interface FrontendMachineModel {
  id: string;
  tierCode: string;
  name: string;
  tierLabel: string;
  targetUser: string;
  priceUsdt: number;
  capacityGhs: number;
  powerRatingW: number;
  description: string;
  technicalSummary: string;
  simpleExplanation: string;
  personality: string;
  dailyYieldUsdt: number;
  performanceLevel: string;
  computeCapacityText: string;
  processingPriority: string;
  cloudWorkloadRating: string;
  dailyOutputRating: string;
  workloadClass: string;
  processingIndex: string;
  fabricThroughput: string;
  capacityScore: number;
  comparisonText?: string;
  isPopular?: boolean;
  status: 'ACTIVE' | 'AVAILABLE' | 'LOCKED';
  spinnerSpeedMultiplier: number;
  passiveYieldRate: number;
  promoYieldRate?: number;
  promoOutputCap?: number;
  promoSpinnerSpeedMultiplier?: number;
}

export const MACHINE_CATALOG: FrontendMachineModel[] = [
  {
    id: 'free-trial',
    tierCode: 'TS_TRIAL',
    name: 'Titan Core',
    tierLabel: 'Free Starter Machine',
    targetUser: 'Free starter machine for everyone.',
    priceUsdt: 0.0,
    capacityGhs: 1.0,
    powerRatingW: 10,
    description: 'Free starter machine that earns daily money automatically as soon as you open the app.',
    technicalSummary: 'Free starter machine with basic power to generate initial earnings.',
    simpleExplanation: 'Your free starter machine that earns daily money automatically.',
    personality: 'Free starter machine.',
    dailyYieldUsdt: 2.0,
    performanceLevel: 'Starter Level',
    computeCapacityText: '10 Machine Power',
    processingPriority: 'Standard Queue',
    cloudWorkloadRating: 'Basic Work',
    dailyOutputRating: 'Basic Earnings',
    workloadClass: 'Basic Work',
    processingIndex: 'PX-CORE',
    fabricThroughput: '2 Speed Units',
    capacityScore: 10,
    status: 'ACTIVE',
    spinnerSpeedMultiplier: 0.1,
    passiveYieldRate: 0.00000192935,
    promoYieldRate: 0.0000289,
    promoOutputCap: 5.0,
    promoSpinnerSpeedMultiplier: 0.5,
  },
  {
    id: 'ripple-x14',
    tierCode: 'TS_C10',
    name: 'Ripple X14',
    tierLabel: 'Tier 1 Machine',
    targetUser: 'Perfect for getting started.',
    priceUsdt: 10.99,
    capacityGhs: 5.0,
    powerRatingW: 50,
    description: 'Great starter machine designed to earn steady daily money with low power.',
    technicalSummary: 'Starter machine with intake cooling to maximize continuous earnings.',
    simpleExplanation: 'An easy-to-use machine that earns continuous money for beginners.',
    personality: 'Great for steady daily earnings.',
    dailyYieldUsdt: 0.27,
    performanceLevel: 'Level 1 Speed',
    computeCapacityText: '24 Machine Power',
    processingPriority: 'Standard Speed',
    cloudWorkloadRating: 'Starter Work',
    dailyOutputRating: 'Starter Earnings',
    workloadClass: 'Level 1 Earning',
    processingIndex: 'PX-14',
    fabricThroughput: '12 Speed Units',
    capacityScore: 35,
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 0.8,
    passiveYieldRate: 0.000000625,
  },
  {
    id: 'surge-r28',
    tierCode: 'TS_A50',
    name: 'Surge R28',
    tierLabel: 'Tier 2 Machine',
    targetUser: 'Designed for growing daily earnings.',
    priceUsdt: 50.0,
    capacityGhs: 25.0,
    powerRatingW: 250,
    description: 'Fast dual-turbine machine built for higher daily earnings.',
    technicalSummary: 'High-speed dual turbine design accelerating daily earnings.',
    simpleExplanation: 'Spinning turbines boost your earnings speed every single day.',
    personality: 'Designed for higher daily earnings.',
    dailyYieldUsdt: 1.40,
    performanceLevel: 'Level 2 Speed',
    computeCapacityText: '120 Machine Power',
    processingPriority: 'Fast Queue',
    cloudWorkloadRating: 'Fast Processing',
    dailyOutputRating: 'Higher Earnings',
    workloadClass: 'Level 2 Earning',
    processingIndex: 'PX-28',
    fabricThroughput: '48 Speed Units',
    capacityScore: 60,
    comparisonText: 'Earns approximately 5× more money than Ripple X14.',
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 1.5,
    passiveYieldRate: 0.000000648148,
  },
  {
    id: 'torrent-v63',
    tierCode: 'TS_P250',
    name: 'Torrent V63',
    tierLabel: 'Tier 3 Machine',
    targetUser: 'Built for users who want strong daily profits.',
    priceUsdt: 250.0,
    capacityGhs: 130.0,
    powerRatingW: 1200,
    description: 'Powerful machine equipped with dual water-cooled impellers for maximum earnings.',
    technicalSummary: 'Marine-grade impeller system designed for high-volume continuous earnings.',
    simpleExplanation: 'Water-cooled impellers keep this powerful machine running at peak earnings.',
    personality: 'High-performance machine for strong earnings.',
    dailyYieldUsdt: 7.50,
    performanceLevel: 'Level 3 Speed',
    computeCapacityText: '620 Machine Power',
    processingPriority: 'Super Speed Queue',
    cloudWorkloadRating: 'High-Speed Work',
    dailyOutputRating: 'High Earnings',
    workloadClass: 'Level 3 Earning',
    processingIndex: 'PX-63',
    fabricThroughput: '240 Speed Units',
    capacityScore: 82,
    comparisonText: 'Earns approximately 5.3× more money than Surge R28.',
    isPopular: true,
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 2.2,
    passiveYieldRate: 0.000000667735,
  },
  {
    id: 'cascade-m91',
    tierCode: 'TS_X1000',
    name: 'Cascade M91',
    tierLabel: 'Tier 4 Machine',
    targetUser: 'Built for high daily payouts.',
    priceUsdt: 1000.0,
    capacityGhs: 550.0,
    powerRatingW: 4500,
    description: 'Supercomputing machine with multi-axis gimbals and heavy-duty magnetic bearings.',
    technicalSummary: 'Gyroscopic magnetic bearing system providing ultra-fast earning speed.',
    simpleExplanation: 'Gyroscopic stabilization allows this machine to spin fast and earn big.',
    personality: 'Pro machine for serious daily profits.',
    dailyYieldUsdt: 32.00,
    performanceLevel: 'Level 4 Pro Speed',
    computeCapacityText: '2,600 Machine Power',
    processingPriority: 'Top Speed Queue',
    cloudWorkloadRating: 'Pro Speed Work',
    dailyOutputRating: 'Pro Earnings',
    workloadClass: 'Level 4 Earning',
    processingIndex: 'PX-91',
    fabricThroughput: '960 Speed Units',
    capacityScore: 94,
    comparisonText: 'Earns approximately 4.2× more money than Torrent V63.',
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 3.0,
    passiveYieldRate: 0.000000673401,
  },
  {
    id: 'streamtitan-2028',
    tierCode: 'TS_Q2500',
    name: 'StreamTitan 2028',
    tierLabel: 'Tier 5 Machine',
    targetUser: 'Maximum power machine for highest earnings.',
    priceUsdt: 2500.0,
    capacityGhs: 1500.0,
    powerRatingW: 12000,
    description: 'Our top-of-the-line supercomputer combining all advanced power systems for maximum daily profits.',
    technicalSummary: 'Top flagship engineering system combining all power stages for maximum earnings.',
    simpleExplanation: 'The ultimate machine—combines every power system to give you maximum daily money.',
    personality: 'Top flagship machine for maximum earnings.',
    dailyYieldUsdt: 85.00,
    performanceLevel: 'Maximum Power',
    computeCapacityText: '7,500 Machine Power',
    processingPriority: 'Maximum Speed Queue',
    cloudWorkloadRating: 'Ultra-Speed Work',
    dailyOutputRating: 'Maximum Earnings',
    workloadClass: 'Level 5 Earning',
    processingIndex: 'PX-2028',
    fabricThroughput: '2,500 Speed Units',
    capacityScore: 99,
    comparisonText: 'Earns approximately 2.6× more money than Cascade M91.',
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 3.8,
    passiveYieldRate: 0.000000655864,
  },
  {
    id: 'maximus-x2091',
    tierCode: 'TS_X5000',
    name: 'Maximus X2091',
    tierLabel: 'Tier 6 Ultimate Machine',
    targetUser: 'Ultimate investment for maximum daily yields.',
    priceUsdt: 5000.0,
    capacityGhs: 3000.0,
    powerRatingW: 25000,
    description: 'Our ultimate flagship supercomputer with next-generation processing architecture for maximum daily profits.',
    technicalSummary: 'Advanced quantum-inspired processing architecture with AI-optimized yield algorithms.',
    simpleExplanation: 'The ultimate machine with cutting-edge technology for maximum daily money.',
    personality: 'Ultimate flagship machine for maximum earnings.',
    dailyYieldUsdt: 170.00,
    performanceLevel: 'Ultimate Power',
    computeCapacityText: '15,000 Machine Power',
    processingPriority: 'Ultimate Speed Queue',
    cloudWorkloadRating: 'Ultimate-Speed Work',
    dailyOutputRating: 'Ultimate Earnings',
    workloadClass: 'Level 6 Earning',
    processingIndex: 'PX-2091',
    fabricThroughput: '5,000 Speed Units',
    capacityScore: 100,
    comparisonText: 'Earns approximately 2× more money than StreamTitan 2028.',
    status: 'AVAILABLE',
    spinnerSpeedMultiplier: 4.5,
    passiveYieldRate: 0.000000655864,
  },
];

import { useCountryStore } from '../store/useCountryStore';

export function getMachineYieldDetails(machine: FrontendMachineModel) {
  const getLocalAmount = useCountryStore.getState().getLocalAmount;
  const dailyUsdt = Number(machine?.dailyYieldUsdt) || 0;
  const monthlyUsdt = dailyUsdt * 30;
  const priceUsdt = Number(machine?.priceUsdt) || 0;

  return {
    daily: {
      usdt: `$${dailyUsdt.toFixed(2)} USDT`,
      local: getLocalAmount(dailyUsdt),
    },
    monthly: {
      usdt: `$${monthlyUsdt.toFixed(2)} USDT`,
      local: getLocalAmount(monthlyUsdt),
    },
    price: {
      usdt: `$${priceUsdt.toFixed(2)} USDT`,
      local: getLocalAmount(priceUsdt),
    },
  };
}
