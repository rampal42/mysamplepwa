const button = document.getElementById('clickMe');
const output = document.getElementById('output');

button.addEventListener('click', () => {
  const now = new Date().toLocaleTimeString();
  output.textContent = `Button tapped at ${now}`;
});
