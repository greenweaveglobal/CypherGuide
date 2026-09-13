import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { setupNostrAutoPromoter } from './services/NostrAutoPromoter';
import { LocaleProvider } from './hooks/useTranslation.tsx';

// Cleanup bloated local storage from previous base64 bugs
try {
  const localMeshStore = localStorage.getItem('__mesh_store');
  if (localMeshStore && localMeshStore.length > 1024 * 500) { // If > 500KB
    console.warn('Wiping bloated localStorage');
    localStorage.removeItem('__mesh_store');
  }
} catch (e) {
  console.error(e);
}

// Initialize background services
setupNostrAutoPromoter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </ErrorBoundary>
  </StrictMode>,
);

