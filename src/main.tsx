import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/heebo/900.css';
import './styles.css';
import { App } from './App';
import { registerSW } from 'virtual:pwa-register';

// Check for a new version on every visit and every 10 minutes; reload as soon as it's ready.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 10 * 60 * 1000);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
