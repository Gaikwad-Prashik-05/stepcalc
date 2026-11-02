import { evaluate } from '../core/evaluate';

export function renderApp(root: HTMLElement): void {
  const h1 = document.createElement('h1');
  h1.textContent = 'StepCalc';
  const tagline = document.createElement('p');
  tagline.className = 'tagline';
  tagline.textContent = 'Show my work';
  const wiring = document.createElement('p');
  wiring.className = 'wiring';
  wiring.textContent = `1 + 1 = ${evaluate('1 + 1')}`;
  root.replaceChildren(h1, tagline, wiring);
}
