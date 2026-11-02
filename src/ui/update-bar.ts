export function showUpdateBar(onReload: () => void): void {
  if (document.querySelector('.update-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'Update available';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Reload';
  button.addEventListener('click', onReload);
  bar.append(text, button);
  document.body.append(bar);
}
