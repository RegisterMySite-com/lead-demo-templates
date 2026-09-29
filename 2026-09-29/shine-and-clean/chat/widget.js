(() => {
  const run = async () => {
    try {
      const [css, body] = await Promise.all([
        fetch('chat/widget.css').then(r => r.text()),
        fetch('chat/widget-body.html').then(r => r.text()),
      ]);
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      const wrap = document.createElement('div');
      wrap.innerHTML = body;
      for (const n of [...wrap.childNodes]) document.body.appendChild(n);
    } catch (e) {
      console.error(e);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
