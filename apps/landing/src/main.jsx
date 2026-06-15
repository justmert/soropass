import './polyfills'; // MUST be first — Buffer/process before @stellar/stellar-sdk loads
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import '@soropass/ui/styled.css';
import './styles/tokens.css';
import './styles/landing.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
