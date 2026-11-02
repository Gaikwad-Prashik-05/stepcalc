import { registerSW } from 'virtual:pwa-register';
import { renderApp } from './ui/app';
import { showUpdateBar } from './ui/update-bar';
import './ui/style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app root missing from index.html');
renderApp(root);

const updateSW = registerSW({
  onNeedRefresh: () => showUpdateBar(() => updateSW(true)),
});
