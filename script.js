const LIMITS = {
  temp:     50,
  gas:    5000,
  current: 7.5,
  prox:    400,
  speed:   100
};

document.addEventListener('DOMContentLoaded', () => {
  /* ---------- DOM refs ---------- */
  const $ = id => document.getElementById(id);
  const conn = $('connection-status');
  const el = {
    tArc: $('temp-arc'), hArc: $('hum-arc'),
    tTxt: $('temp-text'), hTxt: $('hum-text'),
    gas: $('gas-bar'),   gasTxt: $('gas-text'),
    currTxt: $('current-text'),
    proxTxt: $('proximity-text'),
    spdTxt: $('speed-text'), needle: $('needle'),
    spdArc: $('speed-arc'),
    gpsTxt: $('gps-text'), satTxt: $('satellites-text')
  };

  /* ---------- Leaflet ---------- */
  const map = L.map('gps-map').setView([44.4268,26.1025], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  const marker = L.marker([44.4268,26.1025]).addTo(map);

  /* ---------- SSE ---------- */
  if (window.EventSource) {
    const sse = new EventSource('/events');
    sse.onopen  = () => { conn.textContent = 'Conectat'; conn.classList.add('conn-ok'); };
    sse.onerror = () => { conn.textContent = 'Deconectat'; conn.classList.remove('conn-ok'); };

    sse.addEventListener('telemetry_update', e => {
      const d = JSON.parse(e.data);

      // 1 temperature / humidity gauges
      updateArc(el.tArc, d.temperature, LIMITS.temp);
      updateArc(el.hArc, d.humidity,   100);
      el.tTxt.textContent = `${d.temperature.toFixed(1)} °C`;
      el.hTxt.textContent = `${d.humidity.toFixed(0)} %`;

      // 2 air-quality bar
      const gasPct = Math.min(d.gasValue, LIMITS.gas) / LIMITS.gas * 100;
      el.gas.style.width = gasPct + '%';
      el.gasTxt.textContent = `Moderată (${Math.round(d.gasValue)} PPM)`;

      // 3 current / proximity
      el.currTxt.textContent = `${d.current.toFixed(2)} A`;
      el.proxTxt.textContent = `${d.distance.toFixed(1)} cm`;

      // 4 speed gauge
      const spd = Math.min(d.speedKmph, LIMITS.speed);
      el.spdTxt.textContent = `${spd.toFixed(0)} km/h`;
      const deg = -90 + (spd / LIMITS.speed) * 180;   // -90° … +90°
      el.needle.style.transform = `rotate(${deg}deg)`;
      updateArc(el.spdArc, spd, LIMITS.speed);

      // 5 GPS
      if (d.latitude && d.longitude) {
        el.gpsTxt.textContent = `Lat:${d.latitude.toFixed(4)}, Lon:${d.longitude.toFixed(4)}`;
        el.satTxt.textContent = `Sateliți: ${d.satellites}`;
        marker.setLatLng([d.latitude, d.longitude]);
        map.panTo([d.latitude, d.longitude]);
      }
    });
  }

  function updateArc(path, value, max) {
    const pct = Math.min(value, max) / max;
    const len = path.dataset.len || path.getTotalLength();
    path.dataset.len = len;
    path.style.strokeDasharray  = len;
    path.style.strokeDashoffset = len * (1 - pct);
    const hue = 120 - pct * 120;             // green -> red
    path.style.stroke = `hsl(${hue}, 70%, 50%)`;
  }

  /* ---------- helpers ---------- */
  const send = c => fetch(c).catch(console.error);

  /* ---------- touch / mouse pad ---------- */
  document.querySelectorAll('.arrow').forEach(btn => {
    const cmd = btn.dataset.cmd;
    btn.addEventListener('pointerdown', () => send(cmd));
    btn.addEventListener('pointerup',   () => send('/stop'));
  });

  /* ---------- keyboard WASD ---------- */
  const kMap = { KeyW:'/forward', KeyA:'/left', KeyS:'/backward', KeyD:'/right' };
  const held = new Set();
  window.addEventListener('keydown', e => {
    if (!kMap[e.code] || held.has(e.code)) return;
    held.add(e.code); send(kMap[e.code]);
  });
  window.addEventListener('keyup', e => {
    if (!kMap[e.code]) return;
    held.delete(e.code);
    if (held.size === 0) send('/stop');
  });

  /* ---------- speed slider ---------- */
  const slider = $('speed-slider'), val = $('speed-val');
  slider.addEventListener('input', e => {
    val.textContent = e.target.value;
    send(`/setSpeed?value=${e.target.value}`);
  });
});
