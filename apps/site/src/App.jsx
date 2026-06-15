import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { DocsPage } from './shell.jsx';

import Introduction from './pages/Introduction.jsx';
import Quickstart from './pages/Quickstart.jsx';
import Overview from './pages/Overview.jsx';
import Security from './pages/Security.jsx';
import Create from './pages/Create.jsx';
import Sign from './pages/Sign.jsx';
import Recover from './pages/Recover.jsx';
import NewComponents from './pages/NewComponents.jsx';
import Primitives from './pages/Primitives.jsx';
import SDK from './pages/SDK.jsx';
import SDKCreate from './pages/SDKCreate.jsx';
import SDKSign from './pages/SDKSign.jsx';
import SDKRecover from './pages/SDKRecover.jsx';
import SDKAdapters from './pages/SDKAdapters.jsx';
import KitErrors from './pages/KitErrors.jsx';
import Theming from './pages/Theming.jsx';
import Examples from './pages/Examples.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Compatibility from './pages/Compatibility.jsx';

/* Intercept internal <a href="/route"> clicks → client-side navigation, so pages
   can keep plain anchors (conversion = href value only). External / new-tab /
   modified clicks fall through to the browser. */
function LinkInterceptor() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/') || a.target === '_blank') return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [navigate]);
  return null;
}

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Placeholder({ title }) {
  return (
    <DocsPage active={title}>
      <h1 className="dx-h1">{title}</h1>
      <p className="dx-lead">This page is being written.</p>
    </DocsPage>
  );
}

export default function App() {
  return (
    <>
      <LinkInterceptor />
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Introduction />} />
        <Route path="/quickstart" element={<Quickstart />} />
        <Route path="/components" element={<Overview />} />
        <Route path="/components/create" element={<Create />} />
        <Route path="/components/sign" element={<Sign />} />
        <Route path="/components/recover" element={<Recover />} />
        <Route path="/components/connect" element={<NewComponents />} />
        <Route path="/components/add-device" element={<NewComponents />} />
        <Route path="/components/primitives" element={<Primitives />} />
        <Route path="/sdk" element={<SDK />} />
        <Route path="/sdk/create" element={<SDKCreate />} />
        <Route path="/sdk/sign" element={<SDKSign />} />
        <Route path="/sdk/recover" element={<SDKRecover />} />
        <Route path="/sdk/adapters" element={<SDKAdapters />} />
        <Route path="/sdk/errors" element={<KitErrors />} />
        <Route path="/theming" element={<Theming />} />
        <Route path="/examples" element={<Examples />} />
        <Route path="/compatibility" element={<Compatibility />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/security" element={<Security />} />
        <Route path="*" element={<Placeholder title="Page not found" />} />
      </Routes>
    </>
  );
}
