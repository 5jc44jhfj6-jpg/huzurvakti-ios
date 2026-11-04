/* ══════════════════════════════════════════════════════════════
   NAMAZ DOSTU — Service Worker (v66.4)
   iOS/Safari uyumlu çevrimdışı çekirdek:
   • Çekirdek dosyalar kurulumda önbelleğe alınır (tek tek; biri
     başarısız olsa bile diğerleri kaydolur).
   • v66.4 — "Wi-Fi'de açılmıyor, mobil veride açılıyor" düzeltmesi:
     Bazı Wi-Fi ağlarında bağlantı hata vermeden ASILI kalıyordu.
     Eski sürüm her dosyayı önce ağdan istediği için uygulama açılış
     ekranında dakikalarca bekliyordu. Artık:
       – Sayfa açılışı: ağ 3,5 sn içinde cevap vermezse önbellekteki
         sayfa açılır (ağ cevabı gelince arka planda önbellek tazelenir).
       – Sürüm etiketli kendi dosyalarımız (app.js?v=… gibi) değişmez →
         doğrudan önbellekten, ağa hiç takılmadan.
       – Etiketsiz kendi dosyalarımız (arka plan resmi, ezan sesi):
         önbellekten anında, arka planda tazelenir.
       – Yazı tipleri (Google Fonts): önce önbellek.
       – Dış servisler (vakit/Kur'an API): ağ takılırsa 10 sn sonra
         önbellekteki son cevap kullanılır.
       – Ses akışları (Range istekleri) tarayıcıya bırakılır; kendi
         ezan/zil sesimiz çevrimdışıyken önbellekten parça parça verilir.
   ══════════════════════════════════════════════════════════════ */
const CACHE_NAME = 'namaz-dostu-v66.4';

// Sürüm etiketli çekirdek dosyalar (sayfanın gerçekte istediği URL'ler)
const V = '66.4.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=' + V,
  './cities.js?v=' + V,
  './data.js?v=' + V,
  './content.js?v=' + V,
  './hadisler.js?v=' + V,
  './app.js?v=' + V,
  './features.js?v=' + V,
  './manifest.json',
  './icon-192.png?v=60',
  './icon-512.png?v=60',
  './apple-touch-icon.png?v=' + V,
  './favicon-32.png?v=' + V,
  './bg-mosque.jpg',
  './zil.mp3',
  './ezan.mp3'   // kendi ezan sesi — çevrimdışı da çalar (v64.8)
];

const SAYFA_SURE = 3500;   // sayfa açılışında ağı en fazla bu kadar bekle (ms)
const DOSYA_SURE = 8000;   // eski sürümü elimizde olan dosya için ağ bekleme sınırı
const DIS_SURE = 10000;    // dış servisler için ağ bekleme sınırı

// ─── Kurulum: çekirdek dosyaları tek tek önbelleğe al ───
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      )
    )
  );
});

// ─── Aktivasyon: eski önbellekleri temizle ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Yardımcılar ───
// Ağ isteği; "ms" içinde başlık gelmezse zaman aşımı hatası verir
// (ağ isteği arka planda sürer, gelirse önbelleğe yine yazılır).
function zamanli(istek, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('zaman-asimi')), ms);
    fetch(istek).then(
      (r) => { clearTimeout(t); resolve(r); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function sakla(istek, cevap) {
  if (!cevap || cevap.status !== 200 || cevap.type === 'opaque') return;
  const kopya = cevap.clone();
  caches.open(CACHE_NAME).then((c) => c.put(istek, kopya)).catch(() => {});
}

// Önbellekteki tam dosyadan "Range: bytes=a-b" isteğine 206 parça cevabı üretir
// (Safari, ses dosyalarını yalnızca parça parça oynatır).
async function parcaCevap(istek, tam) {
  try {
    const aralik = istek.headers.get('range') || '';
    const m = /bytes=(\d*)-(\d*)/.exec(aralik);
    const tampon = await tam.arrayBuffer();
    const boy = tampon.byteLength;
    let bas = 0, son = boy - 1;
    if (m) {
      if (m[1] === '' && m[2] !== '') { bas = Math.max(0, boy - parseInt(m[2], 10)); }
      else {
        bas = parseInt(m[1] || '0', 10);
        if (m[2] !== '') son = Math.min(parseInt(m[2], 10), boy - 1);
      }
    }
    if (bas > son || bas >= boy) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + boy } });
    }
    const parca = tampon.slice(bas, son + 1);
    return new Response(parca, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': tam.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Range': 'bytes ' + bas + '-' + son + '/' + boy,
        'Content-Length': String(parca.byteLength),
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (e) {
    return Response.error();
  }
}

function sayfaYedek(istek) {
  return caches.match(istek, { ignoreSearch: true })
    .then((h) => h || caches.match('./index.html', { ignoreSearch: true }))
    .then((h) => h || caches.match('./', { ignoreSearch: true }));
}

// 1) Sayfa açılışı: ağ öncelikli ama en fazla SAYFA_SURE bekle
function sayfaAc(event) {
  const istek = event.request;
  let anahtar = istek;
  try { const u = new URL(istek.url); anahtar = new Request(u.origin + u.pathname); } catch (e) {}

  const ag = fetch(istek).then((cevap) => {
    if (cevap && cevap.ok && !cevap.redirected) {
      const kopya = cevap.clone();
      caches.open(CACHE_NAME).then((c) => c.put(anahtar, kopya)).catch(() => {});
    }
    return cevap;
  });
  // Cevap geç gelse bile önbelleğe yazılabilsin diye SW'yi ayakta tut
  try { event.waitUntil(ag.then(() => null, () => null)); } catch (e) {}

  return new Promise((resolve) => {
    let bitti = false;
    const bitir = (c) => { if (!bitti && c) { bitti = true; resolve(c); } };
    const t = setTimeout(() => { sayfaYedek(istek).then(bitir); }, SAYFA_SURE);
    ag.then((cevap) => {
      if (bitti) return;
      if (cevap && cevap.status >= 500) {
        // sunucu hatası → elde önceki sayfa varsa onu aç
        sayfaYedek(istek).then((h) => { clearTimeout(t); bitir(h || cevap); });
        return;
      }
      clearTimeout(t); bitir(cevap);
    }).catch(() => {
      sayfaYedek(istek).then((h) => { clearTimeout(t); bitir(h || Response.error()); });
    });
  });
}

// 2) Kendi dosyalarımız
async function kendiDosya(event, url) {
  const istek = event.request;
  const c = await caches.open(CACHE_NAME);

  // Ses dosyası parça isteği (Range): önce ağ; ağ yoksa önbellekten 206 parça
  if (istek.headers.has('range')) {
    const tam = await c.match(istek, { ignoreSearch: true });
    if (!tam) return fetch(istek);
    try { return await zamanli(istek, DOSYA_SURE); }
    catch (e) { return parcaCevap(istek, tam); }
  }

  // meal.js (1 MB, içerik değişmez): sürüm etiketi değişse de önbellektekini kullan
  if (url.pathname.endsWith('/meal.js')) {
    const h = await c.match(istek, { ignoreSearch: true });
    if (h) return h;
    const cevap = await fetch(istek);
    sakla(istek, cevap);
    return cevap;
  }

  // Birebir aynı sürüm önbellekte varsa → anında
  const tam = await c.match(istek);
  if (tam) {
    if (!url.search) {
      // Etiketsiz dosya (ör. bg-mosque.jpg): arka planda sessizce tazele
      try { event.waitUntil(fetch(istek).then((r) => sakla(istek, r)).catch(() => {})); } catch (e) {}
    }
    return tam;
  }

  // Elde aynı dosyanın ESKİ sürümü var mı? Varsa ağ takılırsa onu ver.
  const eski = await c.match(istek, { ignoreSearch: true });
  if (eski) {
    try {
      const cevap = await zamanli(istek, DOSYA_SURE);
      if (cevap && cevap.status === 200) { sakla(istek, cevap); return cevap; }
      return eski;
    } catch (e) {
      return eski;
    }
  }

  // Hiç yok → ağdan al, önbelleğe yaz
  const cevap = await fetch(istek);
  sakla(istek, cevap);
  return cevap;
}

// 3) Yazı tipleri: önce önbellek
async function yaziTipi(istek) {
  const h = await caches.match(istek);
  if (h) return h;
  try {
    const cevap = await fetch(istek);
    sakla(istek, cevap);
    return cevap;
  } catch (e) {
    return Response.error();
  }
}

// 4) Dış servisler (API): ağ, takılırsa/yoksa önbellekteki son cevap
async function disServis(istek) {
  const h = await caches.match(istek);
  try {
    const cevap = h ? await zamanli(istek, DIS_SURE) : await fetch(istek);
    sakla(istek, cevap);
    return cevap;
  } catch (e) {
    return h || Response.error();
  }
}

// ─── İstek yakalama ───
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  const sameOrigin = url.origin === self.location.origin;

  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (sameOrigin && isNavigation) {
    event.respondWith(sayfaAc(event));
    return;
  }

  if (sameOrigin) {
    event.respondWith(kendiDosya(event, url).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((h) => h || Response.error())
    ));
    return;
  }

  // Dış ses/video akışları (Kur'an dinleme vb.): hiç karışma, tarayıcı kendisi yönetsin
  const ses = req.headers.has('range') || req.destination === 'audio' || req.destination === 'video' ||
    /\.(mp3|m4a|aac|ogg|wav|mp4)$/i.test(url.pathname);
  if (ses) return;

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(yaziTipi(req));
    return;
  }

  if (isNavigation) return;   // dış sitelere gidiş: dokunma

  event.respondWith(disServis(req));
});
