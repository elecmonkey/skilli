import { greet } from './greet.js';

const form = document.querySelector('form');
const name = document.querySelector<HTMLInputElement>('#name');
const greeting = document.querySelector<HTMLOutputElement>('#greeting');
const command = document.querySelector<HTMLInputElement>('#install-command');
const download = document.querySelector<HTMLAnchorElement>('#download');
const installerUrl = new URL(
  `${import.meta.env.BASE_URL}downloads/vite-greeter-installer.tgz`,
  window.location.origin,
);

if (!form || !name || !greeting || !command || !download) {
  throw new Error('Missing example page elements.');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  greeting.value = greet(name.value.trim() || 'world');
});

command.value = `npx -y ${installerUrl.href}`;
command.addEventListener('click', () => {
  command.select();
});
download.href = installerUrl.href;
