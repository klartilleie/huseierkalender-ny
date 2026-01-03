import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";

// Clear only problematic cached data on startup to prevent white screens
const clearProblematicCache = () => {
  try {
    // Only clear React Query cache and app-specific data, preserve session
    const keysToKeep = ['connect.sid', 'auth-token', 'user-session'];
    
    // Clear localStorage except important keys
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear sessionStorage except important keys
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (!keysToKeep.some(keepKey => key.includes(keepKey))) {
        sessionStorage.removeItem(key);
      }
    });
    
    console.log('Problematic cache cleared successfully');
  } catch (error) {
    console.warn('Cache clearing failed:', error);
  }
};

// Clear problematic cache on page load
clearProblematicCache();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Enhanced error handling for the entire app
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Don't reload automatically, but log the error
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the default browser behavior
  event.preventDefault();
});

// Add immediate visual feedback to prevent white screen
document.body.style.backgroundColor = '#f8fafc';
document.body.innerHTML = `
  <div id="loading-screen" style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 400px;">
      <div style="width: 64px; height: 64px; margin: 0 auto 1.5rem; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg style="width: 32px; height: 32px; color: white;" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
      </div>
      <h1 style="color: #1f2937; margin-bottom: 1rem; font-size: 1.5rem; font-weight: bold;">Smart Hjem Kalender</h1>
      <div style="width: 200px; height: 4px; background: #e5e7eb; border-radius: 2px; margin: 1rem auto; overflow: hidden;">
        <div style="width: 0%; height: 100%; background: #3b82f6; border-radius: 2px; animation: loading 2s ease-in-out infinite;" id="progress-bar"></div>
      </div>
      <p style="color: #6b7280; margin-bottom: 1.5rem;">Starter applikasjonen...</p>
      <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: 500; transition: background 0.2s;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
        Oppdater siden
      </button>
    </div>
  </div>
  <div id="root"></div>
  <style>
    @keyframes loading {
      0% { width: 0%; }
      50% { width: 70%; }
      100% { width: 100%; }
    }
  </style>
`;

const rootElement = document.getElementById("root");
const loadingScreen = document.getElementById("loading-screen");

// Function to hide loading screen
const hideLoadingScreen = () => {
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
};

// Function to show error screen
const showErrorScreen = (message = 'Kunne ikke starte applikasjonen') => {
  if (loadingScreen) {
    loadingScreen.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 400px;">
        <div style="width: 64px; height: 64px; margin: 0 auto 1.5rem; background: #dc2626; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg style="width: 32px; height: 32px; color: white;" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h1 style="color: #dc2626; margin-bottom: 1rem; font-size: 1.5rem; font-weight: bold;">Applikationsfeil</h1>
        <p style="color: #6b7280; margin-bottom: 1.5rem;">${message}</p>
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="background: #dc2626; color: white; padding: 0.75rem 1rem; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;">
            Rens cache
          </button>
          <button onclick="window.location.reload()" style="background: #6b7280; color: white; padding: 0.75rem 1rem; border: none; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem;">
            Prøv igjen
          </button>
        </div>
      </div>
    `;
  }
};

if (!rootElement) {
  showErrorScreen('Root element ikke funnet');
} else {
  try {
    // Set timeout to hide loading screen if React doesn't load
    const loadingTimeout = setTimeout(() => {
      showErrorScreen('Applikasjonen tok for lang tid å laste');
    }, 8000);

    createRoot(rootElement).render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <App />
      </ThemeProvider>
    );

    // Hide loading screen and emergency content when React has mounted
    clearTimeout(loadingTimeout);
    hideLoadingScreen();
    
    // Hide emergency content immediately when React loads successfully
    const emergencyContent = document.getElementById('emergency-content');
    if (emergencyContent) {
      emergencyContent.style.display = 'none';
      console.log('React loaded successfully, emergency content hidden');
    }

  } catch (error) {
    console.error('React rendering failed:', error);
    showErrorScreen('React kunne ikke starte');
  }
  
  // Emergency fallback - ensure something is always shown
  setTimeout(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl || rootEl.innerHTML.trim() === '' || rootEl.textContent?.includes('Laster...')) {
      console.log('Emergency fallback activated');
      window.location.href = '/auth';
    }
  }, 2500);
}
