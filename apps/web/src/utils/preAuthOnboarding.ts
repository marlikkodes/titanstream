const STORAGE_KEY = 'pre-auth-onboarding-v1';
const SESSION_KEY = 'pre-auth-onboarding-completed-session';

export const hasSeenPreAuthOnboarding = () => {
  if (typeof window === 'undefined') return false;

  const urlParams = new URLSearchParams(window.location.search);
  if (
    window.location.pathname === '/start' ||
    urlParams.get('onboarding') === 'true' ||
    urlParams.get('start') === 'true'
  ) {
    return false;
  }

  return sessionStorage.getItem(SESSION_KEY) === 'true';
};

export const completePreAuthOnboarding = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(SESSION_KEY, 'true');
    localStorage.setItem(STORAGE_KEY, 'complete');
  }
};
