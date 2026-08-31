import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PwaUpdateProvider } from './context/PwaUpdateContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import PwaUpdateBanner from './components/layout/PwaUpdateBanner';
import App from './App';
import './styles/theme.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PwaUpdateProvider>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <App />
              <PwaUpdateBanner />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </PwaUpdateProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
