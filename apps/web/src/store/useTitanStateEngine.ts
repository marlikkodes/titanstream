import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ─── TITAN STATE DEFINITIONS ────────────────────────────────────────────────

export type MachineStatus = 'RUNNING' | 'PAUSED' | 'OVERHEATED' | 'MAINTENANCE' | 'OFFLINE';
export type RewardStatus = 'READY' | 'PENDING' | 'CLAIMED' | 'LOCKED';
export type ChallengeStatus = 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
export type EventStatus = 'ACTIVE' | 'UPCOMING' | 'ENDED';
export type UpgradeStatus = 'RECOMMENDED' | 'AVAILABLE' | 'NONE';
export type SecurityStatus = 'GOOD' | 'WARNING' | 'CRITICAL';
export type SyncStatus = 'SYNCING' | 'COMPLETE' | 'ERROR';

export interface TitanOperationalState {
  // Core Machine Status
  machineStatus: MachineStatus;
  machinePower: number;
  machineEfficiency: number;
  machineTemperature: number;
  
  // Reward Status
  rewardStatus: RewardStatus;
  unclaimedAmount: number;
  rewardStreak: number;
  
  // Daily Challenge
  challengeStatus: ChallengeStatus;
  challengeProgress: number;
  challengeTarget: number;
  challengeReward: number;
  
  // Events
  eventStatus: EventStatus;
  activeEvent: string | null;
  eventTimeRemaining: number;
  
  // Upgrade Recommendations
  upgradeStatus: UpgradeStatus;
  recommendedMachine: string | null;
  upgradeBenefit: string | null;
  
  // Security & Trust
  securityStatus: SecurityStatus;
  trustScore: number;
  accountAge: number;
  
  // Sync State
  syncStatus: SyncStatus;
  lastSyncTime: number;
  
  // Notifications
  hasNotifications: boolean;
  notificationCount: number;
  urgentNotification: string | null;
}

export interface TitanContext {
  // What the user should focus on right now
  primaryAction: string | null;
  secondaryAction: string | null;
  attentionRequired: boolean;
  
  // Emotional state of the Titan
  titanMood: 'EXCITED' | 'FOCUSED' | 'RESTING' | 'WARNING' | 'CRITICAL';
  titanMessage: string;
}

// ─── STATE ENGINE INTERFACE ───────────────────────────────────────────────────

interface TitanStateEngine {
  // Current operational state
  state: TitanOperationalState;
  context: TitanContext;
  
  // Actions
  refreshState: () => Promise<void>;
  updateMachineStatus: (status: MachineStatus, power: number, efficiency: number, temperature: number) => void;
  updateRewardStatus: (status: RewardStatus, amount: number, streak: number) => void;
  updateChallengeStatus: (status: ChallengeStatus, progress: number, target: number, reward: number) => void;
  updateEventStatus: (status: EventStatus, event: string | null, timeRemaining: number) => void;
  updateUpgradeStatus: (status: UpgradeStatus, machine: string | null, benefit: string | null) => void;
  updateSecurityStatus: (status: SecurityStatus, trustScore: number, accountAge: number) => void;
  updateSyncStatus: (status: SyncStatus) => void;
  updateNotifications: (hasNotifications: boolean, count: number, urgent: string | null) => void;
  
  // Context computation
  computeContext: () => TitanContext;
  computeContextWithState: (state: TitanOperationalState) => TitanContext;
}

// ─── STATE ENGINE IMPLEMENTATION ─────────────────────────────────────────────

const computeTitanMood = (state: TitanOperationalState): TitanContext['titanMood'] => {
  if (state.securityStatus === 'CRITICAL') return 'CRITICAL';
  if (state.machineStatus === 'OVERHEATED' || state.machineStatus === 'MAINTENANCE') return 'WARNING';
  if (state.challengeStatus === 'IN_PROGRESS') return 'FOCUSED';
  if (state.eventStatus === 'ACTIVE' && state.rewardStatus === 'READY') return 'EXCITED';
  if (state.machineStatus === 'RUNNING' && state.machineEfficiency > 0.8) return 'FOCUSED';
  return 'RESTING';
};

const computeTitanMessage = (state: TitanOperationalState, mood: TitanContext['titanMood']): string => {
  switch (mood) {
    case 'CRITICAL':
      return state.securityStatus === 'CRITICAL' 
        ? 'Security alert detected. Please review your account.' 
        : 'Critical system issue requires attention.';
    case 'WARNING':
      return state.machineStatus === 'OVERHEATED'
        ? 'Machine overheating. Activate cooler to restore efficiency.'
        : 'System maintenance in progress. Operations temporarily paused.';
    case 'FOCUSED':
      return state.challengeStatus === 'IN_PROGRESS'
        ? `Challenge in progress: ${state.challengeProgress}/${state.challengeTarget}`
        : 'Systems operating at peak efficiency.';
    case 'EXCITED':
      return state.eventStatus === 'ACTIVE'
        ? `Event active: ${state.activeEvent}`
        : 'Rewards ready to claim!';
    case 'RESTING':
      return 'All systems nominal. Titan is ready for your command.';
  }
};

const computePrimaryAction = (state: TitanOperationalState): string | null => {
  if (state.securityStatus === 'CRITICAL') return 'Review Security';
  if (state.machineStatus === 'OVERHEATED') return 'Activate Cooler';
  if (state.rewardStatus === 'READY' && state.unclaimedAmount > 0) return 'Claim Rewards';
  if (state.challengeStatus === 'AVAILABLE') return 'Start Challenge';
  if (state.upgradeStatus === 'RECOMMENDED') return 'Upgrade Machine';
  if (state.eventStatus === 'ACTIVE') return 'View Event';
  return null;
};

const computeSecondaryAction = (state: TitanOperationalState): string | null => {
  if (state.challengeStatus === 'IN_PROGRESS') return 'Continue Challenge';
  if (state.upgradeStatus === 'AVAILABLE') return 'View Shop';
  if (state.eventStatus === 'ACTIVE') return 'View Event';
  if (state.rewardStatus === 'PENDING') return 'View Rewards';
  return null;
};

export const useTitanStateEngine = create<TitanStateEngine>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    state: {
      machineStatus: 'RUNNING',
      machinePower: 0,
      machineEfficiency: 1.0,
      machineTemperature: 45,
      
      rewardStatus: 'PENDING',
      unclaimedAmount: 0,
      rewardStreak: 0,
      
      challengeStatus: 'AVAILABLE',
      challengeProgress: 0,
      challengeTarget: 3,
      challengeReward: 50,
      
      eventStatus: 'UPCOMING',
      activeEvent: null,
      eventTimeRemaining: 0,
      
      upgradeStatus: 'NONE',
      recommendedMachine: null,
      upgradeBenefit: null,
      
      securityStatus: 'GOOD',
      trustScore: 100,
      accountAge: 1,
      
      syncStatus: 'COMPLETE',
      lastSyncTime: Date.now(),
      
      hasNotifications: false,
      notificationCount: 0,
      urgentNotification: null,
    },
    
    context: {
      primaryAction: null,
      secondaryAction: null,
      attentionRequired: false,
      titanMood: 'RESTING',
      titanMessage: 'Initializing Titan systems...',
    },
    
    // Refresh entire state from backend
    refreshState: async () => {
      // This would fetch from backend in production
      // For now, we'll compute from existing stores
      const { computeContext } = get();
      const context = computeContext();
      set({ context });
    },
    
    // Update individual state components
    updateMachineStatus: (status, power, efficiency, temperature) => {
      const current = get().state;
      if (
        current.machineStatus === status &&
        current.machinePower === power &&
        current.machineEfficiency === efficiency &&
        current.machineTemperature === temperature
      ) {
        return;
      }
      set((state) => {
        const newState = {
          ...state.state,
          machineStatus: status,
          machinePower: power,
          machineEfficiency: efficiency,
          machineTemperature: temperature,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateRewardStatus: (status, amount, streak) => {
      const current = get().state;
      if (
        current.rewardStatus === status &&
        current.unclaimedAmount === amount &&
        current.rewardStreak === streak
      ) {
        return;
      }
      set((state) => {
        const newState = {
          ...state.state,
          rewardStatus: status,
          unclaimedAmount: amount,
          rewardStreak: streak,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateChallengeStatus: (status, progress, target, reward) => {
      set((state) => {
        const newState = {
          ...state.state,
          challengeStatus: status,
          challengeProgress: progress,
          challengeTarget: target,
          challengeReward: reward,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateEventStatus: (status, event, timeRemaining) => {
      set((state) => {
        const newState = {
          ...state.state,
          eventStatus: status,
          activeEvent: event,
          eventTimeRemaining: timeRemaining,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateUpgradeStatus: (status, machine, benefit) => {
      set((state) => {
        const newState = {
          ...state.state,
          upgradeStatus: status,
          recommendedMachine: machine,
          upgradeBenefit: benefit,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateSecurityStatus: (status, trustScore, accountAge) => {
      set((state) => {
        const newState = {
          ...state.state,
          securityStatus: status,
          trustScore,
          accountAge,
        };
        return {
          state: newState,
          context: get().computeContextWithState(newState),
        };
      });
    },
    
    updateSyncStatus: (status) => {
      const current = get().state;
      if (current.syncStatus === status) return;
      set((state) => ({
        state: {
          ...state.state,
          syncStatus: status,
          lastSyncTime: Date.now(),
        },
      }));
    },
    
    updateNotifications: (hasNotifications, count, urgent) => {
      set((state) => ({
        state: {
          ...state.state,
          hasNotifications,
          notificationCount: count,
          urgentNotification: urgent,
        },
      }));
    },
    
    // Compute context from current state
    computeContext: () => {
      const { state } = get();
      return get().computeContextWithState(state);
    },
    
    // Helper to compute context with a given state
    computeContextWithState: (state: TitanOperationalState): TitanContext => {
      const mood = computeTitanMood(state);
      const message = computeTitanMessage(state, mood);
      const primaryAction = computePrimaryAction(state);
      const secondaryAction = computeSecondaryAction(state);
      const attentionRequired = 
        state.securityStatus === 'CRITICAL' ||
        state.machineStatus === 'OVERHEATED' ||
        state.urgentNotification !== null;
      
      return {
        primaryAction,
        secondaryAction,
        attentionRequired,
        titanMood: mood,
        titanMessage: message,
      };
    },
  }))
);

// ─── HOOKS FOR CONVENIENCE ───────────────────────────────────────────────────

export const useTitanState = () => useTitanStateEngine((state) => state.state);
export const useTitanContext = () => useTitanStateEngine((state) => state.context);
export const useTitanActions = () => useTitanStateEngine((state) => ({
  refreshState: state.refreshState,
  updateMachineStatus: state.updateMachineStatus,
  updateRewardStatus: state.updateRewardStatus,
  updateChallengeStatus: state.updateChallengeStatus,
  updateEventStatus: state.updateEventStatus,
  updateUpgradeStatus: state.updateUpgradeStatus,
  updateSecurityStatus: state.updateSecurityStatus,
  updateSyncStatus: state.updateSyncStatus,
  updateNotifications: state.updateNotifications,
}));
