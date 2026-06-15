import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

// Real component styling (tokens + pk-* component CSS) from the shipping package,
// then the canonical handoff token scale, then the docs chrome. Order matters:
// the handoff tokens.css is the authoritative --pk-* scale the docs chrome reads.
import '@soropass/ui/styled.css';
import './styles/tokens.css';
import './styles/docs.css';
import './styles/landing.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
