import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { SimProvider } from './store';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SimProvider>
      <App />
    </SimProvider>
  </StrictMode>,
);
