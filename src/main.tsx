import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/montserrat';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './App';

// Cache the app shell so the app opens even without signal; new versions install themselves.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
