import { registerSW } from 'virtual:pwa-register';
import { renderApp } from './ui/app';
import { showUpdateBar } from './ui/update-bar';
import './ui/style.css';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app root missing from index.html');
renderApp(root);

const updateSW = registerSW({
  onNeedRefresh: () => showUpdateBar(() => updateSW(true)),
  // Browsers only re-check the service worker on navigation, so a long-open tab or installed app would never see a deploy.
  onRegisteredSW: (_url, registration) => {
    if (!registration) return;
    setInterval(() => registration.update(), UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});
