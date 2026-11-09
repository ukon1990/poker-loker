/** Fades out the logo screen from index.html once the app has something to show. */
export function hideBootSplash() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('done');
  window.setTimeout(() => boot.remove(), 250);
}
