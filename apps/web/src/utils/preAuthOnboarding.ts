const STORAGE_KEY = 'pre-auth-onboarding-v1';

export const hasSeenPreAuthOnboarding = () =>
  typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'complete';

export const completePreAuthOnboarding = () => {
  localStorage.setItem(STORAGE_KEY, 'complete');
};
