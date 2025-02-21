import './patch-local-storage-for-github-pages';
import './polyfills';
import eruda from "eruda";

import React, {StrictMode} from 'react'
import {render} from 'react-dom';
import App from './App'
import './index.scss'
import {runSingleInstance} from "./utils/run-signle-instance";

// Eruda'yı başlat ve görünür yap
const el = document.createElement('div');
document.body.appendChild(el);
eruda.init({
  container: el,
  tool: ['console', 'elements', 'network', 'resources', 'info'],
  useShadowDom: true,
  autoScale: true,
  defaults: {
    displaySize: 50,
    transparency: 0.9,
    theme: 'Dark'
  }
});

// Eruda'yı her zaman görünür yap
eruda.show();

async function enableMocking() {
  const host = document.baseURI.replace(/\/$/, '');

  return new Promise(async (resolve) => {
    const {worker} = await import('./server/worker');

    const startMockWorker = () => worker.start({
      onUnhandledRequest: 'bypass',
      quiet: false,
      serviceWorker: {
        url: `${import.meta.env.VITE_GH_PAGES ? '/demo-dapp-with-react-ui' : ''}/mockServiceWorker.js`
      }
    });
    let serviceWorkerRegistration: ServiceWorkerRegistration | null | void = await startMockWorker();
    resolve(serviceWorkerRegistration);

    const verifyAndRestartWorker = runSingleInstance(async () => {
      try {
        const serviceWorkerRegistrations = await navigator.serviceWorker?.getRegistrations() || [];

        const isServiceWorkerOk = serviceWorkerRegistrations.length > 0;
        const isApiOk = await fetch(`${host}/api/healthz`)
          .then(r => r.status === 200 ? r.json().then(p => p.ok).catch(() => false) : false)
          .catch(() => false);

        if (!isServiceWorkerOk || !isApiOk) {
          await serviceWorkerRegistration?.unregister().catch(() => {});
          serviceWorkerRegistration = await startMockWorker().catch(() => null);
        }
      } catch (error) {
        console.error('Error in verifyAndRestartWorker:', error);
        serviceWorkerRegistration = await startMockWorker().catch(() => null);
      }
    });

    setInterval(verifyAndRestartWorker, 1_000);
  });
}

enableMocking().then(() => render(
  <StrictMode>
    <App/>
  </StrictMode>,
  document.getElementById('root') as HTMLElement
));
