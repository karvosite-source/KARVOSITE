(() => {
  const pixelId = '1462580952522141';

  if (!window.fbq) {
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  }

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');

  const track = (eventName, payload = {}) => {
    if (window.fbq) window.fbq('track', eventName, payload);
  };

  document.addEventListener('click', (event) => {
    const target = event.target.closest('a,button');
    if (!target) return;

    const href = target.getAttribute('href') || '';
    const label = (target.innerText || target.getAttribute('aria-label') || '').trim().slice(0, 120);

    if (href.startsWith('tel:')) {
      track('Contact', { content_name: 'Phone click', method: 'phone' });
      track('Lead', { content_name: 'Phone enquiry' });
      return;
    }

    if (href.startsWith('mailto:')) {
      track('Contact', { content_name: 'Email click', method: 'email' });
      track('Lead', { content_name: 'Email enquiry' });
      return;
    }

    if (href.includes('wa.me') || /whatsapp/i.test(label)) {
      track('Contact', { content_name: 'WhatsApp click', method: 'whatsapp' });
      track('Lead', { content_name: 'WhatsApp enquiry' });
      return;
    }

    if (/quote|basket|request|enquiry|place order|pay online/i.test(label)) {
      track('Lead', { content_name: label || 'KARVO enquiry action' });
    }
  });
})();
