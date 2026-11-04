/* ========================================================
   Namaz Dostu - Yeni Özellik Mantığı (features.js)
   Mevcut app.js'i değiştirmez; navigateTo() içindeki
   window.FEATURE_ROUTES kancasını kullanır.
   ======================================================== */

/* ══════════ YARDIMCILAR ══════════ */
function hvEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hvToast(title, msg) {
  if (typeof showToastNotification === 'function') showToastNotification(title, msg);
}
// Aranan kelimeyi metin içinde <mark> ile vurgular (XSS güvenli: her parça escape edilir)
function hvHighlight(text, q) {
  const raw = String(text == null ? '' : text);
  if (!q) return hvEsc(raw);
  const ql = q.toLocaleLowerCase('tr');
  const lower = raw.toLocaleLowerCase('tr');
  let out = '', i = 0;
  if (lower.length !== raw.length) return hvEsc(raw); // güvenlik: uzunluk kayması varsa vurgulama
  while (true) {
    const idx = lower.indexOf(ql, i);
    if (idx === -1) { out += hvEsc(raw.slice(i)); break; }
    out += hvEsc(raw.slice(i, idx)) + '<mark class="hl">' + hvEsc(raw.slice(idx, idx + ql.length)) + '</mark>';
    i = idx + ql.length;
  }
  return out;
}
function hvVibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}
function hvLoad(key, def) {
  try { const v = localStorage.getItem('hv_' + key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
}
function hvSave(key, val) {
  try { localStorage.setItem('hv_' + key, JSON.stringify(val)); } catch (e) {}
}
function hvTodayKey(d) {
  const t = d || new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function hvDayIndex(len) {
  // Yıl içindeki güne göre sabit indeks (aynı gün aynı içerik)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const day = Math.floor(diff / 86400000);
  return len ? (day % len) : 0;
}

// Paylaşılan her metnin altına düşen imza (uygulamanın kendini yayması için)
const HV_SHARE_SIG = "\n\n\ud83c\udf19 Namaz Dostu \u2014 namaz vakitleri, ezan, Kur'an, k\u0131ble\nhttps://huzurvaktinamazuygulamasi.vercel.app";

// Paylaşım: Web Share API varsa onu, yoksa WhatsApp'ı kullanır
function hvShareText(text) {
  // Eski satır sonu imzalarını temizle, tek tip imzayı ekle
  const body = String(text || '')
    .replace(/\s*Namaz Dostu\s*\ud83c\udf19\s*$/u, '')
    .replace(/\s*[\u2014-]\s*Namaz Dostu\s*$/u, '')
    .replace(/\s+$/, '');
  const full = body + HV_SHARE_SIG;
  if (navigator.share) {
    navigator.share({ title: 'Namaz Dostu', text: full }).catch(() => {});
  } else {
    const url = 'https://wa.me/?text=' + encodeURIComponent(full);
    window.open(url, '_blank');
  }
}

/* ══════════ HADİS HAVUZU (1000+) ══════════
   HADITHS (41) + KIRK_HADIS (100) + HADIS_HAVUZU (900+) → tek liste,
   tekrarlar metne göre ayıklanır. Ortak biçim: { text, source, ar } */
let _hvAllHadis = null;
function hvAllHadis() {
  if (_hvAllHadis) return _hvAllHadis;
  const seen = new Set();
  const out = [];
  const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/gi, '').slice(0, 80);
  const push = (text, source, ar) => {
    if (!text) return;
    const k = norm(text);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ text: String(text), source: source || 'Hadis-i Şerif', ar: ar || '' });
  };
  if (typeof HADITHS !== 'undefined') HADITHS.forEach(h => push(h.text, h.source, h.ar));
  if (typeof KIRK_HADIS !== 'undefined') KIRK_HADIS.forEach(h => push(h.text, h.source, h.ar));
  if (typeof HADIS_HAVUZU !== 'undefined') HADIS_HAVUZU.forEach(h => push(h.t, h.s, h.a));
  _hvAllHadis = out;
  return out;
}
window.hvAllHadis = hvAllHadis;

/* ══════════ GÜNÜN HADİSİ ══════════
   Her açılışta rastgele bir hadis (bir öncekiyle aynı olmaz);
   karta dokununca da yenisi gelir. */
function hvPickHadis() {
  const all = hvAllHadis();
  if (!all.length) return null;
  let last = -1;
  try { last = parseInt(localStorage.getItem('hv_last_hadis_idx') || '-1', 10); } catch (e) {}
  let idx = Math.floor(Math.random() * all.length);
  if (all.length > 1 && idx === last) idx = (idx + 1 + Math.floor(Math.random() * (all.length - 1))) % all.length;
  try { localStorage.setItem('hv_last_hadis_idx', String(idx)); } catch (e) {}
  return all[idx];
}
function hvRenderHadis(h, animate) {
  if (!h) return;
  const card = document.getElementById('daily-hadis-card');
  const arEl = document.getElementById('daily-hadis-arabic');
  const txtEl = document.getElementById('daily-hadis-text');
  const srcEl = document.getElementById('daily-hadis-source');
  const apply = () => {
    if (arEl) { arEl.textContent = h.ar || ''; arEl.style.display = h.ar ? '' : 'none'; }
    if (txtEl) txtEl.textContent = '"' + h.text + '"';
    if (srcEl) srcEl.textContent = '— ' + h.source;
  };
  if (animate && card) {
    card.classList.add('hadis-swap');
    setTimeout(() => { apply(); card.classList.remove('hadis-swap'); }, 180);
  } else apply();
  window._currentHadis = h;
}
function loadDailyHadis() {
  hvRenderHadis(hvPickHadis(), false);
}
function nextDailyHadis() {
  hvRenderHadis(hvPickHadis(), true);
  if (typeof hvVibrate === 'function') hvVibrate(12);
}
window.nextDailyHadis = nextDailyHadis;
function shareDailyHadis(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const h = window._currentHadis || hvPickHadis();
  if (!h) return;
  hvOpenShareCard({
    badge: '📿 Günün Hadisi',
    arabic: h.ar || '',
    text: h.text,
    source: h.source,
    fallbackText: `📿 Günün Hadisi\n\n"${h.text}"\n— ${h.source}`
  });
}
window.shareDailyHadis = shareDailyHadis;

/* ══════════ GÜNÜN ÂYETİ (v61.8) ══════════
   Ana ekrandaki kart. Yol gösterici 60 âyetlik havuzdan seçer;
   üst üste aynısı gelmez, karta dokununca yenisi gelir.
   (Hadis kartının kodu duruyor; hadisler 1000 Hadis bölümünde.) */
/* Ana ekran kartına çıkacak âyetler — elle seçildi.
   Ölçüt: tek başına anlaşılır (öncesi/sonrası gerekmez), yol gösterici,
   paylaşmaya uygun ve karta sığacak uzunlukta.
   Havuzun tamamı (60 âyet) DAILY_VERSES içinde durmaya devam eder. */
const HV_KART_AYET = [
  '16:90', '2:152', '3:139', '94:5', '13:28', '14:7', '39:53', '67:1',
  '23:1', '10:62', '20:14', '31:17', '73:8', '25:74', '59:22', '42:19',
  '2:153', '6:160', '7:31', '7:199', '8:46', '11:114', '16:97', '16:128',
  '17:37', '17:53', '20:114', '22:77', '23:96', '31:18', '41:34', '42:40',
  '53:39', '55:60', '64:16', '93:9', '2:110', '2:156', '2:172', '2:195',
  '2:263', '2:271', '2:277', '2:280', '3:31', '3:92', '3:104', '3:134',
  '4:86', '4:110', '4:149', '5:35', '7:55', '7:56', '7:180', '7:204',
  '8:2', '8:29', '9:119', '10:57', '11:112', '14:34', '14:40', '16:18',
  '16:53', '16:125', '17:26', '17:36', '17:70', '17:80', '18:46', '19:96',
  '20:132', '21:107', '22:32', '23:118', '25:63', '25:72', '26:80', '28:83',
  '29:2', '29:6', '29:69', '30:60', '31:19', '33:41', '34:39', '35:5',
  '35:15', '36:82', '40:60', '41:33', '42:43', '45:15', '46:13', '47:7',
  '49:6', '49:10', '50:16', '51:56', '55:9', '57:23', '59:18', '60:8',
  '61:3', '62:10', '63:9', '64:11', '74:38', '76:8', '79:40', '87:14',
  '90:17', '92:5', '93:11', '96:1', '98:5', '102:1', '109:6'
];
/* Sıra (v65.1): uygulama her açıldığında günün ÖNCELİKLİ âyetiyle başlar
   ("anlayasınız diye Arapça bir Kur'an indirdik" mealindeki âyetler —
   HV_ONCELIKLI_AYET, data.js). Her gün sıradaki öncelikli âyet ilk gelir; karta
   dokundukça önce öncelikli listenin kalanı, sonra karıştırılmış genel havuz. */
/* v65.5: Ana ekran kartı — yalnızca Kur'an'ın öğüt âyetleri, RASTGELE.
   Havuz: kart âyetleri (HV_KART_AYET + HV_ONCELIKLI_AYET). Her açılışta karışık sıra kurulur;
   karta dokundukça sıradaki gelir.
   v65.6: "Günün Âyeti" — her güne sabit bir âyet (hvGununAyeti); sabah bildirimi bunu gönderir ve
   o günkü İLK açılışta kart bu âyetle başlar (bildirime dokunan aynı âyeti görür), sonrası rastgele. */
let _hvAyetSirasi = null, _hvAyetK = 0;
function hvKaristir(d) { for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; } return d; }
const HV_KART_AZAMI_HARF = 180;   // ana ekran kartına girecek âyetin en fazla harf sayısı
function hvAyetHavuzu() {
  const hepsi = (typeof DAILY_VERSES !== 'undefined') ? DAILY_VERSES : [];
  const oncelik = (typeof HV_ONCELIKLI_AYET !== 'undefined') ? HV_ONCELIKLI_AYET : [];
  let ayetler = hepsi.filter(v => HV_KART_AYET.indexOf(v.surahNumber + ':' + v.ayah) >= 0);
  if (ayetler.length < 10) ayetler = hepsi.slice();
  // v65.6: ana ekran kartı tek ekrana sığsın diye yalnızca 170 harfe kadar olan âyetler (135 âyet); uzunlar kartta çıkmaz
  return ayetler.concat(oncelik).filter(v => (v.turkish || '').length <= HV_KART_AZAMI_HARF).map(v => Object.assign({ tip: 'ayet' }, v));
}
/* Günün âyeti: tarihe göre sabit seçim (aynı gün herkeste aynı âyet; bildirim ile kart birbirini tutar) */
function hvGununAyeti(d) {
  const havuz = hvAyetHavuzu();
  if (!havuz.length) return null;
  const t = d ? new Date(d) : new Date();
  const gun = Math.round(new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() / 86400000);
  return havuz[((gun * 48271) % 2147483647) % havuz.length];
}
window.hvGununAyeti = hvGununAyeti;
function hvAyetSirasiKur() {
  const sira = hvKaristir(hvAyetHavuzu());
  const kimlik = (v) => 'a:' + v.surahNumber + ':' + v.ayah;
  // Günün ilk açılışı → günün âyeti başa (bildirimdeki âyet). Sonraki açılışlar rastgele yerden başlar.
  const bugun = hvTodayKey();
  let ilkAcilis = false;
  try { ilkAcilis = localStorage.getItem('hv_ayet_gun') !== bugun; } catch (e) {}
  let bas = sira.length ? Math.floor(Math.random() * sira.length) : 0;
  if (ilkAcilis) {
    const g = hvGununAyeti();
    const gi = g ? sira.findIndex(v => kimlik(v) === kimlik(g)) : -1;
    if (gi >= 0) bas = gi;
    try { localStorage.setItem('hv_ayet_gun', bugun); } catch (e) {}
  } else {
    // bir önceki açılıştaki ilk kartı tekrarlama
    let son = '';
    try { son = localStorage.getItem('hv_kart_son') || ''; } catch (e) {}
    if (sira.length > 1 && kimlik(sira[bas]) === son) bas = (bas + 1) % sira.length;
  }
  _hvAyetSirasi = sira.slice(bas).concat(sira.slice(0, bas));
  _hvAyetK = 0;
  try { if (_hvAyetSirasi.length) localStorage.setItem('hv_kart_son', kimlik(_hvAyetSirasi[0])); } catch (e) {}
}
function hvAyetSec() {
  if (!_hvAyetSirasi) hvAyetSirasiKur();
  if (!_hvAyetSirasi.length) return null;
  const v = _hvAyetSirasi[_hvAyetK % _hvAyetSirasi.length];
  _hvAyetK++;
  return v;
}
function hvKartKaynak(v) {
  if (!v) return '';
  return v.tip === 'hadis' ? (v.kaynak || 'Hadis-i Şerif') : (v.surah + ' Sûresi, ' + v.ayah + '. Âyet');
}
function hvAyetCiz(v, animasyon) {
  if (!v) return;
  const kart = document.getElementById('daily-ayet-card');
  const ar   = document.getElementById('daily-verse-arabic');
  const tr   = document.getElementById('daily-verse-turkish');
  const src  = document.getElementById('daily-verse-source');
  const bas  = kart ? kart.querySelector('.verse-card-title') : null;
  const uygula = () => {
    // Kartta yalnızca Türkçe metin gösterilir; paylaşım kartında Arapça (varsa) yer alır.
    if (ar) { ar.textContent = ''; ar.style.display = 'none'; }
    if (bas) bas.textContent = v.tip === 'hadis' ? '📿 Günün Hadisi' : '📖 Günün Âyeti';
    const met = (v.turkish || '').trim();
    const tirnakli = /[“”"«»]/.test(met);   // metinde zaten tırnak varsa ekleme
    if (tr)  tr.textContent  = tirnakli ? met : ('"' + met + '"');
    if (src) src.textContent = '— ' + hvKartKaynak(v);
  };
  if (animasyon && kart) {
    kart.classList.add('hadis-swap');
    setTimeout(() => { uygula(); kart.classList.remove('hadis-swap'); }, 180);
  } else uygula();
  window._currentAyet = v;
}
function loadDailyAyet() { hvAyetCiz(hvAyetSec(), false); }
window.loadDailyAyet = loadDailyAyet;
function nextDailyAyet() {
  hvAyetCiz(hvAyetSec(), true);
  if (typeof hvVibrate === 'function') hvVibrate(12);
}
window.nextDailyAyet = nextDailyAyet;

function shareDailyVerse(ev) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const v = window._currentAyet;
  const tr = document.getElementById('daily-verse-turkish');
  const src = document.getElementById('daily-verse-source');
  const hadis = !!(v && v.tip === 'hadis');
  const metin  = v ? v.turkish : (tr ? (tr.textContent || '').replace(/^"|"$/g, '').trim() : '');
  const kaynak = v ? hvKartKaynak(v) : (src ? (src.textContent || '').replace(/^[\s—-]+/, '').trim() : '');
  const rozet = hadis ? '📿 Günün Hadisi' : '📖 Günün Âyeti';
  hvOpenShareCard({
    badge: rozet,
    arabic: v ? (v.arabic || '') : '',   // paylaşımda Arapça (varsa) tam
    text: metin,
    source: kaynak,
    fallbackText: `${rozet}\n\n"${metin}"\n— ${kaynak}`
  });
}
window.shareDailyVerse = shareDailyVerse;

/* ══════════ ÖNEMLİ SURELER ══════════ */
function renderOnemliSureler() {
  const c = document.getElementById('onemli-sureler-content');
  if (!c || typeof ONEMLI_SURELER === 'undefined') return;
  c.innerHTML = ONEMLI_SURELER.map(s => `
    <div class="feature-card onemli-card" onclick="openSurahById(${s.id})">
      <div class="onemli-head">
        <span class="onemli-badge">${s.id}</span>
        <span class="fc-title">${hvEsc(s.name)} Suresi</span>
        <span class="onemli-go">›</span>
      </div>
      <div class="fc-tr">${hvEsc(s.fazilet)}</div>
    </div>
  `).join('');
}
function openSurahById(id) {
  navigateTo('quran');
  const s = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS.find(x => (x.id || x.number) === id) : null;
  setTimeout(() => { if (typeof loadSurahDetail === 'function') loadSurahDetail(id, s); }, 40);
}
window.openSurahById = openSurahById;

/* ══════════ DUA ÖĞRENME (Namaz Duaları + Namazda Okunan Sureler + Arama) ══════════ */
/* renderDuaOgrenme kaldırıldı (v65.0) — yerini 0'dan Dua Öğren (renderSifirdan) aldı */

/* ══════════ ESMAÜL HÜSNA ══════════ */
function renderEsma(filter) {
  const c = document.getElementById('esma-content');
  if (!c || typeof ESMA_UL_HUSNA === 'undefined') return;
  const q = (filter || '').toLocaleLowerCase('tr').trim();
  const list = q ? ESMA_UL_HUSNA.filter(e => e.tr.toLocaleLowerCase('tr').includes(q) || e.meaning.toLocaleLowerCase('tr').includes(q)) : ESMA_UL_HUSNA;
  if (!list.length) { c.innerHTML = '<div class="empty-note">Sonuç bulunamadı.</div>'; return; }
  c.innerHTML = `<div class="esma-grid">${list.map(e => `
    <div class="esma-item">
      <div class="esma-top"><span class="esma-no">${e.no}</span><span class="esma-ar">${e.ar}</span></div>
      <div class="esma-tr">${hvEsc(e.tr)}</div>
      <div class="esma-mean">${hvEsc(e.meaning)}</div>
    </div>`).join('')}</div>`;
}

/* ══════════ SABAH / AKŞAM EZKÂRI ══════════ */
let _ezkarMode = 'sabah';
function switchEzkar(mode) {
  _ezkarMode = mode;
  document.querySelectorAll('#ezkar-switch .seg-btn').forEach(b => b.classList.remove('active'));
  const btns = document.querySelectorAll('#ezkar-switch .seg-btn');
  if (mode === 'sabah' && btns[0]) btns[0].classList.add('active');
  if (mode === 'aksam' && btns[1]) btns[1].classList.add('active');
  renderEzkar();
}
window.switchEzkar = switchEzkar;
function renderEzkar() {
  const c = document.getElementById('ezkar-content');
  if (!c) return;
  const list = _ezkarMode === 'aksam' ? EZKAR_AKSAM : EZKAR_SABAH;
  if (!list) return;
  c.innerHTML = list.map(z => `
    <div class="feature-card">
      <div class="fc-title">${hvEsc(z.title)} <span class="count-badge">${z.count}×</span></div>
      <div class="fc-ar">${z.arabic}</div>
      <div class="fc-ok">🗣️ ${hvEsc(z.okunusu)}</div>
      <div class="fc-tr">${hvEsc(z.turkish)}</div>
    </div>
  `).join('');
}

/* ══════════ GÜNLÜK DUALAR ══════════ */
function renderGunlukDua(filter) {
  const c = document.getElementById('gunluk-dua-content');
  if (!c || typeof GUNLUK_DUALAR === 'undefined') return;
  const q = (filter || '').toLocaleLowerCase('tr').trim();
  const list = q ? GUNLUK_DUALAR.filter(d => d.title.toLocaleLowerCase('tr').includes(q) || (d.tag || '').toLocaleLowerCase('tr').includes(q)) : GUNLUK_DUALAR;
  if (!list.length) { c.innerHTML = '<div class="empty-note">Sonuç bulunamadı.</div>'; return; }
  c.innerHTML = list.map(d => `
    <div class="feature-card">
      <div class="fc-title">📔 ${hvEsc(d.title)}</div>
      <div class="fc-ar">${d.arabic}</div>
      <div class="fc-ok">🗣️ ${hvEsc(d.okunusu)}</div>
      <div class="fc-tr">${hvEsc(d.turkish)}</div>
    </div>
  `).join('');
}

/* ══════════ ZİKİRMATİK ══════════ */
const ZIKIR_PRESETS = [
  { key: 'subhanallah', label: 'Sübhanallah', ar: 'سُبْحَانَ اللّٰه', target: 33 },
  { key: 'elhamdulillah', label: 'Elhamdülillah', ar: 'اَلْحَمْدُ لِلّٰه', target: 33 },
  { key: 'allahuekber', label: 'Allahu Ekber', ar: 'اَللّٰهُ اَكْبَر', target: 33 },
  { key: 'serbest', label: 'Serbest Sayaç', ar: 'لَا إِلٰهَ إِلَّا اللّٰه', target: 0 }
];
let _zikirActive = 0;
let _zikirCount = 0;
function renderZikirmatik() {
  const c = document.getElementById('zikirmatik-content');
  if (!c) return;
  if (!c.dataset.built) {
    c.dataset.built = '1';
    c.innerHTML = `
      <div class="zikir-presets" id="zikir-presets"></div>
      <div class="zikir-display">
        <div class="zikir-ar" id="zikir-ar"></div>
        <div class="zikir-label" id="zikir-label"></div>
        <div class="zikir-count" id="zikir-count">0</div>
        <div class="zikir-target" id="zikir-target"></div>
      </div>
      <button class="zikir-btn-main" id="zikir-btn-main" onclick="zikirTap()">
        <span class="zikir-tap-icon">📿</span><span>ÇEK</span>
      </button>
      <div class="zikir-actions">
        <button class="zikir-mini-btn" onclick="zikirReset()">🔄 Sıfırla</button>
        <button class="zikir-mini-btn" onclick="zikirToggleVibrate()" id="zikir-vib-btn"></button>
      </div>
      <div class="info-note" id="zikir-total-note"></div>`;
    const pw = document.getElementById('zikir-presets');
    pw.innerHTML = ZIKIR_PRESETS.map((p, i) => `<button class="zikir-preset" data-i="${i}" onclick="zikirSelect(${i})">${p.label}</button>`).join('');
  }
  zikirSelect(_zikirActive, true);
  updateZikirVibBtn();
  updateZikirTotalNote();
}
function zikirSelect(i, keep) {
  _zikirActive = i;
  if (!keep) _zikirCount = 0;
  else _zikirCount = hvLoad('zikir_c_' + ZIKIR_PRESETS[i].key, 0);
  document.querySelectorAll('.zikir-preset').forEach(b => b.classList.toggle('active', parseInt(b.dataset.i) === i));
  const p = ZIKIR_PRESETS[i];
  const arEl = document.getElementById('zikir-ar');
  const lbl = document.getElementById('zikir-label');
  const tgt = document.getElementById('zikir-target');
  if (arEl) arEl.textContent = p.ar;
  if (lbl) lbl.textContent = p.label;
  if (tgt) tgt.textContent = p.target ? `Hedef: ${p.target}` : 'Serbest';
  updateZikirCountUI();
}
window.zikirSelect = zikirSelect;
function zikirTap() {
  _zikirCount++;
  const p = ZIKIR_PRESETS[_zikirActive];
  hvSave('zikir_c_' + p.key, _zikirCount);
  let total = hvLoad('zikir_total', 0) + 1;
  hvSave('zikir_total', total);
  if (hvLoad('zikir_vibrate', true)) hvVibrate(20);
  if (p.target && _zikirCount % p.target === 0) {
    hvVibrate([120, 60, 120]);
    hvToast('📿 Tamamlandı', `${p.label} ${_zikirCount} defa çekildi.`);
  }
  updateZikirCountUI();
  updateZikirTotalNote();
}
window.zikirTap = zikirTap;
function updateZikirCountUI() {
  const el = document.getElementById('zikir-count');
  if (el) el.textContent = _zikirCount;
  const p = ZIKIR_PRESETS[_zikirActive];
  const tgt = document.getElementById('zikir-target');
  if (tgt && p.target) {
    const set = Math.floor(_zikirCount / p.target);
    tgt.textContent = `Hedef: ${p.target}  •  Tur: ${set}`;
  }
}
function zikirReset() {
  _zikirCount = 0;
  hvSave('zikir_c_' + ZIKIR_PRESETS[_zikirActive].key, 0);
  updateZikirCountUI();
  hvToast('🔄 Sıfırlandı', 'Sayaç sıfırlandı.');
}
window.zikirReset = zikirReset;
function zikirToggleVibrate() {
  const v = !hvLoad('zikir_vibrate', true);
  hvSave('zikir_vibrate', v);
  updateZikirVibBtn();
}
window.zikirToggleVibrate = zikirToggleVibrate;
function updateZikirVibBtn() {
  const b = document.getElementById('zikir-vib-btn');
  if (b) b.textContent = hvLoad('zikir_vibrate', true) ? '📳 Titreşim: Açık' : '📴 Titreşim: Kapalı';
}
function updateZikirTotalNote() {
  const n = document.getElementById('zikir-total-note');
  if (n) n.textContent = `Toplam çekilen zikir: ${hvLoad('zikir_total', 0)}`;
}

/* ══════════ NAMAZ TAKİBİ ══════════ */
const NAMAZ_VAKITLERI = [
  { key: 'sabah', label: 'Sabah' },
  { key: 'ogle', label: 'Öğle' },
  { key: 'ikindi', label: 'İkindi' },
  { key: 'aksam', label: 'Akşam' },
  { key: 'yatsi', label: 'Yatsı' }
];
function renderNamazTakibi() {
  const c = document.getElementById('namaz-takibi-content');
  if (!c) return;
  const data = hvLoad('namaz_takip', {});
  const today = hvTodayKey();
  const t = data[today] || {};
  const doneToday = NAMAZ_VAKITLERI.filter(v => t[v.key]).length;

  // Bugünkü işaretleme
  let rows = NAMAZ_VAKITLERI.map(v => `
    <button class="prayer-check-row ${t[v.key] ? 'checked' : ''}" onclick="toggleNamaz('${v.key}')">
      <span class="pc-label">${v.label}</span>
      <span class="pc-box">${t[v.key] ? '✓' : ''}</span>
    </button>`).join('');

  // Haftalık grid (son 7 gün)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = hvTodayKey(d);
    const rec = data[key] || {};
    const cnt = NAMAZ_VAKITLERI.filter(v => rec[v.key]).length;
    days.push({ label: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][d.getDay()], cnt, full: cnt === 5, isToday: i === 0 });
  }
  const streak = calcNamazStreak(data);

  c.innerHTML = `
    <div class="takip-summary">
      <div class="ts-big">${doneToday}/5</div>
      <div class="ts-label">Bugün kılınan vakit</div>
    </div>
    <div class="prayer-check-list">${rows}</div>
    <div class="streak-box">🔥 <b>${streak}</b> günlük seri (kesintisiz 5 vakit)</div>
    <div class="section-mini-title">📅 Son 7 Gün</div>
    <div class="week-grid">
      ${days.map(d => `<div class="week-day ${d.full ? 'full' : ''} ${d.isToday ? 'today' : ''}">
        <div class="wd-label">${d.label}</div>
        <div class="wd-dot">${d.cnt}</div>
      </div>`).join('')}
    </div>
    ${hvNamazIstatistikHtml(data)}`;
}
/* İstatistik: son 8 hafta yüzde çubukları, bu ay, en uzun seri, toplam (v65.1) */
function hvNamazIstatistikHtml(data) {
  const haftalar = [];
  for (let h = 7; h >= 0; h--) {
    let kilinan = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - (h * 7 + i));
      const rec = data[hvTodayKey(d)] || {};
      kilinan += NAMAZ_VAKITLERI.filter(v => rec[v.key]).length;
    }
    haftalar.push(Math.round(kilinan / 35 * 100));
  }
  const now = new Date(); const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let ayKilinan = 0, ayGun = now.getDate();
  Object.keys(data).forEach(k => { if (k.startsWith(ym)) ayKilinan += NAMAZ_VAKITLERI.filter(v => data[k][v.key]).length; });
  const ayYuzde = Math.round(ayKilinan / (ayGun * 5) * 100);
  let toplam = 0; Object.keys(data).forEach(k => { toplam += NAMAZ_VAKITLERI.filter(v => data[k][v.key]).length; });
  // en uzun seri
  const gunler = Object.keys(data).filter(k => NAMAZ_VAKITLERI.every(v => data[k][v.key])).sort();
  let enUzun = 0, cur = 0, prev = null;
  gunler.forEach(k => { const t = new Date(k + 'T00:00:00').getTime(); cur = (prev !== null && t - prev === 86400000) ? cur + 1 : 1; enUzun = Math.max(enUzun, cur); prev = t; });
  const rozet = enUzun >= 40 ? '🏆 40 gün' : enUzun >= 30 ? '🥇 30 gün' : enUzun >= 7 ? '🥈 7 gün' : enUzun >= 3 ? '🥉 3 gün' : '—';
  return `
    <div class="section-mini-title">📊 İstatistik</div>
    <div class="hatim-stat">
      <div class="hs-item"><div class="hs-num">%${isNaN(ayYuzde) ? 0 : ayYuzde}</div><div class="hs-lbl">Bu ay</div></div>
      <div class="hs-item"><div class="hs-num">${enUzun}</div><div class="hs-lbl">En uzun seri</div></div>
      <div class="hs-item"><div class="hs-num">${toplam.toLocaleString('tr-TR')}</div><div class="hs-lbl">Toplam vakit</div></div>
    </div>
    <div class="nt-grafik-baslik">Son 8 hafta (haftalık % kılınan)</div>
    <div class="nt-grafik">${haftalar.map((y, i) => `<div class="nt-cubuk-kap"><div class="nt-cubuk" style="height:${Math.max(4, y)}%" title="%${y}"></div><div class="nt-cubuk-etiket">${i === 7 ? 'Bu hafta' : (7 - i) + 'h önce'}</div><div class="nt-cubuk-deger">%${y}</div></div>`).join('')}</div>
    <div class="streak-box">🎖️ Rozet: <b>${rozet}</b> <span style="font-weight:400;color:var(--text-muted);font-size:.8rem;">(3 · 7 · 30 · 40 gün kesintisiz 5 vakit)</span></div>`;
}
function toggleNamaz(key) {
  const data = hvLoad('namaz_takip', {});
  const today = hvTodayKey();
  if (!data[today]) data[today] = {};
  data[today][key] = !data[today][key];
  hvSave('namaz_takip', data);
  renderNamazTakibi();
  hvVibrate(15);
}
window.toggleNamaz = toggleNamaz;

function calcNamazStreak(data) {
  let streak = 0;
  const d = new Date();
  // Bugün tamamlanmadıysa dünden başla
  const todayRec = data[hvTodayKey(d)] || {};
  const todayFull = NAMAZ_VAKITLERI.every(v => todayRec[v.key]);
  if (!todayFull) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const rec = data[hvTodayKey(d)] || {};
    if (NAMAZ_VAKITLERI.every(v => rec[v.key])) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

/* ══════════ KAZA NAMAZI TAKİBİ ══════════ */
function renderKaza() {
  const c = document.getElementById('kaza-content');
  if (!c) return;
  const data = hvLoad('kaza_takip', { sabah: 0, ogle: 0, ikindi: 0, aksam: 0, yatsi: 0, vitir: 0 });
  const items = [
    { key: 'sabah', label: 'Sabah' }, { key: 'ogle', label: 'Öğle' }, { key: 'ikindi', label: 'İkindi' },
    { key: 'aksam', label: 'Akşam' }, { key: 'yatsi', label: 'Yatsı' }, { key: 'vitir', label: 'Vitir' }
  ];
  const total = items.reduce((s, it) => s + (data[it.key] || 0), 0);
  c.innerHTML = `
    <div class="info-note">Kılamadığınız (kaza) namaz borcunuzu buradan takip edin. Kaza kıldıkça sayıyı azaltın.</div>
    ${items.map(it => `
      <div class="kaza-row">
        <span class="kaza-label">${it.label}</span>
        <div class="counter-group">
          <button class="counter-btn minus" onclick="kazaAdjust('${it.key}',-1)">−</button>
          <span class="counter-val" id="kaza-${it.key}">${data[it.key] || 0}</span>
          <button class="counter-btn plus" onclick="kazaAdjust('${it.key}',1)">+</button>
        </div>
      </div>`).join('')}
    <div class="kaza-total">Toplam Kaza Borcu: <b>${total}</b> vakit</div>
    ${total > 0 ? `<div class="kaza-tahmin">Günde 1 günlük kaza (6 vakit) kılarsan yaklaşık <b>${hvKazaSure(Math.ceil(total / 6))}</b> sürer.</div>` : ''}
    <details class="gece-kart kaza-hesap" id="kaza-hesap">
      <summary><span class="gece-ad">🧮 Kaza Borcumu Hesapla</span></summary>
      <div class="gece-ne">Kaç yıllık namaz borcun olduğunu bilmiyorsan buradan yaklaşık hesapla, sonra sayaçlara aktar.</div>
      <div class="kaza-form">
        <label>Doğum yılın <input type="number" id="kz-dogum" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" placeholder="ör. 1985"></label>
        <label>Ergenlik (bülûğ) yaşı
          <select id="kz-bulug"><option value="15">15 (varsayılan)</option><option value="14">14</option><option value="13">13</option><option value="12">12 (erkek, ihtiyat)</option><option value="9">9 (kadın, ihtiyat)</option></select>
        </label>
        <label>Düzenli kılmaya başladığın yıl <input type="number" id="kz-basla" inputmode="numeric" min="1900" max="${new Date().getFullYear()}" placeholder="boş bırak = hâlâ düzenli değil"></label>
        <label>Cinsiyet
          <select id="kz-cins"><option value="e">Erkek</option><option value="k">Kadın (aylık ~6 gün âdet düşülür)</option></select>
        </label>
        <label id="kz-dogum-sayisi-satir" style="display:none">Doğum sayısı (her doğum için 40 gün lohusalık düşülür) <input type="number" id="kz-dogum-sayisi" inputmode="numeric" min="0" max="20" value="0"></label>
        <button class="gold-primary-btn" onclick="hvKazaHesapla()">Hesapla</button>
      </div>
      <div id="kz-sonuc"></div>
    </details>`;
  const cins = document.getElementById('kz-cins');
  if (cins) cins.addEventListener('change', () => { const r = document.getElementById('kz-dogum-sayisi-satir'); if (r) r.style.display = cins.value === 'k' ? '' : 'none'; });
}
function hvKazaSure(gun) {
  if (gun < 30) return gun + ' gün';
  if (gun < 365) return Math.round(gun / 30) + ' ay';
  const y = Math.floor(gun / 365), a = Math.round((gun % 365) / 30);
  return y + ' yıl' + (a ? ' ' + a + ' ay' : '');
}
let _kzSonGun = 0;
function hvKazaHesapla() {
  const dogum = parseInt((document.getElementById('kz-dogum') || {}).value, 10);
  const bulug = parseInt((document.getElementById('kz-bulug') || {}).value, 10) || 15;
  const baslaRaw = (document.getElementById('kz-basla') || {}).value;
  const cins = (document.getElementById('kz-cins') || {}).value || 'e';
  const dogumSayisi = parseInt((document.getElementById('kz-dogum-sayisi') || {}).value, 10) || 0;
  const out = document.getElementById('kz-sonuc');
  const simdi = new Date();
  if (!dogum || dogum < 1900 || dogum > simdi.getFullYear()) { if (out) out.innerHTML = '<div class="empty-note">Doğum yılını gir.</div>'; return; }
  const mukellefBas = new Date(dogum + bulug, simdi.getMonth(), simdi.getDate());
  const bitis = baslaRaw ? new Date(parseInt(baslaRaw, 10), 0, 1) : simdi;
  let gun = Math.round((bitis - mukellefBas) / 86400000);
  if (gun <= 0) { if (out) out.innerHTML = '<div class="info-note">Bu bilgilere göre kaza borcun görünmüyor. 🎉</div>'; _kzSonGun = 0; return; }
  let dusulen = 0;
  if (cins === 'k') dusulen = Math.round(gun * 6 / 30) + dogumSayisi * 40;
  gun = Math.max(0, gun - dusulen);
  _kzSonGun = gun;
  const yil = (gun / 365).toFixed(1);
  if (out) out.innerHTML = `
    <div class="hatim-stat" style="margin-top:10px;">
      <div class="hs-item"><div class="hs-num">${gun.toLocaleString('tr-TR')}</div><div class="hs-lbl">gün (≈ ${yil} yıl)</div></div>
      <div class="hs-item"><div class="hs-num">${(gun * 6).toLocaleString('tr-TR')}</div><div class="hs-lbl">vakit (vitir dâhil)</div></div>
    </div>
    <div class="info-note">Her vakit için <b>${gun.toLocaleString('tr-TR')}</b> kaza: Sabah, Öğle, İkindi, Akşam, Yatsı ve Vitir.${dusulen ? ' Âdet/lohusalık için ' + dusulen.toLocaleString('tr-TR') + ' gün düşüldü.' : ''} Bu bir yaklaşık hesaptır; kesin bilgi için din görevlisine danışabilirsin.</div>
    <button class="gold-primary-btn" style="width:100%;" onclick="hvKazaAktar()">📥 Sayaçlara yaz (${gun.toLocaleString('tr-TR')} × 6)</button>`;
}
function hvKazaAktar() {
  if (!_kzSonGun) return;
  const data = { sabah: _kzSonGun, ogle: _kzSonGun, ikindi: _kzSonGun, aksam: _kzSonGun, yatsi: _kzSonGun, vitir: _kzSonGun };
  hvSave('kaza_takip', data);
  renderKaza();
  hvToast('📥 Aktarıldı', 'Kaza sayaçları hesaba göre ayarlandı. Kıldıkça azalt.');
  const kok = document.getElementById('page-kaza'); const box = kok && kok.querySelector('.hero-frame-box'); if (box) box.scrollTop = 0;
}
window.hvKazaHesapla = hvKazaHesapla; window.hvKazaAktar = hvKazaAktar;
function kazaAdjust(key, delta) {
  const data = hvLoad('kaza_takip', { sabah: 0, ogle: 0, ikindi: 0, aksam: 0, yatsi: 0, vitir: 0 });
  data[key] = Math.max(0, (data[key] || 0) + delta);
  hvSave('kaza_takip', data);
  renderKaza();
  hvVibrate(15);
}
window.kazaAdjust = kazaAdjust;

/* ══════════ HATİM TAKİBİ ══════════ */
const HATIM_TOTAL_PAGES = 604;
function renderHatim() {
  const c = document.getElementById('hatim-content');
  if (!c) return;
  const page = hvLoad('hatim_page', 0);
  const pct = Math.round((page / HATIM_TOTAL_PAGES) * 100);
  const cuz = Math.min(30, Math.max(0, Math.ceil(page / 20.14)));
  c.innerHTML = `
    <div class="info-note">Kaldığınız sayfayı işaretleyerek hatim ilerlemenizi takip edin (Mushaf: 604 sayfa, 30 cüz).</div>
    <div class="hatim-stat">
      <div class="hs-item"><div class="hs-num">${page}</div><div class="hs-lbl">/ 604 Sayfa</div></div>
      <div class="hs-item"><div class="hs-num">${cuz}</div><div class="hs-lbl">/ 30 Cüz</div></div>
      <div class="hs-item"><div class="hs-num">%${pct}</div><div class="hs-lbl">Tamamlandı</div></div>
    </div>
    <div class="hatim-bar-wrap"><div class="hatim-bar" style="width:${pct}%"></div></div>
    <div class="hatim-controls">
      <button class="counter-btn minus" onclick="hatimAdjust(-1)">− Sayfa</button>
      <button class="hatim-add-btn" onclick="hatimAdjust(1)">+ 1 Sayfa Okudum</button>
      <button class="counter-btn plus" onclick="hatimAdjust(20)">+ Cüz</button>
    </div>
    <button class="zikir-mini-btn" style="margin-top:10px;width:100%;" onclick="hatimReset()">🔄 Hatmi Sıfırla</button>
    ${page >= HATIM_TOTAL_PAGES ? '<div class="hatim-done">🎉 Hatminizi tamamladınız! Allah kabul etsin.</div>' : ''}
    ${hvHatimPlanHtml(page)}`;
}
/* Hatim planı: günde 1 cüz (30 gün) ya da seçilen gün sayısı (v65.1) */
function hvHatimPlanHtml(page) {
  const plan = hvLoad('hatim_plan', null);
  const ram = (typeof hvRamazanDurum === 'function') ? hvRamazanDurum() : null;
  if (!plan) {
    return `<details class="gece-kart" style="margin-top:12px;"${ram ? ' open' : ''}>
      <summary><span class="gece-ad">📅 Hatim Planı</span></summary>
      <div class="gece-ne">Günde 1 cüz okuyarak 30 günde hatim bitir. ${ram && ram.durum === 'once' ? `Ramazan'a ${ram.kalan} gün var — plan Ramazan'ın ilk günü başlayacak şekilde kurulabilir.` : ram && ram.durum === 'icinde' ? `Ramazan'ın ${ram.gunNo}. günü — bayrama kadar bitirmek için plan kur.` : 'İstediğin gün sayısını seç.'}</div>
      <div class="hatim-plan-btnler">
        ${ram ? `<button class="gold-primary-btn" onclick="hvHatimPlanKur('ramazan')">🌙 Ramazan hatmi (30 gün)</button>` : ''}
        <button class="gold-outline-btn" onclick="hvHatimPlanKur(30)">Bugün başla · 30 gün</button>
        <button class="gold-outline-btn" onclick="hvHatimPlanKur(60)">Bugün başla · 60 gün</button>
        <button class="gold-outline-btn" onclick="hvHatimPlanKur(90)">Bugün başla · 90 gün</button>
      </div>
    </details>`;
  }
  const bas = new Date(plan.bas + 'T00:00:00'); const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const gunNo = Math.floor((bugun - bas) / 86400000) + 1;
  const gundeSayfa = HATIM_TOTAL_PAGES / plan.gun;
  const hedefSayfa = Math.min(HATIM_TOTAL_PAGES, Math.round(gundeSayfa * Math.max(0, gunNo)));
  const bugunBas = Math.round(gundeSayfa * (gunNo - 1)) + 1, bugunSon = hedefSayfa;
  const fark = page - Math.round(gundeSayfa * Math.max(0, gunNo - 1));   // dünün hedefine göre
  const cuz = Math.min(30, Math.max(1, Math.ceil(bugunSon / 20.14)));
  const bitis = new Date(bas); bitis.setDate(bitis.getDate() + plan.gun - 1);
  let durum = '';
  if (gunNo < 1) durum = `Plan ${Math.abs(gunNo) + 1} gün sonra başlıyor.`;
  else if (gunNo > plan.gun) durum = page >= HATIM_TOTAL_PAGES ? 'Plan tamamlandı 🎉' : 'Plan süresi doldu — kalan sayfaları tamamla.';
  else durum = fark > 0 ? `Plana göre <b>${fark} sayfa ilerdesin</b> 👏` : fark === 0 ? 'Plandasın 👍' : `Plana göre <b>${-fark} sayfa geridesin</b> — bugün biraz fazla oku.`;
  return `<div class="gece-kart" style="margin-top:12px;padding:12px 14px;">
      <div class="gece-alt-baslik" style="margin-top:0">📅 Hatim Planı · ${plan.gun} gün · ${plan.ad || ''}</div>
      <div class="gece-ne">${gunNo >= 1 && gunNo <= plan.gun ? `<b>${gunNo}. gün</b> — bugün: <b>${cuz}. cüz</b> (sayfa ${bugunBas}–${bugunSon})` : ''} ${durum}</div>
      <div class="hatim-bar-wrap"><div class="hatim-bar" style="width:${Math.min(100, Math.round(page / HATIM_TOTAL_PAGES * 100))}%"></div></div>
      <div class="hatim-plan-btnler">
        <button class="gold-primary-btn" onclick="hvHatimBugunOkudum(${bugunSon})">✓ Bugünkü cüzü okudum</button>
        <button class="gold-outline-btn" onclick="hvHatimPlanSil()">Planı kaldır</button>
      </div>
      <div class="ek-vakit-not">Başlangıç ${bas.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · Bitiş ${bitis.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</div>
    </div>`;
}
function hvHatimPlanKur(tur) {
  let bas = new Date(); bas.setHours(0, 0, 0, 0); let gun = 30, ad = '';
  if (tur === 'ramazan') {
    const ram = hvRamazanDurum();
    if (ram) { bas = new Date(ram.baslangic + 'T00:00:00'); gun = ram.toplam || 30; ad = 'Ramazan'; }
  } else gun = parseInt(tur, 10) || 30;
  const ymd = bas.getFullYear() + '-' + String(bas.getMonth() + 1).padStart(2, '0') + '-' + String(bas.getDate()).padStart(2, '0');
  hvSave('hatim_plan', { bas: ymd, gun: gun, ad: ad });
  if (tur === 'ramazan' || tur === 30) { /* hatim sıfırdan başlasın */ }
  renderHatim();
  hvToast('📅 Plan kuruldu', 'Günde ' + (Math.round(HATIM_TOTAL_PAGES / gun * 10) / 10) + ' sayfa okuyarak ' + gun + ' günde hatim.');
}
function hvHatimBugunOkudum(hedef) {
  const page = hvLoad('hatim_page', 0);
  hvSave('hatim_page', Math.max(page, Math.min(HATIM_TOTAL_PAGES, hedef)));
  renderHatim(); hvVibrate(15);
}
function hvHatimPlanSil() { hvSave('hatim_plan', null); renderHatim(); }
window.hvHatimPlanKur = hvHatimPlanKur; window.hvHatimBugunOkudum = hvHatimBugunOkudum; window.hvHatimPlanSil = hvHatimPlanSil;
function hatimAdjust(delta) {
  let page = hvLoad('hatim_page', 0);
  page = Math.max(0, Math.min(HATIM_TOTAL_PAGES, page + delta));
  hvSave('hatim_page', page);
  renderHatim();
  hvVibrate(15);
  if (page >= HATIM_TOTAL_PAGES) hvToast('🎉 Tebrikler', 'Hatminizi tamamladınız!');
}
window.hatimAdjust = hatimAdjust;
function hatimReset() {
  hvSave('hatim_page', 0);
  renderHatim();
}
window.hatimReset = hatimReset;

/* ══════════ ZEKÂT & FİTRE — tek sayfa, iki sekme (v65.1) ══════════ */
function zfSec(tur) {
  const z = document.getElementById('zekat-content'), f = document.getElementById('fitre-content');
  if (z) z.style.display = tur === 'fitre' ? 'none' : '';
  if (f) f.style.display = tur === 'fitre' ? '' : 'none';
  const bz = document.getElementById('zf-zekat'), bf = document.getElementById('zf-fitre');
  if (bz) bz.classList.toggle('active', tur !== 'fitre');
  if (bf) bf.classList.toggle('active', tur === 'fitre');
}
window.zfSec = zfSec;
/* Hicri Takvim sayfası: 📅 Takvim | 🔄 Tarih Çevirici sekmeleri (v65.1) */
function tkSec(tur) {
  const t = document.getElementById('takvim-content'), c = document.getElementById('cevirici-content');
  if (t) t.style.display = tur === 'cevirici' ? 'none' : '';
  if (c) c.style.display = tur === 'cevirici' ? '' : 'none';
  const bt = document.getElementById('tk-takvim'), bc = document.getElementById('tk-cevirici');
  if (bt) bt.classList.toggle('active', tur !== 'cevirici');
  if (bc) bc.classList.toggle('active', tur === 'cevirici');
}
window.tkSec = tkSec;

/* ══════════ ZEKÂT HESAPLAYICI ══════════ */
const NISAB_GRAM_GOLD = 80.18; // 80.18 gr altın
function renderZekat() {
  const c = document.getElementById('zekat-content');
  if (!c) return;
  if (c.dataset.built) return;
  c.dataset.built = '1';
  c.innerHTML = `
    <div class="info-note">Zekât, temel ihtiyaçtan fazla olan ve bir yıl elde kalan mala verilir. Nisab miktarı 80.18 gr altın değeridir. Oran %2,5'tir.</div>
    <div class="calc-form">
      <div class="calc-row"><label>Gram Altın Fiyatı (₺)</label><input type="number" id="z-gold-price" class="calc-input" placeholder="Örn: 3000" oninput="calcZekat()"></div>
      <div class="calc-row"><label>Elinizdeki Altın (gram)</label><input type="number" id="z-gold-gram" class="calc-input" placeholder="Örn: 100" oninput="calcZekat()"></div>
      <div class="calc-row"><label>Nakit / Mevduat (₺)</label><input type="number" id="z-cash" class="calc-input" placeholder="Örn: 50000" oninput="calcZekat()"></div>
      <div class="calc-row"><label>Ticaret Malı / Alacak (₺)</label><input type="number" id="z-trade" class="calc-input" placeholder="Örn: 0" oninput="calcZekat()"></div>
      <div class="calc-row"><label>Borçlarınız (₺)</label><input type="number" id="z-debt" class="calc-input" placeholder="Örn: 0" oninput="calcZekat()"></div>
    </div>
    <div class="calc-result" id="zekat-result">Değerleri girin...</div>`;
}
function calcZekat() {
  const gp = parseFloat(document.getElementById('z-gold-price').value) || 0;
  const gg = parseFloat(document.getElementById('z-gold-gram').value) || 0;
  const cash = parseFloat(document.getElementById('z-cash').value) || 0;
  const trade = parseFloat(document.getElementById('z-trade').value) || 0;
  const debt = parseFloat(document.getElementById('z-debt').value) || 0;
  const res = document.getElementById('zekat-result');
  const totalWealth = (gg * gp) + cash + trade - debt;
  const nisabValue = NISAB_GRAM_GOLD * gp;
  if (gp <= 0) { res.innerHTML = 'Lütfen gram altın fiyatını girin.'; res.className = 'calc-result'; return; }
  if (totalWealth < nisabValue) {
    res.innerHTML = `Toplam servet: <b>${fmtTL(totalWealth)}</b><br>Nisab (80.18 gr altın): <b>${fmtTL(nisabValue)}</b><br><span class="calc-neg">Malınız nisabın altında olduğu için zekât gerekmez.</span>`;
    res.className = 'calc-result';
  } else {
    const zekat = totalWealth * 0.025;
    res.innerHTML = `Zekâta tabi servet: <b>${fmtTL(totalWealth)}</b><br>Nisab: <b>${fmtTL(nisabValue)}</b><hr><div class="calc-big">Vermeniz gereken zekât:<br><span class="calc-amount">${fmtTL(zekat)}</span></div>`;
    res.className = 'calc-result active';
  }
}
window.calcZekat = calcZekat;
function fmtTL(n) {
  return (Math.round(n * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

/* ══════════ FİTRE / FİDYE HESAPLAYICI ══════════ */
function renderFitre() {
  const c = document.getElementById('fitre-content');
  if (!c) return;
  if (c.dataset.built) return;
  c.dataset.built = '1';
  c.innerHTML = `
    <div class="info-note">Fitre (Fıtır Sadakası) Ramazan'da her Müslümana vaciptir. Fidye ise tutulamayan oruç/kılınamayan namaz için verilir. Güncel birim tutarı Diyanet açıklar; aşağıya girin.</div>
    <div class="calc-form">
      <div class="calc-row"><label>Kişi Başı Fitre Tutarı (₺)</label><input type="number" id="f-fitre-birim" class="calc-input" placeholder="Örn: 150" oninput="calcFitre()"></div>
      <div class="calc-row"><label>Evdeki Kişi Sayısı</label><input type="number" id="f-kisi" class="calc-input" placeholder="Örn: 4" oninput="calcFitre()"></div>
    </div>
    <div class="calc-result" id="fitre-result">Değerleri girin...</div>
    <div class="section-mini-title" style="margin-top:16px;">🌾 Fidye Hesabı</div>
    <div class="calc-form">
      <div class="calc-row"><label>Bir Günlük Fidye Tutarı (₺)</label><input type="number" id="f-fidye-birim" class="calc-input" placeholder="Örn: 150" oninput="calcFidye()"></div>
      <div class="calc-row"><label>Tutulamayan Oruç (gün)</label><input type="number" id="f-oruc" class="calc-input" placeholder="Örn: 10" oninput="calcFidye()"></div>
    </div>
    <div class="calc-result" id="fidye-result">Değerleri girin...</div>`;
}
function calcFitre() {
  const birim = parseFloat(document.getElementById('f-fitre-birim').value) || 0;
  const kisi = parseInt(document.getElementById('f-kisi').value) || 0;
  const res = document.getElementById('fitre-result');
  if (birim <= 0 || kisi <= 0) { res.innerHTML = 'Fitre tutarı ve kişi sayısını girin.'; res.className = 'calc-result'; return; }
  res.innerHTML = `<div class="calc-big">Toplam Fitre:<br><span class="calc-amount">${fmtTL(birim * kisi)}</span></div><div style="font-size:.8rem;opacity:.85;">${kisi} kişi × ${fmtTL(birim)}</div>`;
  res.className = 'calc-result active';
}
window.calcFitre = calcFitre;
function calcFidye() {
  const birim = parseFloat(document.getElementById('f-fidye-birim').value) || 0;
  const gun = parseInt(document.getElementById('f-oruc').value) || 0;
  const res = document.getElementById('fidye-result');
  if (birim <= 0 || gun <= 0) { res.innerHTML = 'Fidye tutarı ve gün sayısını girin.'; res.className = 'calc-result'; return; }
  res.innerHTML = `<div class="calc-big">Toplam Fidye:<br><span class="calc-amount">${fmtTL(birim * gun)}</span></div><div style="font-size:.8rem;opacity:.85;">${gun} gün × ${fmtTL(birim)}</div>`;
  res.className = 'calc-result active';
}
window.calcFidye = calcFidye;

/* ══════════ İSLAMİ BİLGİ QUİZİ ══════════ */
const QUIZ_ROUND = 10;
let _quiz = null;
function renderQuizIntro() {
  const c = document.getElementById('quiz-content');
  if (!c || typeof QUIZ_QUESTIONS === 'undefined') return;
  const best = hvLoad('quiz_best', 0);
  c.innerHTML = `
    <div class="quiz-intro">
      <div class="quiz-intro-icon">🧠</div>
      <p>Toplam <b>${QUIZ_QUESTIONS.length}</b> soruluk havuzdan rastgele <b>${QUIZ_ROUND}</b> soru sorulacak.</p>
      <div class="info-note">En yüksek skorunuz: <b>${best}/${QUIZ_ROUND}</b></div>
      <button class="gold-primary-btn" style="margin-top:14px;" onclick="quizStart()">🚀 Teste Başla</button>
    </div>`;
}
function quizStart() {
  const pool = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, QUIZ_ROUND);
  _quiz = { pool, idx: 0, score: 0, answered: false };
  quizRenderQuestion();
}
window.quizStart = quizStart;
function quizRenderQuestion() {
  const c = document.getElementById('quiz-content');
  if (!c || !_quiz) return;
  if (_quiz.idx >= _quiz.pool.length) { quizFinish(); return; }
  const q = _quiz.pool[_quiz.idx];
  c.innerHTML = `
    <div class="quiz-progress"><span>Soru ${_quiz.idx + 1}/${_quiz.pool.length}</span><span>Puan: ${_quiz.score}</span></div>
    <div class="quiz-bar-wrap"><div class="quiz-bar" style="width:${(_quiz.idx / _quiz.pool.length) * 100}%"></div></div>
    <div class="quiz-q">${hvEsc(q.q)}</div>
    <div class="quiz-opts">
      ${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}" onclick="quizAnswer(${i})">${hvEsc(o)}</button>`).join('')}
    </div>`;
  _quiz.answered = false;
}
function quizAnswer(i) {
  if (!_quiz || _quiz.answered) return;
  _quiz.answered = true;
  const q = _quiz.pool[_quiz.idx];
  const btns = document.querySelectorAll('.quiz-opt');
  btns.forEach(b => {
    const bi = parseInt(b.dataset.i);
    b.disabled = true;
    if (bi === q.answer) b.classList.add('correct');
    if (bi === i && i !== q.answer) b.classList.add('wrong');
  });
  if (i === q.answer) { _quiz.score++; hvVibrate(20); }
  else hvVibrate([60, 40, 60]);
  const c = document.getElementById('quiz-content');
  const nx = document.createElement('button');
  nx.className = 'gold-primary-btn';
  nx.style.marginTop = '14px';
  nx.style.width = '100%';
  nx.textContent = _quiz.idx + 1 >= _quiz.pool.length ? '🏁 Sonucu Gör' : 'Sonraki Soru →';
  nx.onclick = () => { _quiz.idx++; quizRenderQuestion(); };
  c.appendChild(nx);
}
window.quizAnswer = quizAnswer;
function quizFinish() {
  const c = document.getElementById('quiz-content');
  const best = Math.max(hvLoad('quiz_best', 0), _quiz.score);
  hvSave('quiz_best', best);
  let msg = _quiz.score === _quiz.pool.length ? 'Mükemmel! 🎉' : _quiz.score >= _quiz.pool.length * 0.6 ? 'Çok iyi! 👏' : 'Biraz daha çalışmalısın 💪';
  c.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-icon">${_quiz.score >= _quiz.pool.length * 0.6 ? '🏆' : '📚'}</div>
      <div class="quiz-result-score">${_quiz.score} / ${_quiz.pool.length}</div>
      <div class="quiz-result-msg">${msg}</div>
      <div class="info-note">En yüksek skorunuz: <b>${best}/${_quiz.pool.length}</b></div>
      <button class="gold-primary-btn" style="margin-top:14px;" onclick="quizStart()">🔄 Tekrar Oyna</button>
    </div>`;
}

/* ══════════ RÜYA TABİRLERİ ══════════ */
/* renderRuya kaldırıldı (v65.1) — Rüya Tabirleri bölümü uygulamadan çıkarıldı */

/* ══════════ BEBEK İSİMLERİ ══════════ */
let _bebekGender = 'all';
function switchBebek(g) {
  _bebekGender = g;
  const btns = document.querySelectorAll('#bebek-switch .seg-btn');
  btns.forEach(b => b.classList.remove('active'));
  const map = { all: 0, erkek: 1, kiz: 2 };
  if (btns[map[g]]) btns[map[g]].classList.add('active');
  const inp = document.getElementById('bebek-search-input');
  renderBebek(inp ? inp.value : '');
}
window.switchBebek = switchBebek;
function renderBebek(filter) {
  const c = document.getElementById('bebek-content');
  if (!c || typeof BEBEK_ISIMLERI === 'undefined') return;
  const q = (filter || '').toLocaleLowerCase('tr').trim();
  let list = BEBEK_ISIMLERI.filter(b => _bebekGender === 'all' || b.gender === _bebekGender);
  if (q) list = list.filter(b => b.name.toLocaleLowerCase('tr').includes(q) || b.meaning.toLocaleLowerCase('tr').includes(q));
  if (!list.length) { c.innerHTML = '<div class="empty-note">İsim bulunamadı.</div>'; return; }
  c.innerHTML = `<div class="bebek-count-note">${list.length} isim</div>` + list.map(b => `
    <div class="bebek-item">
      <div class="bebek-head">
        <span class="bebek-name">${hvEsc(b.name)}</span>
        <span class="bebek-gender-badge ${b.gender}">${b.gender === 'erkek' ? '♂ Erkek' : '♀ Kız'}</span>
      </div>
      <div class="bebek-mean">${hvEsc(b.meaning)}</div>
    </div>`).join('');
}

/* ══════════ HİCRİ TAKVİM + KANDİLLER ══════════ */
function renderTakvim() {
  const c = document.getElementById('takvim-content');
  if (!c) return;
  const hijriText = (typeof computeLocalHijriText === 'function') ? computeLocalHijriText() : (APP_STATE && APP_STATE.hijriDateText) || '';
  const gregText = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
  const now = new Date(); now.setHours(0, 0, 0, 0);

  // Dini günler: bu yıl + gelecek yıl, hicri takvimden otomatik (Diyanet penceresiyle düzeltilir)
  const yil = now.getFullYear();
  const hvAyAd = a => (typeof HV_HICRI_AYLAR !== 'undefined' ? HV_HICRI_AYLAR[a - 1] : '');
  let upcoming = hvDiniGunler(yil, yil + 1).map(k => {
    const d = new Date(k.date + 'T00:00:00');
    const diff = Math.round((d - now) / 86400000);
    return Object.assign({}, k, { diff, dObj: d });
  });
  const future = upcoming.filter(k => k.diff >= 0 && k.diff <= 400);
  const past = upcoming.filter(k => k.diff < 0 && k.dObj.getFullYear() === yil).reverse();

  const typeIcon = { kandil: '🕯️', bayram: '🎉', onemli: '⭐' };
  const renderItem = k => {
    let countTxt = k.diff === 0 ? 'BUGÜN' : k.diff > 0 ? `${k.diff} gün kaldı` : `${Math.abs(k.diff)} gün önce`;
    return `<div class="kandil-item ${k.diff === 0 ? 'is-today' : ''} ${k.diff < 0 ? 'is-past' : ''}">
      <div class="kandil-icon">${typeIcon[k.type] || '📌'}</div>
      <div class="kandil-body">
        <div class="kandil-name">${hvEsc(k.name)}</div>
        <div class="kandil-date">${k.dObj.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${k.sure > 1 ? ' · ' + k.sure + ' gün' : ''}</div>
        <div class="kandil-desc">${hvEsc(k.desc)}</div>
      </div>
      <div class="kandil-count ${k.diff === 0 ? 'today' : ''}">${countTxt}</div>
    </div>`;
  };

  c.innerHTML = `
    <div class="hijri-today-card">
      <div class="ht-hijri">☪ ${hvEsc(hijriText || 'Hicri tarih')}</div>
      <div class="ht-greg">${gregText}</div>
    </div>
    <div class="section-mini-title">🔜 Yaklaşan Kandil ve Bayramlar</div>
    ${future.length ? future.map(renderItem).join('') : '<div class="info-note">Bu yıl için yaklaşan gün kalmadı.</div>'}
    ${past.length ? `<div class="section-mini-title" style="margin-top:14px;">📜 Geçen Günler</div>${past.map(renderItem).join('')}` : ''}
    <div class="info-note" style="margin-top:10px;">* Tarihler hicri takvimden hesaplanır; Diyanet vakit tablosu cihazda olduğu günler için Diyanet'in ilan ettiği tarih kullanılır. Kandiller, gecesi kutlanan günün akşamına düşen tarihte gösterilir.</div>`;
}

/* ══════════ PAYLAŞIM KARTLARI ══════════ */
let _paylasimData = null;
function renderPaylasim() {
  const c = document.getElementById('paylasim-content');
  if (!c) return;
  if (!c.dataset.built) {
    c.dataset.built = '1';
    c.innerHTML = `
      <div class="info-note">Rastgele bir ayet, hadis ya da cuma mesajı kartı oluşturun; WhatsApp ve sosyal medyada paylaşın.</div>
      <div class="share-type-switch">
        <button class="seg-btn active" id="pt-ayet" onclick="paylasimPick('ayet')">📖 Ayet</button>
        <button class="seg-btn" id="pt-hadis" onclick="paylasimPick('hadis')">📿 Hadis</button>
        <button class="seg-btn" id="pt-cuma" onclick="paylasimPick('cuma')">🕌 Cuma</button>
      </div>
      <div id="share-card-preview" class="share-card-preview"></div>
      <div class="share-actions">
        <button class="zikir-mini-btn" onclick="paylasimYenile()">🔄 Yenile</button>
        <button class="gold-primary-btn" onclick="paylasimPaylas()">📤 Paylaş</button>
      </div>
      <div id="paylasim-cuma-liste"></div>`;
  }
  paylasimPick('ayet');
}
let _paylasimTip = 'ayet';
function paylasimPick(tip) {
  _paylasimTip = tip;
  const liste = document.getElementById('paylasim-cuma-liste');
  if (liste) { if (tip === 'cuma') renderCuma('paylasim-cuma-liste'); else liste.innerHTML = ''; }
  document.getElementById('pt-ayet').classList.toggle('active', tip === 'ayet');
  document.getElementById('pt-hadis').classList.toggle('active', tip === 'hadis');
  const cb = document.getElementById('pt-cuma');
  if (cb) cb.classList.toggle('active', tip === 'cuma');
  paylasimYenile();
}
window.paylasimPick = paylasimPick;
function paylasimYenile() {
  const prev = document.getElementById('share-card-preview');
  if (_paylasimTip === 'cuma' && typeof CUMA_MESAJLARI !== 'undefined') {
    const m = CUMA_MESAJLARI[Math.floor(Math.random() * CUMA_MESAJLARI.length)];
    _paylasimData = { ar: '', tr: m, src: '' };
  } else if (_paylasimTip === 'ayet' && typeof DAILY_VERSES !== 'undefined') {
    const v = DAILY_VERSES[Math.floor(Math.random() * DAILY_VERSES.length)];
    _paylasimData = { ar: v.arabic, tr: v.turkish, src: `${v.surah} Suresi, ${v.ayah}. Ayet` };
  } else if (typeof HADITHS !== 'undefined') {
    const h = HADITHS[Math.floor(Math.random() * HADITHS.length)];
    _paylasimData = { ar: h.ar || '', tr: h.text, src: h.source };
  }
  if (prev && _paylasimData) {
    prev.innerHTML = `
      <div class="scp-inner">
        <div class="scp-badge">${_paylasimTip === 'ayet' ? '📖 Ayet-i Kerime' : (_paylasimTip === 'cuma' ? '🕌 Cuma Mesajı' : '📿 Hadis-i Şerif')}</div>
        ${_paylasimData.ar ? `<div class="scp-ar">${_paylasimData.ar}</div>` : ''}
        <div class="scp-tr">"${hvEsc(_paylasimData.tr)}"</div>
        ${_paylasimData.src ? `<div class="scp-src">— ${hvEsc(_paylasimData.src)}</div>` : ''}
        <div class="scp-brand">🌙 Namaz Dostu</div>
      </div>`;
  }
}
window.paylasimYenile = paylasimYenile;
function paylasimPaylas() {
  if (!_paylasimData) return;
  const emoji = _paylasimTip === 'ayet' ? '📖 Ayet-i Kerime' : (_paylasimTip === 'cuma' ? '🕌 Cuma Mesajı' : '📿 Hadis-i Şerif');
  hvOpenShareCard({
    badge: emoji,
    arabic: _paylasimData.ar || '',
    text: _paylasimData.tr,
    source: _paylasimData.src,
    fallbackText: `${emoji}\n\n"${_paylasimData.tr}"` + (_paylasimData.src ? `\n— ${_paylasimData.src}` : '')
  });
}
window.paylasimPaylas = paylasimPaylas;

/* ══════════ CUMA MESAJLARI ══════════ */
function renderCuma(hedefId) {
  const c = document.getElementById(hedefId || 'cuma-content');
  if (!c || typeof CUMA_MESAJLARI === 'undefined') return;
  c.innerHTML = `<div class="section-mini-title" style="margin-top:14px;">🕌 Tüm Cuma Mesajları <span style="font-size:.75rem;color:var(--text-muted);font-weight:600;">${CUMA_MESAJLARI.length}</span></div>
    <div class="info-note">Kopyala ile WhatsApp'a yapıştır ya da Paylaş ile kart olarak gönder.</div>` +
    CUMA_MESAJLARI.map((m, i) => `
      <div class="cuma-msg-card">
        <div class="cuma-msg-text">${hvEsc(m)}</div>
        <div class="cuma-actions">
          <button class="cuma-act-btn" onclick="cumaKopyala(${i})">📋 Kopyala</button>
          <button class="cuma-act-btn share" onclick="cumaPaylas(${i})">📤 Paylaş</button>
        </div>
      </div>`).join('');
}
function cumaPaylas(i) {
  hvOpenShareCard({ badge: '🕌 Cuma Mesajı', text: CUMA_MESAJLARI[i], source: '', fallbackText: '🕌 Cuma Mesajı\n\n' + CUMA_MESAJLARI[i] });
}
window.cumaPaylas = cumaPaylas;
function cumaKopyala(i) {
  const txt = CUMA_MESAJLARI[i];
  if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => hvToast('📋 Kopyalandı', 'Mesaj panoya kopyalandı.')).catch(() => {});
  } else {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); hvToast('📋 Kopyalandı', 'Mesaj panoya kopyalandı.'); } catch (e) {}
    document.body.removeChild(ta);
  }
}
window.cumaKopyala = cumaKopyala;

/* ══════════ ABDEST / GUSÜL / TEYEMMÜM REHBERİ ══════════ */
let _taharetActive = 'abdest';
function switchTaharet(key) {
  _taharetActive = key;
  document.querySelectorAll('#taharet-switch .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.k === key));
  renderTaharet();
}
window.switchTaharet = switchTaharet;
function renderTaharet() {
  const c = document.getElementById('taharet-content');
  if (!c || typeof TAHARET_REHBERI === 'undefined') return;
  const g = TAHARET_REHBERI.find(t => t.key === _taharetActive) || TAHARET_REHBERI[0];
  c.innerHTML = `
    <div class="info-note">${hvEsc(g.intro)}</div>
    ${g.steps.map(s => `
      <div class="step-card">
        <div class="step-circle-num">${s.n}</div>
        <div class="step-body">
          <h4>${hvEsc(s.title)}</h4>
          <p>${hvEsc(s.desc)}</p>
        </div>
      </div>`).join('')}`;
}

/* ══════════ ÖZEL NAMAZLAR ══════════ */
function renderOzelNamazlar() {
  const c = document.getElementById('ozel-namaz-content');
  if (!c || typeof OZEL_NAMAZLAR === 'undefined') return;
  c.innerHTML = OZEL_NAMAZLAR.map(n => `
    <div class="feature-card">
      <div class="fc-title">🕌 ${hvEsc(n.title)}</div>
      <div class="ozel-ozet">${hvEsc(n.ozet)}</div>
      <div class="fc-tr">${hvEsc(n.detay)}</div>
    </div>`).join('');
}

/* ══════════ HAC & UMRE REHBERİ (v65.0) ══════════ */
let _hacBolum = 0;
/* ══════════ BİLGİ SAYFALARI (v65.6): "Namaz Nedir?" ve "Kur'an Nedir?" — bölümlü, kaynaklı kartlar ══════════ */
let _nnBolum = 0, _knBolum = 0;
function hvBilgiSayfasiCiz(veri, contentId, pageId, bolum, secFn, sonBaglanti) {
  const c = document.getElementById(contentId);
  if (!c || !veri) return;
  const B = veri.bolumler;
  if (bolum >= B.length) bolum = 0;
  const seg = B.map((b, i) => `<button class="seg-btn${i === bolum ? ' active' : ''}" onclick="${secFn}(${i})">${b.ikon} ${hvEsc(b.ad)}</button>`).join('');
  const b = B[bolum];
  const kartlar = b.kartlar.map(k => `<div class="feature-card"><div class="fc-title">${hvEsc(k.b)}</div><div class="fc-tr nn-metin">${k.html ? k.m : hvEsc(k.m)}</div></div>`).join('');
  const ileri = bolum < B.length - 1
    ? `<button class="gold-primary-btn nn-ileri" onclick="${secFn}(${bolum + 1})">Sonraki: ${B[bolum + 1].ikon} ${hvEsc(B[bolum + 1].ad)} →</button>`
    : `<div class="nn-baglanti">${sonBaglanti}</div>`;
  c.innerHTML = `<div class="info-note">${hvEsc(veri.giris)}</div><div class="share-type-switch hac-seg nn-seg">${seg}</div>` +
    `<div class="section-mini-title">${b.ikon} ${hvEsc(b.ad)}</div>${kartlar}${ileri}<div class="nn-kaynak">${hvEsc(veri.kaynak)}</div>`;
  const kok = document.getElementById(pageId); const box = kok && kok.querySelector('.hero-frame-box'); if (box) box.scrollTop = 0;
}
function nnBolumSec(i) { _nnBolum = i; renderNamazNedir(); }
window.nnBolumSec = nnBolumSec;
function renderNamazNedir() {
  if (typeof HV_NAMAZ_NEDIR === 'undefined') return;
  hvBilgiSayfasiCiz(HV_NAMAZ_NEDIR, 'namaz-nedir-content', 'page-namaz-nedir', _nnBolum, 'nnBolumSec',
    `<button class="seg-btn" onclick="navigateTo('guide')">🤲 Kılınışı (Rehber)</button><button class="seg-btn" onclick="navigateTo('namaz-takibi')">✅ Namaz Takibi</button><button class="seg-btn" onclick="navigateTo('kaza')">🔄 Kaza Takibi</button><button class="seg-btn" onclick="navigateTo('namaz-programi')">🌱 30 Günde Namaz</button><button class="seg-btn" onclick="navigateTo('kuran-nedir')">📖 Kur'an Nedir?</button>`);
}
window.renderNamazNedir = renderNamazNedir;
function knBolumSec(i) { _knBolum = i; renderKuranNedir(); }
window.knBolumSec = knBolumSec;
function renderKuranNedir() {
  if (typeof HV_KURAN_NEDIR === 'undefined') return;
  hvBilgiSayfasiCiz(HV_KURAN_NEDIR, 'kuran-nedir-content', 'page-kuran-nedir', _knBolum, 'knBolumSec',
    `<button class="seg-btn" onclick="navigateTo('quran')">📖 Kur'an Oku</button><button class="seg-btn" onclick="navigateTo('dinle')">🎧 Kur'an Dinle</button><button class="seg-btn" onclick="navigateTo('elifba')">🔤 Elifbâ</button><button class="seg-btn" onclick="navigateTo('tecvid')">🎼 Tecvid</button><button class="seg-btn" onclick="navigateTo('hatim')">📅 Hatim Planı</button><button class="seg-btn" onclick="navigateTo('namaz-nedir')">❓ Namaz Nedir?</button>`);
}
window.renderKuranNedir = renderKuranNedir;

function hacBolumSec(i) { _hacBolum = i; renderHacUmre(); }
window.hacBolumSec = hacBolumSec;
function renderHacUmre() {
  const c = document.getElementById('hac-umre-content');
  if (!c || typeof HAC_UMRE === 'undefined') return;
  const seg = HAC_UMRE.bolumler.map((b, i) =>
    `<button class="seg-btn${i === _hacBolum ? ' active' : ''}" onclick="hacBolumSec(${i})">${b.ikon} ${hvEsc(b.ad.replace(/ Nasıl Yapılır\?/, ''))}</button>`).join('') +
    `<button class="seg-btn${_hacBolum === 3 ? ' active' : ''}" onclick="hacBolumSec(3)">🤲 Dualar</button>`;
  let govde = '';
  if (_hacBolum < 3) {
    const b = HAC_UMRE.bolumler[_hacBolum];
    govde = `<div class="section-mini-title">${b.ikon} ${hvEsc(b.ad)}</div>` +
      b.adimlar.map(a => `<div class="feature-card"><div class="fc-title">${hvEsc(a.baslik)}</div><div class="fc-tr">${hvEsc(a.metin)}</div></div>`).join('');
  } else {
    govde = `<div class="section-mini-title">🤲 Hac &amp; Umre Duaları</div>` +
      HAC_UMRE.dualar.map(d => `<div class="feature-card"><div class="fc-title">${hvEsc(d.title)}</div><div class="fc-ar">${d.arabic}</div><div class="fc-ok">🗣️ ${hvEsc(d.okunusu)}</div><div class="fc-tr">${hvEsc(d.turkish)}</div></div>`).join('');
  }
  c.innerHTML = `<div class="info-note">${hvEsc(HAC_UMRE.giris)}</div><div class="share-type-switch hac-seg">${seg}</div>${govde}`;
  const kok = document.getElementById('page-hac-umre'); const box = kok && kok.querySelector('.hero-frame-box'); if (box) box.scrollTop = 0;
}

/* ══════════ KANDİL (MÜBAREK GECELER) REHBERİ (v65.0) ══════════ */
function renderGeceler() {
  const c = document.getElementById('geceler-content');
  if (!c || typeof GECELER_REHBERI === 'undefined') return;
  // Yaklaşan gün bilgisi (hicri takvimden)
  let yaklasan = {};
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const yil = now.getFullYear();
    hvDiniGunler(yil, yil + 1).forEach(g => {
      const d = new Date(g.date + 'T00:00:00'); const diff = Math.round((d - now) / 86400000);
      if (diff < 0) return;
      GECELER_REHBERI.forEach(r => { if (g.name.indexOf(r.anahtar) === 0 && (yaklasan[r.anahtar] === undefined || diff < yaklasan[r.anahtar].diff)) yaklasan[r.anahtar] = { diff, d }; });
    });
  } catch (e) {}
  const sirali = GECELER_REHBERI.slice().sort((a, b) => ((yaklasan[a.anahtar] || { diff: 9999 }).diff) - ((yaklasan[b.anahtar] || { diff: 9999 }).diff));
  c.innerHTML = `<div class="info-note">Kandil ve bayramlar yaklaşan tarihe göre sıralanır. Tarihler Hicri Takvim bölümünden takip edilir.</div>` +
    sirali.map((r, i) => {
      const y = yaklasan[r.anahtar];
      const etiket = y ? (y.diff === 0 ? 'BUGÜN' : y.diff === 1 ? 'YARIN' : y.diff + ' gün kaldı') : '';
      const tarih = y ? y.d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      return `<details class="gece-kart"${i === 0 ? ' open' : ''}>
        <summary><span class="gece-ad">🕯️ ${hvEsc(r.ad)}</span>${etiket ? `<span class="gece-etiket${y && y.diff <= 1 ? ' yakin' : ''}">${etiket}</span>` : ''}</summary>
        ${tarih ? `<div class="gece-tarih">📅 ${tarih}</div>` : ''}
        <div class="gece-ne">${hvEsc(r.ne)}</div>
        <div class="gece-alt-baslik">Bu gece ne yapılır?</div>
        <ul class="gece-liste">${r.yap.map(x => `<li>${hvEsc(x)}</li>`).join('')}</ul>
        <div class="gece-alt-baslik">Dua</div>
        <div class="gece-dua">${hvEsc(r.dua)}</div>
        <div class="gece-alt-baslik">Hadis</div>
        <div class="gece-hadis">${hvEsc(r.hadis)}</div>
      </details>`;
    }).join('');
}

/* ══════════ HIZLI ERİŞİM — ana sayfa (v65.1) ══════════
   En çok kullanılan 9 bölüm; kullanıcı "Düzenle" ile kendi listesini seçer (hv_hizli). */
const HV_HE_KATALOG = [
  { id: 'qibla', ikon: '🧭', ad: 'Kıble' }, { id: 'quran', ikon: '📖', ad: "Kur'an Oku" }, { id: 'dinle', ikon: '🎧', ad: "Kur'an Dinle" },
  { id: 'ezber', ikon: '🌱', ad: 'Dua Öğren' }, { id: 'zikirmatik', ikon: '📿', ad: 'Zikirmatik' }, { id: 'namaz-takibi', ikon: '✅', ad: 'Namaz Takibi' },
  { id: 'mushaf', ikon: '📜', ad: 'Sayfa Sayfa Mushaf' }, { id: 'sifirdan', ikon: '🗒️', ad: 'Satır Satır Oku' },
  { id: 'kaza', ikon: '🔄', ad: 'Kaza Namazı' }, { id: 'oruc', ikon: '🌙', ad: 'Oruç Takibi' }, { id: 'namaz-programi', ikon: '🗓️', ad: '30 Günde Namaz' },
  { id: 'guide', ikon: '🤲', ad: 'Namaz Rehberi' }, { id: 'onemli-sureler', ikon: '⭐', ad: 'Önemli Sureler' },
  { id: 'hatim', ikon: '📗', ad: 'Hatim Takibi' }, { id: 'elifba', ikon: '🔤', ad: 'Elifbâ' }, { id: 'tecvid', ikon: '🎓', ad: 'Tecvid' },
  { id: 'ayet-arama', ikon: '🔎', ad: 'Ayet Ara' }, { id: 'ezkar', ikon: '🌅', ad: 'Ezkâr' }, { id: 'gunluk-dua', ikon: '📔', ad: 'Günlük Dualar' },
  { id: 'esma', ikon: '🕋', ad: 'Esmaül Hüsna' }, { id: 'kirk-hadis', ikon: '📜', ad: 'Hadisler' }, { id: 'taharet', ikon: '💧', ad: 'Abdest' },
  { id: 'ozel-namaz', ikon: '🕌', ad: 'Özel Namazlar' }, { id: 'hac-umre', ikon: '🧳', ad: 'Hac & Umre' }, { id: 'geceler', ikon: '🕯️', ad: 'Kandil Rehberi' },
  { id: 'iman', ikon: '🧾', ad: 'İman Esasları' }, { id: 'peygamberler', ikon: '👳', ad: 'Peygamberler' }, { id: 'siyer', ikon: '🌟', ad: 'Siyer' },
  { id: 'zekat', ikon: '💰', ad: 'Zekât & Fitre' }, { id: 'takvim', ikon: '📅', ad: 'Hicri Takvim' }, { id: 'imsakiye', ikon: '🍽️', ad: 'İmsakiye' },
  { id: 'paylasim', ikon: '📤', ad: 'Paylaşım' }, { id: 'sozluk', ikon: '📚', ad: 'Sözlük' }, { id: 'cevirici', ikon: '🔄', ad: 'Tarih Çevirici' },
  { id: 'quiz', ikon: '❓', ad: 'Bilgi Quizi' }, { id: 'bebek', ikon: '👶', ad: 'Bebek İsimleri' }, { id: 'settings', ikon: '⚙️', ad: 'Ayarlar' }
];
const HV_HE_VARSAYILAN = ['qibla', 'quran', 'dinle', 'ezber', 'namaz-takibi', 'zikirmatik', 'guide', 'gunluk-dua'];   // v65.9: iki sıra, 8 kısayol
const HV_HE_MAX = 8;
function hvHeListe() {
  let l = null; try { l = JSON.parse(localStorage.getItem('hv_hizli') || 'null'); } catch (e) {}
  if (!Array.isArray(l) || !l.length) l = HV_HE_VARSAYILAN.slice();
  l = l.filter(id => HV_HE_KATALOG.some(k => k.id === id));
  // Eski 4'lü kayıtları 8'e tamamla (ana sayfa iki sıra olacak şekilde dolsun)
  HV_HE_VARSAYILAN.forEach(id => { if (l.length < HV_HE_MAX && l.indexOf(id) < 0) l.push(id); });
  return l.slice(0, HV_HE_MAX);
}
function renderHizliErisim() {
  const c = document.getElementById('hizli-erisim');
  if (!c) return;
  const liste = hvHeListe();
  // Tek sıra: 4 kısayol + sağda ince "düzenle" kalemi (başlık satırı yok → ana sayfa tek ekrana sığar)
  c.innerHTML = `<div class="he-kart" role="group" aria-label="Hızlı Erişim">
      <div class="he-grid">${liste.map(id => { const k = HV_HE_KATALOG.find(x => x.id === id); return `<button class="he-btn" onclick="navigateTo('${id}')"><span class="he-ikon">${k.ikon}</span><span class="he-ad">${hvEsc(k.ad)}</span></button>`; }).join('')}<button class="he-duzenle" onclick="hvHeDuzenle()" title="Hızlı Erişim'i düzenle" aria-label="Hızlı Erişim'i düzenle">✏️</button></div>
    </div>`;
}
window.renderHizliErisim = renderHizliErisim;
function hvHeDuzenle() {
  const old = document.getElementById('hv-he-modal'); if (old) old.remove();
  let secili = hvHeListe();
  const w = document.createElement('div'); w.id = 'hv-he-modal'; w.className = 'hv-sc-backdrop';
  const ciz = () => {
    w.innerHTML = `<div class="hv-sc-box he-box">
        <div class="tts-baslik">✏️ Hızlı Erişimi Düzenle</div>
        <div class="tts-aciklama">Ana sayfada görünecek en fazla <b>${HV_HE_MAX}</b> bölümü seç. Seçim sırası ana sayfadaki sırayı belirler. <b>${secili.length}/${HV_HE_MAX}</b> seçili.</div>
        <div class="he-secim">${HV_HE_KATALOG.map(k => { const i = secili.indexOf(k.id); return `<button class="he-secenek${i >= 0 ? ' on' : ''}" data-id="${k.id}"><span class="he-ikon">${k.ikon}</span><span class="he-ad">${hvEsc(k.ad)}</span>${i >= 0 ? `<span class="he-sira">${i + 1}</span>` : ''}</button>`; }).join('')}</div>
        <div class="hv-sc-actions">
          <button class="hv-sc-btn hv-sc-primary" id="he-kaydet">Kaydet</button>
          <button class="hv-sc-btn" id="he-varsayilan">Varsayılana dön</button>
        </div>
        <button class="hv-sc-close" id="he-kapat">Kapat</button>
      </div>`;
    w.querySelectorAll('.he-secenek').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id; const i = secili.indexOf(id);
      if (i >= 0) secili.splice(i, 1);
      else if (secili.length < HV_HE_MAX) secili.push(id);
      else { hvToast('⚠️ En fazla ' + HV_HE_MAX, 'Yeni eklemek için birini kaldır.'); return; }
      ciz();
    }));
    w.querySelector('#he-kaydet').onclick = () => { try { localStorage.setItem('hv_hizli', JSON.stringify(secili)); } catch (e) {} renderHizliErisim(); w.remove(); hvToast('✅ Kaydedildi', 'Hızlı erişim güncellendi.'); };
    w.querySelector('#he-varsayilan').onclick = () => { secili = HV_HE_VARSAYILAN.slice(); ciz(); };
    w.querySelector('#he-kapat').onclick = () => w.remove();
  };
  ciz();
  document.body.appendChild(w);
  w.addEventListener('click', e => { if (e.target === w) w.remove(); });
}
window.hvHeDuzenle = hvHeDuzenle;

/* ══════════ TECVİD DERSLERİ (v65.1) ══════════ */
function renderTecvid() {
  const c = document.getElementById('tecvid-content');
  if (!c || typeof TECVID_DERSLERI === 'undefined') return;
  const bitenler = (() => { try { return JSON.parse(localStorage.getItem('hv_tecvid_biten') || '[]'); } catch (e) { return []; } })();
  const baslik = document.querySelector('#page-tecvid .page-header-title p');
  if (baslik) baslik.textContent = "Kur'an'ı kurallarına göre okuma — " + TECVID_DERSLERI.length + ' ders · ' + bitenler.length + ' tamamlandı';
  c.innerHTML = `<div class="info-note">Elifbâ'yı bitirdiysen sıra tecvidde. Her dersi okuyup örnekleri Kur'an Oku'daki hoca sesiyle dinleyerek pekiştir; bitirince ✓ işaretle.</div>` +
    TECVID_DERSLERI.map((d, i) => {
      const biten = bitenler.indexOf(i) >= 0;
      return `<details class="gece-kart tecvid-kart${biten ? ' biten' : ''}"${i === 0 ? ' open' : ''}>
        <summary><span class="gece-ad"><span class="tecvid-no">${i + 1}</span> ${hvEsc(d.ad)}</span>${biten ? '<span class="gece-etiket yakin">✓</span>' : ''}</summary>
        <div class="gece-ne"><b>${hvEsc(d.ozet)}</b></div>
        <div class="gece-hadis" style="padding-bottom:6px;">${hvEsc(d.kural)}</div>
        <div class="gece-alt-baslik">Örnekler</div>
        ${d.ornekler.map(o => `<div class="tecvid-ornek"><div class="tecvid-ar">${hvEsc(o.ar)}</div><div class="tecvid-ok">${hvEsc(o.ok)}${o.not ? ` <span class="tecvid-not">— ${hvEsc(o.not)}</span>` : ''}</div></div>`).join('')}
        <button class="ez-ogrendim${biten ? ' on' : ''}" style="margin:10px 0 14px;" onclick="tecvidBitir(${i})">${biten ? '✓ Bu dersi bitirdim' : '○ Bu dersi bitirdim'}</button>
      </details>`;
    }).join('');
}
function tecvidBitir(i) {
  let l = []; try { l = JSON.parse(localStorage.getItem('hv_tecvid_biten') || '[]'); } catch (e) {}
  l = l.indexOf(i) >= 0 ? l.filter(x => x !== i) : l.concat([i]);
  try { localStorage.setItem('hv_tecvid_biten', JSON.stringify(l)); } catch (e) {}
  renderTecvid();
}
window.tecvidBitir = tecvidBitir;

/* ══════════ TÜRKÇE SES YARDIMI — ücretsiz çözüm (v65.1) ══════════
   Telefonda Türkçe konuşma sesi yoksa: Google'ın ücretsiz ses paketini kurma rehberi */
function hvTtsYardim() {
  const old = document.getElementById('hv-tts-yardim'); if (old) old.remove();
  const platform = (typeof hvNativePlatform === 'function') ? hvNativePlatform() : 'web';
  const ios = platform === 'ios' || /iPhone|iPad/i.test(navigator.userAgent);
  const adimlar = ios ? `
      <ol class="tts-adim">
        <li>Telefonda <b>Ayarlar → Erişilebilirlik → Sesli İçerik → Sesler</b> yolunu izle.</li>
        <li><b>Türkçe</b>'yi seç, bir ses indir (ör. <b>Yelda</b> — gelişmiş sürümü daha doğal).</li>
        <li>Namaz Dostu'nu tamamen kapatıp tekrar aç.</li>
      </ol>` : `
      <ol class="tts-adim">
        <li>Aşağıdaki düğmeyle <b>Google Konuşma Hizmetleri</b>'ni kur ya da güncelle (ücretsiz).</li>
        <li>Telefonda <b>Ayarlar → Sistem → Diller ve giriş → Metin okuma çıkışı</b> (bazı telefonlarda Erişilebilirlik altında).</li>
        <li>Tercih edilen motor: <b>Google</b> → ⚙ → <b>Ses verilerini yükle</b> → <b>Türkçe</b>'yi indir.</li>
        <li>Namaz Dostu'nu tamamen kapatıp tekrar aç.</li>
      </ol>
      <a class="gold-primary-btn tts-play" href="https://play.google.com/store/apps/details?id=com.google.android.tts" target="_blank" rel="noopener">▶ Google Konuşma Hizmetleri'ni Play Store'da aç</a>`;
  const w = document.createElement('div');
  w.id = 'hv-tts-yardim'; w.className = 'hv-sc-backdrop';
  w.innerHTML = `<div class="hv-sc-box tts-box">
      <div class="tts-baslik">🔊 Türkçe sesi ücretsiz nasıl kurarım?</div>
      <div class="tts-aciklama">Meâli telefonunun kendi Türkçe sesi okur. Bu telefonda Türkçe ses paketi yüklü değil; bir kez kurulunca meâl sesli okunur.</div>
      ${adimlar}
      <button class="hv-sc-close" onclick="document.getElementById('hv-tts-yardim').remove()">Kapat</button>
    </div>`;
  document.body.appendChild(w);
  w.addEventListener('click', e => { if (e.target === w) w.remove(); });
}
window.hvTtsYardim = hvTtsYardim;

/* ══════════ İMAN ESASLARI (ÂMENTÜ) ══════════ */
function renderImanEsaslari() {
  const c = document.getElementById('iman-content');
  if (!c || typeof IMAN_ESASLARI === 'undefined') return;
  const a = typeof AMENTU !== 'undefined' ? AMENTU : null;
  c.innerHTML = `
    ${a ? `<div class="feature-card">
      <div class="fc-title">📜 Âmentü</div>
      <div class="fc-ar">${a.arabic}</div>
      <div class="fc-ok">🗣️ <b>Okunuşu:</b> ${hvEsc(a.okunusu)}</div>
      <div class="fc-tr">📖 <b>Anlamı:</b> ${hvEsc(a.turkish)}</div>
    </div>` : ''}
    <div class="section-mini-title">İmanın 6 Şartı</div>
    ${IMAN_ESASLARI.map(i => `
      <div class="feature-card">
        <div class="fc-title">✦ ${hvEsc(i.title)}</div>
        <div class="fc-tr">${hvEsc(i.desc)}</div>
      </div>`).join('')}`;
}

/* ══════════ AYET & MEAL ARAMA (Al Quran Cloud API) ══════════ */
let _ayetAramaTimer = null;
function renderAyetArama() {
  const c = document.getElementById('ayet-arama-content');
  if (!c) return;
  if (!c.dataset.built) {
    c.dataset.built = '1';
    c.innerHTML = '<div class="info-note">Yukarıdaki kutuya bir kelime yazın (ör. sabır, namaz, rahmet). Kur\'an mealinde geçtiği ayetler listelenir.</div>';
  }
}
function doAyetArama(query) {
  const c = document.getElementById('ayet-arama-content');
  if (!c) return;
  const q = (query || '').trim();
  if (q.length < 2) { c.innerHTML = '<div class="info-note">En az 2 harf yazın.</div>'; return; }
  c.innerHTML = '<div class="info-note">🔎 Aranıyor...</div>';
  clearTimeout(_ayetAramaTimer);
  _ayetAramaTimer = setTimeout(async () => {
    const hazir = await hvMealHazir();
    if (!hazir) {
      c.innerHTML = '<div class="empty-note">Meal dosyası yüklenemedi. İnternete bağlanıp bir kez açtıktan sonra çevrimdışı da çalışır.</div>';
      return;
    }
    // Arama artık uygulamanın içindeki Diyanet meâlinde — internet gerekmez
    const ql = hvTrNorm(q);
    const bulunan = [];
    const idx = hvMealIndeks();
    for (let i = 0; i < idx.length && bulunan.length < 400; i++) {
      if (idx[i].n.indexOf(ql) >= 0) bulunan.push(idx[i]);
    }
    const total = bulunan.length;
    const goster = bulunan.slice(0, 60);
    if (total > 0) {
      c.innerHTML = `<div class="bebek-count-note">"${hvEsc(q)}" için ${total}${total >= 400 ? '+' : ''} ayet bulundu${total > 60 ? ' (ilk 60 gösteriliyor)' : ''}</div>` +
        goster.map(m => `<div class="ayet-result" onclick="openSurahById(${m.s})">
              <div class="ayet-ref">${hvEsc(m.ad)} Suresi • ${hvMealEtiket(m.s, m.v)}. Ayet <span class="ayet-go">›</span></div>
              <div class="ayet-meal">${hvHighlight(m.t, q)}</div>
            </div>`).join('');
    } else {
      c.innerHTML = '<div class="empty-note">"' + hvEsc(q) + '" kelimesini içeren ayet bulunamadı. Farklı bir kelime deneyin.</div>';
    }
  }, 300);
}

/* ══════════ 40 HADİS (İmam Nevevî) ══════════ */
/* 1000 Hadis sayfası — birleşik havuz, arama, sayfalama (performans için 100'er) */
let _hadisPage = 0;
const HADIS_PAGE_SIZE = 100;
function renderKirkHadis(filter, page) {
  const c = document.getElementById('kirk-hadis-content');
  if (!c) return;
  const all = hvAllHadis().map((h, i) => ({ no: i + 1, text: h.text, source: h.source, ar: h.ar }));
  const q = (filter || '').toLocaleLowerCase('tr').trim();
  const list = q ? all.filter(h => h.text.toLocaleLowerCase('tr').includes(q) || h.source.toLocaleLowerCase('tr').includes(q) || String(h.no) === q) : all;
  const countEl = document.getElementById('kirk-hadis-count');
  if (countEl) countEl.textContent = q ? `${list.length} sonuç (toplam ${all.length} hadis)` : `Toplam ${all.length} hadis-i şerif`;
  if (!list.length) { c.innerHTML = '<div class="empty-note">Sonuç bulunamadı.</div>'; return; }
  if (typeof page === 'number') _hadisPage = page; else if (q) _hadisPage = 0;
  const pages = Math.ceil(list.length / HADIS_PAGE_SIZE);
  if (_hadisPage >= pages) _hadisPage = pages - 1;
  if (_hadisPage < 0) _hadisPage = 0;
  const slice = list.slice(_hadisPage * HADIS_PAGE_SIZE, (_hadisPage + 1) * HADIS_PAGE_SIZE);
  const nav = pages > 1 ? `
    <div class="hadis-pager">
      <button class="gold-outline-btn" ${_hadisPage === 0 ? 'disabled' : ''} onclick="renderKirkHadis(document.getElementById('hadis-search-input') ? document.getElementById('hadis-search-input').value : '', ${_hadisPage - 1}); document.querySelector('#page-kirk-hadis .hero-frame-box').scrollTop = 0;">‹ Önceki</button>
      <span class="hadis-pager-info">${_hadisPage + 1} / ${pages}</span>
      <button class="gold-outline-btn" ${_hadisPage >= pages - 1 ? 'disabled' : ''} onclick="renderKirkHadis(document.getElementById('hadis-search-input') ? document.getElementById('hadis-search-input').value : '', ${_hadisPage + 1}); document.querySelector('#page-kirk-hadis .hero-frame-box').scrollTop = 0;">Sonraki ›</button>
    </div>` : '';
  c.innerHTML = nav + slice.map(h => `
    <div class="hadis40-card">
      <div class="hadis40-no">${h.no}</div>
      <div class="hadis40-body">
        ${h.ar ? `<div class="hadis40-ar">${hvEsc(h.ar)}</div>` : ''}
        <div class="hadis40-text">${q ? hvHighlight(h.text, q) : hvEsc(h.text)}</div>
        <div class="hadis40-src">— ${hvEsc(h.source)}</div>
      </div>
    </div>`).join('') + nav;
}
window.renderKirkHadis = renderKirkHadis;

/* ══════════ SİYER ══════════ */
function renderSiyer() {
  const c = document.getElementById('siyer-content');
  if (!c || typeof SIYER_OLAYLARI === 'undefined') return;
  c.innerHTML = `<div class="info-note">Peygamber Efendimizin (s.a.v.) hayatından önemli olaylar (Miladî).</div>
    <div class="timeline">${SIYER_OLAYLARI.map(o => `
      <div class="tl-item">
        <div class="tl-year">${hvEsc(o.yil)}</div>
        <div class="tl-body">
          <div class="tl-title">${hvEsc(o.baslik)}</div>
          <div class="tl-desc">${hvEsc(o.desc)}</div>
        </div>
      </div>`).join('')}</div>`;
}

/* ══════════ PEYGAMBERLER ══════════ */
function renderPeygamberler() {
  const c = document.getElementById('peygamberler-content');
  if (!c || typeof PEYGAMBERLER === 'undefined') return;
  c.innerHTML = `<div class="info-note">Kur'an-ı Kerim'de adı geçen 25 peygamber ve kıssaları.</div>` +
    PEYGAMBERLER.map((p, i) => `
      <div class="peygamber-card">
        <div class="peygamber-no">${i + 1}</div>
        <div class="peygamber-body">
          <div class="peygamber-head">
            <span class="peygamber-name">${hvEsc(p.name)}</span>
            ${p.lakab ? `<span class="peygamber-lakab">${hvEsc(p.lakab)}</span>` : ''}
          </div>
          <div class="peygamber-info">${hvEsc(p.info)}</div>
        </div>
      </div>`).join('');
}

/* ══════════ DİNİ SÖZLÜK ══════════ */
function renderSozluk(filter) {
  const c = document.getElementById('sozluk-content');
  if (!c || typeof DINI_SOZLUK === 'undefined') return;
  const q = (filter || '').toLocaleLowerCase('tr').trim();
  const list = q ? DINI_SOZLUK.filter(t => t.term.toLocaleLowerCase('tr').includes(q) || t.meaning.toLocaleLowerCase('tr').includes(q)) : DINI_SOZLUK;
  if (!list.length) { c.innerHTML = '<div class="empty-note">Kelime bulunamadı.</div>'; return; }
  c.innerHTML = list.map(t => `
    <div class="sozluk-item">
      <div class="sozluk-term">${hvEsc(t.term)}</div>
      <div class="sozluk-mean">${hvEsc(t.meaning)}</div>
    </div>`).join('');
}


/* ══════════ TARİH ÇEVİRİCİ (Hicri ↔ Miladi) ══════════
   Çeviri, telefonun kendi Ümmü'l-Kura takvimiyle (Intl) yapılır —
   internet gerekmez. Hicri→Miladi yönünde ikili arama kullanılır.
   ────────────────────────────────────────────────────── */
const HV_HICRI_AYLAR = ['Muharrem','Safer','Rebiülevvel','Rebiülahir','Cemaziyelevvel','Cemaziyelahir','Recep','Şaban','Ramazan','Şevval','Zilkade','Zilhicce'];
const HV_MILADI_AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const HV_GUNLER = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

// Miladi Date → {g, a, y} hicri
function hvHicriParcala(d) {
  try {
    const pr = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',
      { day:'numeric', month:'numeric', year:'numeric', timeZone:'UTC' }).formatToParts(d);
    let g=0,a=1,y=0;
    pr.forEach(x=>{ if(x.type==='day')g=parseInt(x.value,10);
      if(x.type==='month')a=parseInt(x.value,10);
      if(x.type==='year')y=parseInt(String(x.value).replace(/[^0-9]/g,''),10); });
    if(!g||!y) return null;
    return { g:g, a:a, y:y };
  } catch(e) { return null; }
}

// Hicri {g,a,y} → Miladi Date (ikili arama)
function hvHicridenMiladi(g, a, y) {
  // Kaba başlangıç: hicri yıl ≈ 354.367 gün
  const yaklasik = Date.UTC(622, 6, 16) + Math.round(((y - 1) * 354.367 + (a - 1) * 29.53 + (g - 1)) * 86400000);
  let alt = yaklasik - 60 * 86400000, ust = yaklasik + 60 * 86400000;
  const anahtar = (y * 10000) + (a * 100) + g;
  for (let i = 0; i < 40 && alt <= ust; i++) {
    const orta = alt + Math.floor((ust - alt) / 2 / 86400000) * 86400000;
    const h = hvHicriParcala(new Date(orta));
    if (!h) return null;
    const k = (h.y * 10000) + (h.a * 100) + h.g;
    if (k === anahtar) return new Date(orta);
    if (k < anahtar) alt = orta + 86400000; else ust = orta - 86400000;
  }
  return null;
}


/* ══════════════════════════════════════════════════════════════
   DİNİ GÜNLER — hicri takvimden otomatik hesap (v64.8)
   Eski elle yazılmış liste (yanlış tarihler, tek yıl) kaldırıldı.
   Kural Diyanet listesiyle aynı: kandil, gecesi kutlanan günün
   akşamına düşen tarihte gösterilir (27 Recep gecesi → 26 Recep günü).
   Cihazdaki Diyanet vakit tablosu (hv_cal_*, 'h' alanı) o günü
   kapsıyorsa tarih doğrudan Diyanet'in hicri gününden alınır;
   yoksa Ümmü'l-Kura hesabı kullanılır (2025 listesiyle birebir doğrulandı).
   ══════════════════════════════════════════════════════════════ */
const HV_DINI_GUN_TANIM = [
  { ad: 'Üç Ayların Başlangıcı', ay: 7,  gun: 1,        tur: 'onemli', acik: 'Recep ayının ilk günü; Recep, Şaban ve Ramazan\'dan oluşan rahmet mevsimi başlar.' },
  { ad: 'Regaip Kandili',        ay: 7,  gun: 'regaib', tur: 'kandil', acik: 'Recep ayının ilk Cuma gecesi. Rahmet ve mağfiretin bol olduğu, dua ve tövbe gecesi.' },
  { ad: 'Miraç Kandili',         ay: 7,  gun: 26,       tur: 'kandil', acik: '27 Recep gecesi. Peygamberimizin (s.a.v.) Miraç\'a yükseldiği, beş vakit namazın farz kılındığı gece.' },
  { ad: 'Berat Kandili',         ay: 8,  gun: 14,       tur: 'kandil', acik: '15 Şaban gecesi. Günahlardan arınma, af ve kurtuluş gecesi; bir yıllık takdirin yenilendiğine inanılır.' },
  { ad: 'Ramazan Başlangıcı',    ay: 9,  gun: 1,        tur: 'onemli', acik: 'On bir ayın sultanı Ramazan\'ın ilk günü. Oruç, teravih ve Kur\'an ayı başlar.' },
  { ad: 'Kadir Gecesi',          ay: 9,  gun: 26,       tur: 'kandil', acik: '27 Ramazan gecesi. Kur\'an\'ın indirilmeye başlandığı, bin aydan hayırlı gece.' },
  { ad: 'Ramazan Bayramı Arefesi', ay: 10, gun: 0,      tur: 'onemli', acik: 'Ramazan\'ın son günü. Bayram hazırlığı, fitre ve tövbe günü.' },
  { ad: 'Ramazan Bayramı',       ay: 10, gun: 1,        tur: 'bayram', acik: 'Şevval\'in ilk günü, 3 gün sürer. Bayram namazı, ziyaretler ve sevinç günleri.', sure: 3 },
  { ad: 'Kurban Bayramı Arefesi', ay: 12, gun: 9,       tur: 'onemli', acik: 'Zilhicce\'nin 9. günü. Hacıların Arafat\'ta vakfe yaptığı gün; oruç tutmak faziletlidir. Teşrik tekbirleri sabah namazından itibaren başlar.' },
  { ad: 'Kurban Bayramı',        ay: 12, gun: 10,       tur: 'bayram', acik: 'Zilhicce\'nin 10. günü, 4 gün sürer. Kurban kesilir, teşrik tekbirleri 4. gün ikindiye kadar devam eder.', sure: 4 },
  { ad: 'Hicrî Yılbaşı',         ay: 1,  gun: 1,        tur: 'onemli', acik: 'Muharrem ayının ilk günü; hicrî yeni yıl.' },
  { ad: 'Aşure Günü',            ay: 1,  gun: 10,       tur: 'onemli', acik: 'Muharrem\'in 10. günü. Oruç tutmak sünnettir; 9 veya 11. günle birlikte tutulması tavsiye edilir.' },
  { ad: 'Mevlid Kandili',        ay: 3,  gun: 11,       tur: 'kandil', acik: '12 Rebiülevvel gecesi. Peygamber Efendimizin (s.a.v.) dünyaya teşrif ettiği gece.' }
];

/* Diyanet farklı bir tarih ilan ederse buraya yazılır: 'YYYY|Ad': 'YYYY-MM-DD' */
const HV_DINI_GUN_DUZELT = {};

const HV_HICRI_AY_ANAHTAR = ['muharrem','safer','rebiulevvel','rebiulahir','cemaziyelevvel','cemaziyelahir','recep','saban','ramazan','sevval','zilkade','zilhicce'];
function hvHicriAyNo(ad) {
  const n = String(ad || '').toLocaleLowerCase('tr')
    .replace(/[âäàáã]/g, 'a').replace(/[îïìí]/g, 'i').replace(/[ûüùú]/g, 'u').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/[^a-z]/g, '');
  const i = HV_HICRI_AY_ANAHTAR.findIndex(a => n.indexOf(a) === 0 || a.indexOf(n) === 0);
  return i >= 0 ? i + 1 : 0;
}

function hvTarihYmd(d) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function hvYmdTarih(s) { return new Date(s + 'T00:00:00Z'); }

/* Cihazdaki Diyanet tablosundan "gün/ay/yıl" hicri tarihini taşıyan miladi günü bul */
let hvDiyanetHicriHarita = null;
function hvDiyanetHicriHaritaKur() {
  if (hvDiyanetHicriHarita) return hvDiyanetHicriHarita;
  const harita = {};
  try {
    Object.keys(localStorage).filter(k => k.startsWith('hv_cal_')).forEach(k => {
      let ay; try { ay = JSON.parse(localStorage.getItem(k)); } catch (e) { return; }
      const liste = Array.isArray(ay) ? ay : Object.values(ay || {});
      liste.forEach(e => {
        if (!e || e.s !== 'd' || !e.h || !e.date) return;
        const m = String(e.h).match(/^(\d{1,2})\s+([^\d]+?)\s+(\d{4})$/);
        if (!m) return;
        const ayNo = hvHicriAyNo(m[2]);
        if (!ayNo) return;
        harita[m[3] + '-' + ayNo + '-' + parseInt(m[1], 10)] = e.date;
      });
    });
  } catch (e) {}
  hvDiyanetHicriHarita = harita;
  return harita;
}

/* Hicri gün → miladi (önce Diyanet penceresi, sonra hesap) */
function hvHicriGunMiladi(g, a, y) {
  const d = hvDiyanetHicriHaritaKur()[y + '-' + a + '-' + g];
  if (d) return hvYmdTarih(d);
  return (typeof hvHicridenMiladi === 'function') ? hvHicridenMiladi(g, a, y) : null;
}

function hvDiniGunlerHicriYil(y) {
  const out = [];
  HV_DINI_GUN_TANIM.forEach(t => {
    let d = null;
    if (t.gun === 'regaib') {
      let b = hvHicriGunMiladi(1, 7, y);
      for (let i = 0; b && i < 7; i++) {
        if (b.getUTCDay() === 5) { d = new Date(b.getTime() - 86400000); break; }
        b = new Date(b.getTime() + 86400000);
      }
    } else if (t.gun === 0) {
      const b = hvHicriGunMiladi(1, t.ay, y);
      if (b) d = new Date(b.getTime() - 86400000);
    } else {
      d = hvHicriGunMiladi(t.gun, t.ay, y);
    }
    if (!d) return;
    let ymd = hvTarihYmd(d);
    const duzelt = HV_DINI_GUN_DUZELT[ymd.slice(0, 4) + '|' + t.ad];
    if (duzelt) ymd = duzelt;
    out.push({ name: t.ad, date: ymd, type: t.tur, desc: t.acik, hicriYil: y, sure: t.sure || 1 });
  });
  return out;
}

/* Miladi yıl aralığındaki tüm dini günler (tarihe göre sıralı) */
function hvDiniGunler(yilBas, yilSon) {
  if (!yilSon) yilSon = yilBas;
  const hBas = hvHicriParcala(new Date(Date.UTC(yilBas, 0, 1)));
  const hSon = hvHicriParcala(new Date(Date.UTC(yilSon, 11, 31)));
  if (!hBas || !hSon) return [];
  const gorulen = {};
  const liste = [];
  for (let y = hBas.y; y <= hSon.y; y++) {
    hvDiniGunlerHicriYil(y).forEach(g => {
      const yil = parseInt(g.date.slice(0, 4), 10);
      if (yil < yilBas || yil > yilSon) return;
      const k = g.name + '|' + g.date;
      if (gorulen[k]) return;
      gorulen[k] = 1;
      liste.push(g);
    });
  }
  liste.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return liste;
}
window.hvDiniGunler = hvDiniGunler;

/* Ramazan durumu: kaç gün kaldı / kaçıncı gün / Kadir'e ve bayrama kalan (v65.1) */
function hvRamazanDurum(tarih) {
  const d = tarih || new Date(); d.setHours(0, 0, 0, 0);
  const ymd = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const liste = hvDiniGunler(d.getFullYear() - 1, d.getFullYear() + 1);
  const gun = (a, b) => Math.round((hvYmdTarih(b) - hvYmdTarih(a)) / 86400000);
  const bugun = ymd(d);
  // içinde bulunduğumuz ya da yaklaşan Ramazan
  let ramazan = null, bayram = null, kadir = null;
  for (const g of liste) {
    if (g.name === 'Ramazan Başlangıcı') {
      const b = liste.find(x => x.name === 'Ramazan Bayramı' && x.date > g.date);
      const k = liste.find(x => x.name === 'Kadir Gecesi' && x.date > g.date);
      if (b && bugun < b.date) { ramazan = g; bayram = b; kadir = k; break; }
    }
  }
  if (!ramazan) return null;
  if (bugun < ramazan.date) return { durum: 'once', kalan: gun(bugun, ramazan.date), baslangic: ramazan.date };
  return { durum: 'icinde', gunNo: gun(ramazan.date, bugun) + 1, toplam: gun(ramazan.date, bayram.date),
    kadirKalan: kadir ? gun(bugun, kadir.date) : null, bayramKalan: gun(bugun, bayram.date), baslangic: ramazan.date, kadir: kadir ? kadir.date : null };
}
window.hvRamazanDurum = hvRamazanDurum;

/* Bugün / yarın kandil-bayram mı? (ana sayfa şeridi ve bildirimler için) */
function hvBugunDiniGun(tarih) {
  const d = tarih || new Date();
  const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return hvDiniGunler(d.getFullYear() - 1, d.getFullYear() + 1).filter(g => {
    if (g.date === ymd) return true;
    // çok günlü bayramlar: 2., 3., 4. günler
    if (g.sure > 1) {
      const b = hvYmdTarih(g.date), fark = Math.round((hvYmdTarih(ymd) - b) / 86400000);
      return fark > 0 && fark < g.sure;
    }
    return false;
  });
}
window.hvBugunDiniGun = hvBugunDiniGun;

function hvCevYaz(id, html) { const e = document.getElementById(id); if (e) e.innerHTML = html; }
function hvCevSayi(id, varsayilan) {
  const e = document.getElementById(id);
  const v = e ? parseInt(e.value, 10) : NaN;
  return isNaN(v) ? varsayilan : v;
}

/* Ümmü'l-Kura takvimi yalnızca bu aralıkta tanımlıdır */
const HV_CEV_M_ALT = 1883, HV_CEV_M_UST = 2173;
const HV_CEV_H_ALT = 1301, HV_CEV_H_UST = 1599;

function hvCevMiladiden() {
  const g = hvCevSayi('cev-m-gun', 1), a = hvCevSayi('cev-m-ay', 1), y = hvCevSayi('cev-m-yil', 2000);
  if (g < 1 || g > 31 || a < 1 || a > 12) {
    hvCevYaz('cev-m-sonuc', '<div class="cev-uyari">Geçerli bir tarih girin.</div>'); return;
  }
  if (y < HV_CEV_M_ALT || y > HV_CEV_M_UST) {
    hvCevYaz('cev-m-sonuc', '<div class="cev-uyari">Bu araç <b>' + HV_CEV_M_ALT + ' – ' + HV_CEV_M_UST +
      '</b> yılları arasını çevirebilir. Ümmü\'l-Kura takvimi bu aralık dışında tanımlı değildir.</div>'); return;
  }
  const d = new Date(Date.UTC(y, a - 1, g));
  if (d.getUTCDate() !== g || d.getUTCMonth() !== a - 1) {
    hvCevYaz('cev-m-sonuc', '<div class="cev-uyari">Böyle bir gün yok (' + HV_MILADI_AYLAR[a-1] + ' ayı için kontrol edin).</div>'); return;
  }
  const h = hvHicriParcala(d);
  if (!h) { hvCevYaz('cev-m-sonuc', '<div class="cev-uyari">Bu cihaz Hicri takvimi desteklemiyor.</div>'); return; }
  hvCevYaz('cev-m-sonuc',
    '<div class="cev-sonuc"><div class="cev-sonuc-ust">Hicri karşılığı</div>' +
    '<div class="cev-sonuc-buyuk">' + h.g + ' ' + HV_HICRI_AYLAR[(h.a - 1 + 12) % 12] + ' ' + h.y + '</div>' +
    '<div class="cev-sonuc-alt">' + HV_GUNLER[d.getUTCDay()] + '</div></div>');
}

function hvCevHicriden() {
  const g = hvCevSayi('cev-h-gun', 1), a = hvCevSayi('cev-h-ay', 1), y = hvCevSayi('cev-h-yil', 1440);
  if (g < 1 || g > 30 || a < 1 || a > 12) {
    hvCevYaz('cev-h-sonuc', '<div class="cev-uyari">Geçerli bir tarih girin.</div>'); return;
  }
  if (y < HV_CEV_H_ALT || y > HV_CEV_H_UST) {
    hvCevYaz('cev-h-sonuc', '<div class="cev-uyari">Bu araç <b>' + HV_CEV_H_ALT + ' – ' + HV_CEV_H_UST +
      '</b> Hicri yılları arasını çevirebilir. Ümmü\'l-Kura takvimi bu aralık dışında tanımlı değildir.</div>'); return;
  }
  const d = hvHicridenMiladi(g, a, y);
  if (!d) { hvCevYaz('cev-h-sonuc', '<div class="cev-uyari">Bu tarih çevrilemedi. Gün sayısını kontrol edin (bazı aylar 29 gündür).</div>'); return; }
  hvCevYaz('cev-h-sonuc',
    '<div class="cev-sonuc"><div class="cev-sonuc-ust">Miladi karşılığı</div>' +
    '<div class="cev-sonuc-buyuk">' + d.getUTCDate() + ' ' + HV_MILADI_AYLAR[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</div>' +
    '<div class="cev-sonuc-alt">' + HV_GUNLER[d.getUTCDay()] + '</div></div>');
}

function hvCevBugun() {
  const n = new Date();
  const sg = document.getElementById('cev-m-gun'), sa = document.getElementById('cev-m-ay'), sy = document.getElementById('cev-m-yil');
  if (sg) sg.value = n.getDate();
  if (sa) sa.value = n.getMonth() + 1;
  if (sy) sy.value = n.getFullYear();
  hvCevMiladiden();
}

function renderCevirici() {
  const c = document.getElementById('cevirici-content');
  if (!c) return;
  const n = new Date();
  const h = hvHicriParcala(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))) || { g:1, a:1, y:1448 };
  const ayOpt = (liste, secili) => liste.map((ad, i) =>
    '<option value="' + (i + 1) + '"' + ((i + 1) === secili ? ' selected' : '') + '>' + ad + '</option>').join('');

  c.innerHTML =
    '<div class="cev-blok">' +
      '<div class="cev-baslik">📆 Miladi → Hicri</div>' +
      '<div class="cev-satir">' +
        '<input class="cev-in" id="cev-m-gun" type="number" inputmode="numeric" min="1" max="31" value="' + n.getDate() + '" aria-label="Gün">' +
        '<select class="cev-in cev-ay" id="cev-m-ay" aria-label="Ay">' + ayOpt(HV_MILADI_AYLAR, n.getMonth() + 1) + '</select>' +
        '<input class="cev-in" id="cev-m-yil" type="number" inputmode="numeric" min="' + HV_CEV_M_ALT + '" max="' + HV_CEV_M_UST + '" value="' + n.getFullYear() + '" aria-label="Yıl">' +
      '</div>' +
      '<button class="cev-btn" onclick="hvCevMiladiden()">Çevir</button>' +
      '<button class="cev-btn cev-btn-ikincil" onclick="hvCevBugun()">Bugünü getir</button>' +
      '<div id="cev-m-sonuc"></div>' +
    '</div>' +
    '<div class="cev-blok">' +
      '<div class="cev-baslik">🌙 Hicri → Miladi</div>' +
      '<div class="cev-satir">' +
        '<input class="cev-in" id="cev-h-gun" type="number" inputmode="numeric" min="1" max="30" value="' + h.g + '" aria-label="Gün">' +
        '<select class="cev-in cev-ay" id="cev-h-ay" aria-label="Ay">' + ayOpt(HV_HICRI_AYLAR, h.a) + '</select>' +
        '<input class="cev-in" id="cev-h-yil" type="number" inputmode="numeric" min="' + HV_CEV_H_ALT + '" max="' + HV_CEV_H_UST + '" value="' + h.y + '" aria-label="Yıl">' +
      '</div>' +
      '<button class="cev-btn" onclick="hvCevHicriden()">Çevir</button>' +
      '<div id="cev-h-sonuc"></div>' +
    '</div>' +
    '<div class="info-note">Çeviri, telefonunuzun Ümmü\'l-Kura takvimiyle yapılır ve internet gerektirmez. Hicri ay başları ülkeden ülkeye bir gün değişebilir; resmî günler için Diyanet takvimini esas alın.</div>';

  hvCevMiladiden();
  hvCevHicriden();
}
window.hvCevMiladiden = hvCevMiladiden;
window.hvCevHicriden = hvCevHicriden;
window.hvCevBugun = hvCevBugun;

/* ══════════ RAMAZAN İMSAKİYESİ ══════════ */
/* O ay için cihazda Diyanet verisi varsa tabloya o vakitler basılır. */
function hvImsakiyeDiyanet(loc, year, month) {
  try {
    if (typeof calCacheKey !== 'function') return {};
    const raw = localStorage.getItem(calCacheKey(loc.lat, loc.lng, year, month));
    if (!raw) return {};
    const m = {};
    (JSON.parse(raw) || []).forEach(e => { if (e && e.s === 'd' && e.t) m[e.date] = e.t; });
    return m;
  } catch (e) { return {}; }
}
let _imsakiyeDate = new Date();
function imsakiyeNav(delta) {
  _imsakiyeDate = new Date(_imsakiyeDate.getFullYear(), _imsakiyeDate.getMonth() + delta, 1);
  renderImsakiye();
}
window.imsakiyeNav = imsakiyeNav;
function trWeekdayShort(en) {
  return ({ Monday: 'Pzt', Tuesday: 'Sal', Wednesday: 'Çar', Thursday: 'Per', Friday: 'Cum', Saturday: 'Cmt', Sunday: 'Paz' })[en] || '';
}
async function renderImsakiye() {
  const c = document.getElementById('imsakiye-content');
  if (!c) return;
  const month = _imsakiyeDate.getMonth() + 1, year = _imsakiyeDate.getFullYear();
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const loc = (typeof APP_STATE !== 'undefined' && APP_STATE.userLocation) ? APP_STATE.userLocation : { lat: 41.01, lng: 28.97 };
  const cityLbl = (typeof APP_STATE !== 'undefined') ? `${APP_STATE.currentCity || ''}${APP_STATE.currentDistrict ? ', ' + APP_STATE.currentDistrict : ''}` : '';
  c.innerHTML = `
    <div class="imsakiye-nav">
      <button class="counter-btn minus" onclick="imsakiyeNav(-1)">‹</button>
      <div class="imsakiye-month">${monthNames[month - 1]} ${year}<div class="imsakiye-loc">📍 ${hvEsc(cityLbl)}</div></div>
      <button class="counter-btn plus" onclick="imsakiyeNav(1)">›</button>
    </div>
    <div class="info-note" id="imsakiye-loading">🔎 İmsakiye yükleniyor...</div>`;
  try {
    const res = await fetch(`https://api.aladhan.com/v1/calendar?latitude=${loc.lat}&longitude=${loc.lng}&method=13&month=${month}&year=${year}`);
    const json = await res.json();
    if (json && json.data && json.data.length) {
      const todayKey = hvTodayKey();
      const strip = t => (t || '').split(' ')[0];
      const dmap = hvImsakiyeDiyanet(loc, year, month);
      let diyanetGun = 0;
      const rows = json.data.map(d => {
        const g = d.date.gregorian;
        const dateKey = `${g.year}-${String(g.month.number).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
        // Diyanet'in resmî vakti varsa onu kullan
        const dv = dmap[dateKey];
        if (dv) diyanetGun++;
        const t = dv || d.timings;
        const isToday = dateKey === todayKey;
        return `<tr class="${isToday ? 'imsak-today' : ''}">
          <td class="im-day">${g.day}<span class="im-wd">${trWeekdayShort(g.weekday.en)}</span></td>
          <td>${strip(t.Imsak)}</td><td>${strip(t.Sunrise)}</td><td>${strip(t.Dhuhr)}</td>
          <td>${strip(t.Asr)}</td><td class="im-iftar">${strip(t.Maghrib)}</td><td>${strip(t.Isha)}</td>
        </tr>`;
      }).join('');
      const load = document.getElementById('imsakiye-loading');
      if (load) load.remove();
      // görsel paylaşım için satırları sakla
      window._hvImsakiyeVeri = { ay: monthNames[month - 1], yil: year, konum: cityLbl, satirlar: json.data.map(d => {
        const g = d.date.gregorian; const dateKey = `${g.year}-${String(g.month.number).padStart(2, '0')}-${String(g.day).padStart(2, '0')}`;
        const t = dmap[dateKey] || d.timings;
        return { gun: g.day, hafta: trWeekdayShort(g.weekday.en), bugun: dateKey === todayKey, imsak: strip(t.Imsak), gunes: strip(t.Sunrise), ogle: strip(t.Dhuhr), ikindi: strip(t.Asr), aksam: strip(t.Maghrib), yatsi: strip(t.Isha) };
      }) };
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <button class="gold-primary-btn" style="width:100%;margin:4px 0 10px;" onclick="hvImsakiyeGorselPaylas()">📤 İmsakiyeyi Görsel Olarak Paylaş</button>
        <div class="imsakiye-table-wrap">
          <table class="imsakiye-table">
            <thead><tr><th>Gün</th><th>İmsak</th><th>Güneş</th><th>Öğle</th><th>İkindi</th><th>Akşam</th><th>Yatsı</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="info-note" style="margin-top:8px;">Ramazan'da <b>İmsak</b> = sahurun sonu (orucun başı), <b>Akşam</b> = iftar vaktidir.</div>`;
      c.appendChild(wrap);
    } else { throw new Error('empty'); }
  } catch (e) {
    const load = document.getElementById('imsakiye-loading');
    if (load) load.textContent = '';
    c.insertAdjacentHTML('beforeend', '<div class="empty-note">İmsakiye için internet bağlantısı gerekiyor. Lütfen tekrar deneyin.</div>');
  }
}

/* İmsakiyeyi tek görsel (1080×1920) olarak paylaş — WhatsApp/Instagram (v65.1) */
function hvImsakiyeGorselPaylas() {
  const v = window._hvImsakiyeVeri;
  if (!v || !v.satirlar || !v.satirlar.length) { hvToast('⏳ Bekle', 'İmsakiye henüz yüklenmedi.'); return; }
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const rg = ctx.createRadialGradient(W / 2, 260, 80, W / 2, 260, 1400);
  rg.addColorStop(0, '#5C3B25'); rg.addColorStop(0.5, '#2A170C'); rg.addColorStop(1, '#160B04');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(227,173,130,0.45)'; ctx.lineWidth = 3; hvCardRoundRect(ctx, 40, 40, W - 80, H - 80, 40); ctx.stroke();
  const GOLD = '#E3AD82', CREAM = '#F7DDC4', WHITE = '#FDF6EE';
  ctx.textAlign = 'center';
  hvCardMoon(ctx, W / 2 - 250, 132, 26, GOLD, 0.95);
  ctx.fillStyle = CREAM; ctx.font = "700 62px 'Outfit', system-ui, sans-serif"; ctx.fillText('İMSAKİYE', W / 2 + 10, 152);
  ctx.fillStyle = GOLD; ctx.font = "600 40px 'Outfit', system-ui, sans-serif"; ctx.fillText(`${v.ay} ${v.yil}`, W / 2, 210);
  ctx.fillStyle = 'rgba(247,221,196,0.85)'; ctx.font = "500 32px 'Outfit', system-ui, sans-serif"; ctx.fillText('📍 ' + (v.konum || ''), W / 2, 258);
  // tablo
  const cols = ['Gün', 'İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];
  const x0 = 70, tw = W - 140, colW = [150, 135, 135, 135, 135, 135, 135];
  const y0 = 300, satirH = Math.min(46, Math.floor((H - y0 - 300) / (v.satirlar.length + 1)));
  let y = y0;
  ctx.fillStyle = 'rgba(227,173,130,0.18)'; hvCardRoundRect(ctx, x0, y, tw, satirH, 12); ctx.fill();
  ctx.fillStyle = GOLD; ctx.font = "700 26px 'Outfit', system-ui, sans-serif";
  let x = x0; cols.forEach((c, i) => { ctx.fillText(c, x + colW[i] / 2, y + satirH * 0.68); x += colW[i]; });
  y += satirH;
  v.satirlar.forEach((r, i) => {
    if (r.bugun) { ctx.fillStyle = 'rgba(227,173,130,0.30)'; ctx.fillRect(x0, y, tw, satirH); }
    else if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, y, tw, satirH); }
    ctx.fillStyle = r.bugun ? WHITE : CREAM; ctx.font = (r.bugun ? '700 ' : '500 ') + Math.round(satirH * 0.56) + "px 'Outfit', system-ui, sans-serif";
    const vals = [`${r.gun} ${r.hafta}`, r.imsak, r.gunes, r.ogle, r.ikindi, r.aksam, r.yatsi];
    x = x0; vals.forEach((t, j) => { if (j === 5) ctx.fillStyle = r.bugun ? WHITE : GOLD; ctx.fillText(t, x + colW[j] / 2, y + satirH * 0.68); if (j === 5) ctx.fillStyle = r.bugun ? WHITE : CREAM; x += colW[j]; });
    y += satirH;
  });
  // alt bilgi
  ctx.fillStyle = 'rgba(247,221,196,0.7)'; ctx.font = "500 26px 'Outfit', system-ui, sans-serif";
  ctx.fillText('İmsak = sahurun sonu · Akşam = iftar · Vakitler Diyanet takvimine göre', W / 2, H - 200);
  hvCardMoon(ctx, W / 2 - 120, H - 128, 22, GOLD, 0.95);
  ctx.fillStyle = CREAM; ctx.font = "600 40px 'Outfit', system-ui, sans-serif"; ctx.fillText('Namaz Dostu', W / 2 + 30, H - 114);
  hvOpenShareCard({ canvas: cv, fallbackText: `${v.ay} ${v.yil} İmsakiyesi — ${v.konum}\n` + v.satirlar.map(r => `${r.gun} ${r.hafta}: İmsak ${r.imsak} · İftar ${r.aksam}`).join('\n') });
}
window.hvImsakiyeGorselPaylas = hvImsakiyeGorselPaylas;

/* ══════════ ORUÇ TAKİBİ ══════════ */
function renderOruc() {
  const c = document.getElementById('oruc-content');
  if (!c) return;
  const data = hvLoad('oruc', {});
  const kaza = hvLoad('oruc_kaza', 0);
  const today = hvTodayKey();
  const todayDone = !!data[today];
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthCount = Object.keys(data).filter(k => data[k] && k.startsWith(ym)).length;
  const total = Object.keys(data).filter(k => data[k]).length;
  // seri: bugün (veya dün) ile biten kesintisiz gün sayısı
  let streak = 0; const d = new Date();
  if (!data[hvTodayKey(d)]) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) { if (data[hvTodayKey(d)]) { streak++; d.setDate(d.getDate() - 1); } else break; }
  // son 30 gün
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const dd = new Date(); dd.setDate(dd.getDate() - i);
    const key = hvTodayKey(dd);
    days.push({ n: dd.getDate(), on: !!data[key], isToday: i === 0 });
  }
  c.innerHTML = `
    <div class="takip-summary">
      <div class="ts-big">${streak}</div>
      <div class="ts-label">günlük oruç serisi</div>
    </div>
    <button class="prayer-check-row ${todayDone ? 'checked' : ''}" onclick="toggleOrucToday()">
      <span class="pc-label">${todayDone ? '🌙 Bugün oruç tuttum' : 'Bugün oruç tuttum'}</span>
      <span class="pc-box">${todayDone ? '✓' : ''}</span>
    </button>
    ${(() => { const tv = hvLoad('teravih', {}); const on = !!tv[today]; const ram = (typeof hvRamazanDurum === 'function') ? hvRamazanDurum() : null;
      const say = Object.keys(tv).filter(k => tv[k] && (!ram || !ram.baslangic || k >= ram.baslangic)).length;
      return `<button class="prayer-check-row ${on ? 'checked' : ''}" onclick="toggleTeravihToday()" style="margin-top:8px;">
        <span class="pc-label">${on ? '🕌 Bugün teravih kıldım' : 'Bugün teravih kıldım'}${ram && ram.durum === 'icinde' ? ` <small style="font-weight:400;color:var(--text-muted)">· Ramazan ${ram.gunNo}. gün · ${say} teravih</small>` : ''}</span>
        <span class="pc-box">${on ? '✓' : ''}</span>
      </button>`; })()}
    <div class="hatim-stat" style="margin-top:12px;">
      <div class="hs-item"><div class="hs-num">${monthCount}</div><div class="hs-lbl">Bu ay</div></div>
      <div class="hs-item"><div class="hs-num">${total}</div><div class="hs-lbl">Toplam</div></div>
      <div class="hs-item"><div class="hs-num">${kaza}</div><div class="hs-lbl">Kaza borcu</div></div>
    </div>
    <div class="section-mini-title">📅 Son 30 Gün</div>
    <div class="oruc-grid">${days.map(x => `<div class="oruc-day ${x.on ? 'on' : ''} ${x.isToday ? 'today' : ''}">${x.n}</div>`).join('')}</div>
    <div class="section-mini-title">🔄 Kaza Orucu</div>
    <div class="kaza-row">
      <span class="kaza-label">Tutulacak kaza orucu</span>
      <div class="counter-group">
        <button class="counter-btn minus" onclick="orucKazaAdjust(-1)">−</button>
        <span class="counter-val">${kaza}</span>
        <button class="counter-btn plus" onclick="orucKazaAdjust(1)">+</button>
      </div>
    </div>
    <div class="info-note">Ramazan, Şevval (6 gün), Aşure, Pazartesi-Perşembe gibi tüm oruçlarınızı işaretleyebilirsiniz. Kaza tuttukça sayacı azaltın.</div>`;
}
function toggleOrucToday() {
  const data = hvLoad('oruc', {});
  const t = hvTodayKey();
  data[t] = !data[t];
  hvSave('oruc', data);
  hvVibrate(15);
  renderOruc();
}
window.toggleOrucToday = toggleOrucToday;
function toggleTeravihToday() {
  const tv = hvLoad('teravih', {}); const t = hvTodayKey();
  tv[t] = !tv[t]; hvSave('teravih', tv); hvVibrate(15); renderOruc();
}
window.toggleTeravihToday = toggleTeravihToday;
function orucKazaAdjust(delta) {
  const k = Math.max(0, hvLoad('oruc_kaza', 0) + delta);
  hvSave('oruc_kaza', k);
  renderOruc();
}
window.orucKazaAdjust = orucKazaAdjust;

/* ══════════ FEATURE ROUTE KAYIT & BAŞLATMA ══════════ */
try { if (document.readyState !== 'loading') renderHizliErisim(); else document.addEventListener('DOMContentLoaded', renderHizliErisim); } catch (e) {}
window.FEATURE_ROUTES = {
  'onemli-sureler': renderOnemliSureler,
  'hac-umre': renderHacUmre,
  'namaz-nedir': renderNamazNedir,
  'kuran-nedir': renderKuranNedir,
  'tecvid': renderTecvid,
  'geceler': renderGeceler,
  'sifirdan': renderSifirdan,
  'esma': () => renderEsma(document.getElementById('esma-search-input') ? document.getElementById('esma-search-input').value : ''),
  'ezkar': () => switchEzkar(_ezkarMode),
  'gunluk-dua': () => renderGunlukDua(document.getElementById('gunluk-search-input') ? document.getElementById('gunluk-search-input').value : ''),
  'zikirmatik': renderZikirmatik,
  'namaz-takibi': renderNamazTakibi,
  'kaza': renderKaza,
  'hatim': renderHatim,
  'zekat': () => { renderZekat(); renderFitre(); },
  'fitre': () => { renderZekat(); renderFitre(); },
  'quiz': () => { if (!_quiz) renderQuizIntro(); },
  'bebek': () => renderBebek(document.getElementById('bebek-search-input') ? document.getElementById('bebek-search-input').value : ''),
  'cevirici': () => { renderTakvim(); renderCevirici(); tkSec('cevirici'); },
  'takvim': () => { renderTakvim(); renderCevirici(); tkSec('takvim'); },
  'paylasim': renderPaylasim,
  'taharet': () => switchTaharet(_taharetActive),
  'ozel-namaz': renderOzelNamazlar,
  'iman': renderImanEsaslari,
  'ayet-arama': renderAyetArama,
  'kirk-hadis': () => renderKirkHadis(document.getElementById('hadis-search-input') ? document.getElementById('hadis-search-input').value : ''),
  'siyer': renderSiyer,
  'peygamberler': renderPeygamberler,
  'sozluk': () => renderSozluk(document.getElementById('sozluk-search-input') ? document.getElementById('sozluk-search-input').value : ''),
  'imsakiye': renderImsakiye,
  'oruc': renderOruc,
  'quran': () => { if (typeof renderQuranTools === 'function') renderQuranTools(); },
  'kaynaklar': () => {}
};

/* ══════════ YEDEKLEME (DIŞA / İÇE AKTAR) ══════════ */
const HV_BACKUP_PREFIXES = ['hv_', 'namaz_vakti', 'qibla_'];
function hvBackupCollect() {
  const data = {};
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('hv_cal_')) return; // takvim önbelleği yeniden indirilir, yedeğe gerek yok
    if (HV_BACKUP_PREFIXES.some(p => k.startsWith(p))) data[k] = localStorage.getItem(k);
  });
  return { app: 'NamazDostu', version: 59, exportedAt: new Date().toISOString(), data };
}
function hvBackupExport() {
  const status = document.getElementById('backup-status');
  try {
    const payload = hvBackupCollect();
    const json = JSON.stringify(payload, null, 2);
    const count = Object.keys(payload.data).length;
    const d = new Date();
    const fname = `namazdostu-yedek-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (status) status.textContent = `✅ ${count} kayıt "${fname}" olarak indirildi.`;
    hvToast('💾 Yedek hazır', `${count} kayıt dışa aktarıldı.`);
  } catch (e) {
    if (status) status.textContent = '❌ Yedek oluşturulamadı: ' + e.message;
  }
}
function hvBackupImport(input) {
  const status = document.getElementById('backup-status');
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || (parsed.app !== 'NamazDostu' && parsed.app !== 'HuzurVakti') || typeof parsed.data !== 'object') throw new Error('Bu dosya bir Namaz Dostu yedeği değil.');
      let n = 0;
      Object.keys(parsed.data).forEach(k => {
        if (HV_BACKUP_PREFIXES.some(p => k.startsWith(p)) && typeof parsed.data[k] === 'string') {
          localStorage.setItem(k, parsed.data[k]); n++;
        }
      });
      if (status) status.textContent = `✅ ${n} kayıt geri yüklendi. Uygulama yenileniyor…`;
      hvToast('📥 Yedek yüklendi', `${n} kayıt geri getirildi.`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      if (status) status.textContent = '❌ ' + e.message;
      hvToast('❌ Geri yükleme başarısız', e.message);
    }
    input.value = '';
  };
  reader.onerror = () => { if (status) status.textContent = '❌ Dosya okunamadı.'; };
  reader.readAsText(file);
}
function hvShareApp() {
  hvShareText('🌙 Namaz Dostu — namaz vakitleri, Kur\'an, dualar, zikirmatik ve daha fazlası tek uygulamada. Ücretsiz, reklamsız, çevrimdışı çalışır:\nhttps://huzurvaktinamazuygulamasi.vercel.app');
}
window.hvBackupExport = hvBackupExport;
window.hvBackupImport = hvBackupImport;
window.hvShareApp = hvShareApp;
/* Görüş & Öneri: e-posta uygulamasını açar; açılamazsa adresi panoya kopyalar (v65.1) */
const HV_DESTEK_MAIL = 'fahrettinyaldiz@outlook.com';
function hvGorusGonder() {
  const platform = (typeof hvNativePlatform === 'function') ? hvNativePlatform() : 'web';
  const surum = (window.HV_SURUM || '');
  const konu = encodeURIComponent('Namaz Dostu v' + surum + ' — Görüş/Öneri (' + platform + ')');
  const govde = encodeURIComponent('Merhaba,\n\n');
  const url = 'mailto:' + HV_DESTEK_MAIL + '?subject=' + konu + '&body=' + govde;
  try { window.location.href = url; } catch (e) {}
  // Posta uygulaması yoksa (ör. bazı tabletler) adres elde kalsın
  setTimeout(() => {
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(HV_DESTEK_MAIL).catch(() => {}); } catch (e) {}
    if (typeof hvToast === 'function') hvToast('✉️ ' + HV_DESTEK_MAIL, 'Posta uygulaması açılmadıysa adres panoya kopyalandı.');
  }, 900);
}
window.hvGorusGonder = hvGorusGonder;

function featuresInit() {
  loadDailyAyet();

  const esmaSearch = document.getElementById('esma-search-input');
  if (esmaSearch) esmaSearch.addEventListener('input', e => renderEsma(e.target.value));

  const gunlukSearch = document.getElementById('gunluk-search-input');
  if (gunlukSearch) gunlukSearch.addEventListener('input', e => renderGunlukDua(e.target.value));



  const hadisSearch = document.getElementById('hadis-search-input');
  if (hadisSearch) hadisSearch.addEventListener('input', e => renderKirkHadis(e.target.value));

  const sozlukSearch = document.getElementById('sozluk-search-input');
  if (sozlukSearch) sozlukSearch.addEventListener('input', e => renderSozluk(e.target.value));

  const ayetSearch = document.getElementById('ayet-search-input');
  if (ayetSearch) ayetSearch.addEventListener('input', e => doAyetArama(e.target.value));

  const bebekSearch = document.getElementById('bebek-search-input');
  if (bebekSearch) bebekSearch.addEventListener('input', e => renderBebek(e.target.value));

  try { hvKonumBaslat(); } catch (e) {}
}


/* ═══════════════════════════════════════════════════════════════════════
   v61.7 — İLK AÇILIŞ KONUM SİHİRBAZI
   Uygulamayı ilk kez açan kullanıcı Yalova/Armutlu ile karşılaşmasın:
   listeden il/ilçesini kendisi seçer. (v66.4: otomatik GPS düğmesi
   sihirbazdan kaldırıldı; GPS hâlâ Ayarlar > Konum'da var.)
   Daha önce şehir seçmiş kullanıcılara hiç gösterilmez.
   ═══════════════════════════════════════════════════════════════════════ */

let hvNotifySonra = false;

function hvKonumGerekli() {
  try {
    if (localStorage.getItem('hv_konum_kuruldu') === '1') return false;
    // Eski kullanıcı: kayıtlı şehri varsa sihirbaza gerek yok
    const d = localStorage.getItem('namaz_vakti_v25');
    if (d) {
      const parsed = JSON.parse(d);
      if (parsed && parsed.currentCity) { localStorage.setItem('hv_konum_kuruldu', '1'); return false; }
    }
    // Üst üste 3 kez "sonra" derse artık rahatsız etme
    if (parseInt(localStorage.getItem('hv_konum_atla') || '0', 10) >= 3) return false;
    return true;
  } catch (e) { return false; }
}

function hvKonumHavuz() {
  const out = [];
  try {
    (typeof TURKEY_LOCATIONS !== 'undefined' ? TURKEY_LOCATIONS : []).forEach(p => {
      if (p.ilceler && p.ilceler.length) p.ilceler.forEach(d => out.push({ il: p.il, ilce: d.name }));
      else out.push({ il: p.il, ilce: 'Merkez' });
    });
  } catch (e) {}
  return out;
}

const HV_POPULER_IL = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya',
                       'Adana', 'Gaziantep', 'Şanlıurfa', 'Kocaeli', 'Mersin', 'Kayseri'];

function hvKonumVarsayilanListe() {
  const havuz = hvKonumHavuz();
  const out = [];
  HV_POPULER_IL.forEach(il => {
    const ilk = havuz.find(x => x.il === il);
    if (ilk) out.push(ilk);
  });
  return out;
}

function hvKonumListeCiz(q) {
  const g = document.getElementById('hv-konum-liste');
  if (!g) return;
  const ara = (typeof hvTrNorm === 'function') ? hvTrNorm(q) : String(q || '').toLowerCase();
  let liste;
  let baslik = '';

  if (!ara) {
    liste = hvKonumVarsayilanListe();
    baslik = '<div class="kn-baslik">En çok kullanılan şehirler</div>';
  } else {
    const puan = x => {
      const i = hvTrNorm(x.il), c = hvTrNorm(x.ilce);
      if (i === ara || c === ara) return 0;      // tam isabet
      if (i.indexOf(ara) === 0) return 1;        // il adı ile başlıyor
      if (c.indexOf(ara) === 0) return 2;        // ilçe adı ile başlıyor
      if (i.indexOf(ara) >= 0 || c.indexOf(ara) >= 0) return 3;
      return 9;
    };
    liste = hvKonumHavuz()
      .map(x => ({ x: x, p: puan(x) }))
      .filter(o => o.p < 9)
      .sort((a, b) => a.p - b.p)
      .slice(0, 60)
      .map(o => o.x);
  }

  if (!liste.length) {
    g.innerHTML = '<div class="kn-yok">Bulunamadı. İl ya da ilçe adını yazmayı dene.</div>';
    return;
  }

  g.innerHTML = baslik + liste.map(x =>
    `<button class="kn-sat" onclick="hvKonumSec('${String(x.il).replace(/'/g, "\\'")}','${String(x.ilce).replace(/'/g, "\\'")}')">
       <span class="kn-ilce">${x.ilce}</span>
       <span class="kn-il">${x.il}</span>
     </button>`).join('');
}
window.hvKonumListeCiz = hvKonumListeCiz;

function hvKonumKapat(kuruldu) {
  const k = document.getElementById('hv-konum-modal');
  if (k) k.remove();
  try {
    if (kuruldu) localStorage.setItem('hv_konum_kuruldu', '1');
    else {
      const n = parseInt(localStorage.getItem('hv_konum_atla') || '0', 10) + 1;
      localStorage.setItem('hv_konum_atla', String(n));
    }
  } catch (e) {}
  if (hvNotifySonra) {
    hvNotifySonra = false;
    setTimeout(() => {
      const m = document.getElementById('notify-permission-modal');
      if (m) m.style.display = 'flex';
    }, 450);
  }
}
window.hvKonumKapat = hvKonumKapat;

function hvKonumUygula(il, ilce, lat, lng) {
  try {
    APP_STATE.currentCity = il;
    APP_STATE.currentDistrict = ilce;
    APP_STATE.userLocation = { lat: lat, lng: lng };
  } catch (e) {}
  try { populateLocationsDropdown(); } catch (e) {}
  try { updateLocationHeaderLabel(); } catch (e) {}
  try { saveSettings(); } catch (e) {}
  try { fetchPrayerTimes(lat, lng); } catch (e) {}
  try { if (APP_STATE.currentPage === 'qibla') initQiblaCompass(); } catch (e) {}
}

function hvKonumSec(il, ilce) {
  let c = null;
  try { c = getSelectedCoordinates(il, ilce); } catch (e) {}
  if (!c) return;
  hvKonumUygula(il, ilce, c.lat, c.lng);
  hvKonumKapat(true);
  try { if (typeof showToast === 'function') showToast('📍 Konum: ' + ilce + ', ' + il); } catch (e) {}
}
window.hvKonumSec = hvKonumSec;

function hvKonumGps() {
  const d = document.getElementById('hv-konum-durum');
  const b = document.getElementById('hv-konum-gps');
  if (!navigator.geolocation) {
    if (d) d.textContent = 'Cihazın konum desteği yok. Aşağıdan şehrini seçebilirsin.';
    return;
  }
  if (d) { d.textContent = '📡 Konumun aranıyor…'; d.className = 'kn-durum bekle'; }
  if (b) b.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const glat = pos.coords.latitude, glng = pos.coords.longitude;
      // v66.4: en yakın gerçek ilçe; 60 km içindeyse o ilçenin koordinatı kullanılır
      // (vakitler Diyanet tablosundan gelsin, önbellek anahtarı sabit kalsın)
      let en = null;
      try { en = (typeof hvEnYakinIlce === 'function') ? hvEnYakinIlce(glat, glng) : null; } catch (e) {}
      if (!en) { if (b) b.disabled = false; if (d) d.textContent = '⚠️ Konum eşleştirilemedi, listeden seç.'; return; }
      const il = en.il, ilce = en.ilce;
      const lat = en.km <= 60 ? en.lat : glat, lng = en.km <= 60 ? en.lng : glng;
      try { APP_STATE.gpsKonum = { lat: glat, lng: glng }; } catch (e) {}
      hvKonumUygula(il, ilce, lat, lng);
      hvKonumKapat(true);
      try { if (typeof showToast === 'function') showToast('📍 Konum bulundu: ' + ilce + ', ' + il); } catch (e) {}
    },
    () => {
      if (b) b.disabled = false;
      if (d) { d.textContent = '⚠️ Konum izni verilmedi. Aşağıdan şehrini seçebilirsin.'; d.className = 'kn-durum uyari'; }
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}
window.hvKonumGps = hvKonumGps;

function hvKonumSihirbaziAc() {
  if (document.getElementById('hv-konum-modal')) return;
  const k = document.createElement('div');
  k.id = 'hv-konum-modal';
  k.className = 'kn-kok';
  k.innerHTML = `
    <div class="kn-kart">
      <div class="kn-rozet">📍</div>
      <h3>Nerede yaşıyorsun?</h3>
      <p class="kn-alt">Namaz vakitlerinin doğru olması için <b>il ya da ilçeni</b> aşağıdan seç.</p>

      <div class="kn-ara">
        <span>🔍</span>
        <input id="hv-konum-ara" type="search" autocomplete="off"
               placeholder="İl ya da ilçe yaz — ör. Konya, Kadıköy"
               oninput="hvKonumListeCiz(this.value)">
      </div>
      <div id="hv-konum-liste" class="kn-liste"></div>

      <button class="kn-sonra" onclick="hvKonumKapat(false)">Sonra seçerim</button>
    </div>
  `;
  document.body.appendChild(k);
  hvKonumListeCiz('');
}
window.hvKonumSihirbaziAc = hvKonumSihirbaziAc;

function hvKonumBaslat() {
  if (!hvKonumGerekli()) return;
  setTimeout(() => {
    hvKonumSihirbaziAc();
    // app.js bildirim penceresini ~1.4sn'de açıyor. Sihirbaz açıkken onu sıraya al.
    let sayac = 0;
    const bekci = setInterval(() => {
      if (!document.getElementById('hv-konum-modal') || ++sayac > 40) { clearInterval(bekci); return; }
      const m = document.getElementById('notify-permission-modal');
      if (m && m.style.display === 'flex') { m.style.display = 'none'; hvNotifySonra = true; }
    }, 150);
  }, 900);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', featuresInit);
} else {
  featuresInit();
}

/* ══════════ 30 GUNDE NAMAZA BASLANGIC (v60.9) ══════════ */
const NAMAZ_30GUN = [
  { g: 1, icon: '🌱', title: 'Niyet ve Karar', text: 'Namaz, kulun Rabbiyle günde beş kez buluşmasıdır. Bu yolculuğun ilk adımı büyük bilgi değil, sağlam bir karardır. Bugün kimseye söz vermene gerek yok; sadece kendine ve Rabbine \'başlıyorum\' de. Unutma, Allah az ama devamlı ameli sever.', task: 'Sessiz bir yerde iki dakika otur ve içinden \'Bugünden itibaren namaza başlıyorum, Allah\'ım bana kolaylık ver\' de.' },
  { g: 2, icon: '💧', title: 'Abdestin Farzları', text: 'Namazın anahtarı abdesttir. Abdestin dört farzı vardır: yüzü yıkamak, kolları dirseklerle beraber yıkamak, başın dörtte birini mesh etmek, ayakları topuklarla beraber yıkamak. Bunlar eksik olursa abdest olmaz.', task: 'Uygulamadaki \'Abdest & Taharet\' bölümünü aç, abdestin farzlarını oku ve bir kez abdest al.' },
  { g: 3, icon: '🚿', title: 'Abdesti Uygulamalı Öğren', text: 'Sünnetiyle birlikte abdest şöyledir: besmele, eller, ağız, burun, yüz, kollar, baş mesh, kulak-boyun, ayaklar. Sıra ve peş peşe yapmak sünnettir. Abdest bozan haller: tuvalet, yellenme, kan akması, derin uyku, bayılma.', task: 'Bugün en az iki kez abdest al ve sıralamayı ezberlemeye çalış.' },
  { g: 4, icon: '🧭', title: 'Kıble ve Namaz Vakitleri', text: 'Namaz Kâbe\'ye yönelerek kılınır. Uygulamadaki pusula sana yönü gösterir. Beş vakit: Sabah, Öğle, İkindi, Akşam, Yatsı. Her vaktin başlangıç ve bitişi vardır; vakit girmeden namaz kılınmaz.', task: 'Uygulamadan kıbleni bul, evinde namaz kılacağın yeri belirle. Beş vaktin isimlerini ve bugünkü saatlerini bir kez oku.' },
  { g: 5, icon: '📖', title: 'Sübhaneke', text: 'Namaza başlarken okunan ilk duadır. \'Sübhânekellâhümme ve bi-hamdik, ve tebârekesmük, ve teâlâ ceddük, ve lâ ilâhe ğayruk.\' Anlamı: Allah\'ım, Seni tesbih ve hamd ile anarım. Senin adın mübarektir, şanın yücedir, Senden başka ilah yoktur.', task: 'Sübhaneke\'yi 10 kez sesli tekrar et. Akşam ezberden okumaya çalış.' },
  { g: 6, icon: '🕮', title: 'Fâtiha Sûresi (1. Bölüm)', text: 'Fâtiha her rekâtta okunur, namazın olmazsa olmazıdır. İlk yarısı: \'Bismillâhirrahmânirrahîm. Elhamdü lillâhi rabbil âlemîn. Errahmânirrahîm. Mâliki yevmiddîn.\'', task: 'İlk dört ayeti 15 kez tekrar et. Uygulamadaki Kur\'an bölümünden Fâtiha\'yı dinle.' },
  { g: 7, icon: '🕮', title: 'Fâtiha Sûresi (2. Bölüm)', text: 'Devamı: \'İyyâke na\'büdü ve iyyâke nesteîn. İhdinâs sırâtal müstakîm. Sırâtallezîne en\'amte aleyhim, ğayril mağdûbi aleyhim ve leddâllîn.\' Anlamı: Yalnız sana kulluk eder, yalnız senden yardım isteriz. Bizi doğru yola ilet.', task: 'Fâtiha\'yı baştan sona 10 kez oku. Bugün ezberlemeyi hedefle.' },
  { g: 8, icon: '✨', title: 'İhlâs Sûresi', text: 'Kur\'an\'ın üçte birine denk sayılan kısa ve güçlü sûre: \'Kul hüvellâhü ehad. Allâhüs samed. Lem yelid ve lem yûled. Ve lem yekün lehû küfüven ehad.\' Anlamı: De ki: O Allah birdir, hiçbir şeye muhtaç değildir, doğurmamış ve doğmamıştır, hiçbir şey O\'na denk değildir.', task: 'İhlâs sûresini ezberle. Fâtiha + İhlâs\'ı arka arkaya okumayı dene.' },
  { g: 9, icon: '🤲', title: 'Rükû ve Secde Tesbihleri', text: 'Rükûda üç kez \'Sübhâne rabbiyel azîm\', secdede üç kez \'Sübhâne rabbiyel a\'lâ\' denir. Rükûdan doğrulurken \'Semiallâhü limen hamideh\', sonra \'Rabbenâ lekel hamd\' denir.', task: 'Bu üç cümleyi ezberle. Namazın hareketlerini (kıyam, rükû, secde, oturuş) aynada bir kez prova et.' },
  { g: 10, icon: '🪑', title: 'Ettehiyyâtü (Tahiyyat)', text: 'Oturuşta okunur: \'Ettehiyyâtü lillâhi vessalevâtü vettayyibât. Esselâmü aleyke eyyühen-nebiyyü ve rahmetullâhi ve berekâtüh. Esselâmü aleynâ ve alâ ibâdillâhis sâlihîn. Eşhedü en lâ ilâhe illallâh ve eşhedü enne Muhammeden abdühû ve rasûlüh.\'', task: 'Tahiyyat\'ı parça parça (üç bölüme ayırarak) çalış. Bugün ilk bölümü ezberle.' },
  { g: 11, icon: '🌸', title: 'Salli ve Bârik', text: 'Tahiyyat\'tan sonra son oturuşta okunur. \'Allâhümme salli alâ Muhammedin ve alâ âli Muhammed, kemâ salleyte alâ İbrâhîme ve alâ âli İbrâhîm, inneke hamîdün mecîd.\' Bârik duası da aynı kalıptadır, \'salli\' yerine \'bârik\' denir.', task: 'Salli ve Bârik\'i okumaya çalış. Tahiyyat\'ın kalan bölümünü tamamla.' },
  { g: 12, icon: '🙏', title: 'Rabbenâ Duaları', text: 'Namazın sonunda okunur: \'Rabbenâ âtinâ fid-dünyâ haseneten ve fil-âhireti haseneten ve kınâ azâben nâr.\' ve \'Rabbenâğfirlî ve li-vâlideyye ve lil-mü\'minîne yevme yekûmül hisâb.\'', task: 'Bu iki duayı ezberle. Artık namazın bütün duaları elinde — tebrikler!' },
  { g: 13, icon: '🌅', title: 'İlk Namaz: Sabahın Sünneti', text: 'Sabah namazının sünneti iki rekâttır ve en kolay başlangıçtır. Niyet et, tekbir al (Allahü ekber), Sübhaneke-Fâtiha-zamm-ı sûre oku, rükû, iki secde; ikinci rekâtta Fâtiha-sûre, rükû, secde, otur, Tahiyyat-Salli-Bârik-Rabbenâ, selam ver.', task: 'Bugün hayatındaki ilk 2 rekâtı kıl. Yanlış yapsan da kıl — Allah niyetine bakar.' },
  { g: 14, icon: '🌄', title: 'Sabah Namazının Farzı', text: 'Farz da iki rekâttır ve sünnetle aynı şekilde kılınır; sadece niyet farkı vardır. Sabah namazı en bereketli namazdır; Peygamberimiz onu asla terk etmezdi.', task: 'Bugün sabah namazını (2 sünnet + 2 farz) tam kıl. Uygulamadan bildirimi açmayı unutma.' },
  { g: 15, icon: '🔁', title: 'Devamlılık Günü', text: 'İlk hafta bitti, en zor kısmı geçtin. Şimdi hedef bir vakti hiç aksatmamak. Alışkanlık tekrarla oturur; bir gün kaçırırsan üzülüp bırakma, ertesi gün devam et.', task: 'Sabah namazını üç gün üst üste kılmayı hedefle. Uygulamadaki \'Namaz Takibi\' bölümünden işaretle.' },
  { g: 16, icon: '🌊', title: 'Kevser Sûresi', text: 'Zamm-ı sûre çeşitliliği için: \'İnnâ a\'taynâkel kevser. Fesalli li-rabbike venhar. İnne şânieke hüvel ebter.\' Anlamı: Şüphesiz biz sana Kevser\'i verdik. Öyleyse Rabbin için namaz kıl ve kurban kes. Asıl soyu kesik olan sana buğzedendir.', task: 'Kevser\'i ezberle. Sabah namazının ikinci rekâtında oku.' },
  { g: 17, icon: '🌇', title: 'Akşam Namazı (3 Rekât)', text: 'Akşam farzı üç rekâttır. İlk iki rekât normal, ikinci rekât sonunda oturulup sadece Tahiyyat okunur, kalkılır, üçüncü rekâtta sadece Fâtiha okunur, sonra son oturuş yapılır. Akşam vakti kısadır, geciktirme.', task: 'Bugün akşam namazının farzını kıl. Artık iki vakit kılıyorsun.' },
  { g: 18, icon: '🛡️', title: 'Nâs ve Felak Sûreleri', text: 'Koruyucu iki sûre. Felak: \'Kul eûzü bi-rabbil felak...\' Nâs: \'Kul eûzü bi-rabbin-nâs...\' Her ikisi de kötülüklerden Allah\'a sığınmayı öğretir. Yatmadan önce de okunur.', task: 'İkisini de ezberlemeye başla. Yatmadan önce oku.' },
  { g: 19, icon: '🌃', title: 'Yatsı Namazı (4 Rekât)', text: 'Yatsının farzı dört rekâttır. İlk iki rekâtta Fâtiha + sûre, son iki rekâtta sadece Fâtiha okunur. İkinci rekâtta oturulup Tahiyyat okunur.', task: 'Bugün yatsı namazının farzını kıl. Sabah, akşam, yatsı — üç vakit oldu.' },
  { g: 20, icon: '🌙', title: 'Vitir Namazı', text: 'Yatsıdan sonra kılınan üç rekâtlık vacip namazdır. Üçüncü rekâtta Fâtiha ve sûreden sonra tekbir alınır, eller kaldırılıp bağlanır ve Kunut duaları okunur.', task: 'Vitri öğren ve yatsıdan sonra kıl. Kunut duaları için uygulamadaki dua bölümüne bak.' },
  { g: 21, icon: '☀️', title: 'Öğle Namazı', text: 'Öğlenin farzı dört rekâttır, yatsının farzı gibi kılınır. İş veya okul arasında kılmak zor gelebilir; 10 dakikan yeter. Bir köşe ve temiz bir yer kâfidir.', task: 'Bugün öğle namazını kıl. Nerede kılabileceğini önceden planla.' },
  { g: 22, icon: '🌤️', title: 'İkindi Namazı', text: 'İkindinin farzı dört rekâttır. Kur\'an\'da \'orta namaz\'a özellikle dikkat çekilir; müfessirlerin çoğu bunun ikindi olduğunu söyler. Vakti dar olduğu için en çok kaçırılan namazdır.', task: 'Bugün ikindi namazını kıl. Bildirimi açık tut.' },
  { g: 23, icon: '🕔', title: 'Beş Vakit Tam', text: 'Bugün ilk kez beş vakti eksiksiz kılmayı deneyeceksin: Sabah 2+2, Öğle 4 farz, İkindi 4 farz, Akşam 3 farz, Yatsı 4 farz + 3 vitir. Sünnetleri sonra ekleyebilirsin.', task: 'Bugün beş vakti tam kıl. Uygulamada hepsini işaretle ve seriyi başlat.' },
  { g: 24, icon: '📿', title: 'Namaz Sonrası Tesbihat', text: 'Selamdan sonra: \'Allâhümme entes-selâm ve minkes-selâm\', Ayetel Kürsi, 33 Sübhanallah, 33 Elhamdülillah, 33 Allahü ekber, sonra dua. Bu, namazın tamamlayıcısıdır.', task: 'Bir vakit namazdan sonra tam tesbihat yap. Uygulamadaki Zikirmatik\'i kullan.' },
  { g: 25, icon: '👑', title: 'Ayetel Kürsi', text: 'Kur\'an\'ın en büyük ayeti sayılır. Her farz namazın ardından okuyanın cennete girmesine bir engel kalmadığı rivayet edilir. Uzun bir ayettir, parça parça ezberlemek en kolayıdır.', task: 'Ayetel Kürsi\'yi üç parçaya böl, ilk parçayı bugün ezberle.' },
  { g: 26, icon: '🔄', title: 'Kaza Namazları', text: 'Geçmişte kılamadığın namazlar borç olarak kalır. Panik yapma: her gün beş vakitle birlikte bir vakit kaza kılarsan borç zamanla erir. Önemli olan başlamaktır.', task: 'Uygulamadaki \'Kaza Namazı\' bölümünü aç, tahmini borcunu gir ve bugün bir kaza namazı kıl.' },
  { g: 27, icon: '🕌', title: 'Cemaat ve Cuma', text: 'Cemaatle namaz, tek başına kılmaktan 27 kat daha faziletlidir. Cuma namazı ise erkeklere farzdır. Camiye ilk gidişte utanma; herkes bir gün ilk kez gitmiştir.', task: 'Bir vakti camide cemaatle kıl. Mümkün değilse en yakın camiyi ve Cuma saatini öğren.' },
  { g: 28, icon: '💗', title: 'Huşû: Kalpten Kılmak', text: 'Namaz sadece hareket değil, huzurdur. Ne okuduğunu anlamaya çalış, acele etme, her secdede biraz dur. Telefonu uzak tut. Namaz kılarken Allah\'ın seni gördüğünü düşün.', task: 'Bugün bir vakti çok yavaş, anlamını düşünerek kıl. Farkı hisset.' },
  { g: 29, icon: '🛠️', title: 'Zorlukları Aşmak', text: 'Uyuyakalmak, iş yoğunluğu, yorgunluk, utanma... Hepsinin çaresi var: alarm + bildirim, çantada seccade, iş yerinde sessiz bir köşe, 10 dakikalık plan. Şeytanın en sevdiği cümle \'sonra kılarım\'dır.', task: 'Kendi en büyük engelini bir kâğıda yaz ve yanına çözümünü yaz. Sonra uygula.' },
  { g: 30, icon: '🏆', title: 'Ömür Boyu Devam', text: '30 gün bitti. Artık namazı biliyorsun ve kılıyorsun. Bundan sonrası devamlılık: bir gün aksarsa bırakma, ertesi gün kaldığın yerden devam et. Namaz bir yük değil, günün beş molasıdır.', task: 'Kendine söz ver: \'Ne olursa olsun namazı bırakmayacağım.\' Uygulamadaki takip serini büyütmeye devam et.' },
];

function hv30State() {
  const s = hvLoad('namaz30', { done: [], acik: 1 });
  if (!Array.isArray(s.done)) s.done = [];
  return s;
}
function hv30Toggle(g) {
  const s = hv30State();
  const i = s.done.indexOf(g);
  if (i >= 0) s.done.splice(i, 1); else s.done.push(g);
  hvSave('namaz30', s);
  renderNamazProgrami();
  if (i < 0) {
    const kalan = 30 - s.done.length;
    if (typeof hvToast === 'function') {
      if (kalan === 0) hvToast('🏆 Tebrikler!', '30 günlük programı tamamladın. Allah kabul etsin.');
      else hvToast('✅ ' + g + '. gün tamam', kalan + ' gün kaldı. Devam!');
    }
  }
}
function hv30Ac(g) {
  const s = hv30State();
  s.acik = (s.acik === g) ? 0 : g;
  hvSave('namaz30', s);
  renderNamazProgrami();
  setTimeout(function () {
    const el = document.getElementById('hv30-gun-' + g);
    if (el && s.acik === g) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}
function hv30Sifirla() {
  hvSave('namaz30', { done: [], acik: 1 });
  renderNamazProgrami();
  if (typeof hvToast === 'function') hvToast('🔄 Sıfırlandı', 'Program baştan başlıyor.');
}
function renderNamazProgrami() {
  const c = document.getElementById('namaz-programi-content');
  if (!c) return;
  const s = hv30State();
  const done = s.done.length;
  const pct = Math.round((done / 30) * 100);
  const sonraki = NAMAZ_30GUN.find(function (d) { return s.done.indexOf(d.g) < 0; });

  let html = '';
  html += '<div class="hv30-top">';
  html += '<div class="hv30-ring" style="--p:' + pct + '"><span class="hv30-pct">%' + pct + '</span></div>';
  html += '<div class="hv30-topinfo">';
  html += '<div class="hv30-topbig">' + done + ' / 30 gün</div>';
  html += '<div class="hv30-topsub">' + (sonraki ? 'Sıradaki: ' + sonraki.g + '. gün — ' + sonraki.title : 'Programı tamamladın, Allah kabul etsin 🤲') + '</div>';
  html += '</div></div>';
  html += '<div class="hv30-bar"><div class="hv30-bar-fill" style="width:' + pct + '%"></div></div>';
  html += '<p class="hv30-intro">Namaza sıfırdan başlayanlar için 30 günlük yol haritası. Her gün küçük bir bilgi ve küçük bir görev. Aceleye gerek yok — kaçırdığın gün olursa kaldığın yerden devam et.</p>';

  html += '<div class="hv30-list">';
  NAMAZ_30GUN.forEach(function (d) {
    const ok = s.done.indexOf(d.g) >= 0;
    const acik = s.acik === d.g;
    html += '<div class="hv30-item' + (ok ? ' done' : '') + (acik ? ' open' : '') + '" id="hv30-gun-' + d.g + '">';
    html += '<div class="hv30-head" onclick="hv30Ac(' + d.g + ')">';
    html += '<span class="hv30-num">' + d.g + '</span>';
    html += '<span class="hv30-icon">' + d.icon + '</span>';
    html += '<span class="hv30-title">' + d.title + '</span>';
    html += '<span class="hv30-chev">' + (ok ? '✅' : (acik ? '▲' : '▼')) + '</span>';
    html += '</div>';
    if (acik) {
      html += '<div class="hv30-body">';
      html += '<p class="hv30-text">' + d.text + '</p>';
      html += '<div class="hv30-task"><strong>🎯 Bugünkü görev</strong><span>' + d.task + '</span></div>';
      html += '<button class="hv30-btn' + (ok ? ' undo' : '') + '" onclick="hv30Toggle(' + d.g + ')">' + (ok ? '↩️ İşareti kaldır' : '✅ Bu günü tamamladım') + '</button>';
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  html += '<button class="hv30-reset" onclick="hv30Sifirla()">🔄 Programı sıfırla</button>';
  c.innerHTML = html;
}
try { if (window.FEATURE_ROUTES) window.FEATURE_ROUTES['namaz-programi'] = renderNamazProgrami; } catch (e) {}

/* ══════════ v61.0 — GÖRSEL PAYLAŞIM KARTI ══════════
   Düz metin yerine 1080x1920 marka görseli üretir ve onu paylaşır.
   WhatsApp durumu / Instagram hikayesi için doğru ölçü.        */

const HV_CARD_W = 1080, HV_CARD_H = 1920;
let _hvCardBg = null, _hvCardBgTried = false;

function hvCardLoadBg() {
  return new Promise((resolve) => {
    if (_hvCardBg || _hvCardBgTried) return resolve(_hvCardBg);
    _hvCardBgTried = true;
    const img = new Image();
    img.onload = () => { _hvCardBg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = 'bg-mosque.jpg';
  });
}

// Metni kutuya sığdır: font boyutunu küçülterek satırlara böl
function hvCardFit(ctx, text, maxW, maxH, opts) {
  const o = opts || {};
  let size = o.max || 62;
  const min = o.min || 26;
  const weight = o.weight || '600';
  const family = o.family || "'Outfit', system-ui, -apple-system, sans-serif";
  const lh = o.lineHeight || 1.42;
  while (size >= min) {
    ctx.font = `${weight} ${size}px ${family}`;
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
      else line = t;
    }
    if (line) lines.push(line);
    if (lines.length * size * lh <= maxH) return { size, lines, lh, family, weight };
    size -= 2;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return { size: min, lines: [String(text)], lh, family, weight };
}


function hvCardRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function hvCardMoon(ctx, cx, cy, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = (alpha == null ? 1 : alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2, false);
  ctx.arc(cx + r * 0.44, cy - r * 0.2, r * 0.9, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();
}

async function hvBuildShareCard(data) {
  const d = data || {};
  const cv = document.createElement('canvas');
  cv.width = HV_CARD_W; cv.height = HV_CARD_H;
  const ctx = cv.getContext('2d');

  // ── Zemin: koyu bakır ──
  ctx.fillStyle = '#160B04';
  ctx.fillRect(0, 0, HV_CARD_W, HV_CARD_H);

  // ── Desenli arka plan (varsa) + bakır tonlama ──
  const bg = await hvCardLoadBg();
  if (bg) {
    const s = Math.max(HV_CARD_W / bg.width, HV_CARD_H / bg.height);
    const w = bg.width * s, h = bg.height * s;
    ctx.drawImage(bg, (HV_CARD_W - w) / 2, (HV_CARD_H - h) / 2, w, h);
    // yeşil tonu bakıra çevir
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = '#9A6634';
    ctx.fillRect(0, 0, HV_CARD_W, HV_CARD_H);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const rg = ctx.createRadialGradient(HV_CARD_W/2, HV_CARD_H*0.34, 60, HV_CARD_W/2, HV_CARD_H*0.34, HV_CARD_H*0.72);
    rg.addColorStop(0, '#5C3B25'); rg.addColorStop(0.55, '#2A170C'); rg.addColorStop(1, '#160B04');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, HV_CARD_W, HV_CARD_H);
  }

  // ── Okunurluk perdesi (A2: açık zemin, desen görünsün) ──
  const vg = ctx.createLinearGradient(0, 0, 0, HV_CARD_H);
  vg.addColorStop(0, 'rgba(26,13,5,0.50)');
  vg.addColorStop(0.45, 'rgba(26,13,5,0.30)');
  vg.addColorStop(1, 'rgba(14,7,2,0.76)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, HV_CARD_W, HV_CARD_H);

  const GOLD = '#E3AD82', CREAM = '#F7DDC4', WHITE = '#FDF6EE';
  const M = 82;
  const cx = HV_CARD_W / 2;

  // ── İnce altın çerçeve ──
  ctx.strokeStyle = 'rgba(227,173,130,0.45)';
  ctx.lineWidth = 3;
  hvCardRoundRect(ctx, 48, 48, HV_CARD_W - 96, HV_CARD_H - 96, 44);
  ctx.stroke();

  ctx.textAlign = 'center';

  // ── Gövde: etiket → arapça → ayraç → meal → kaynak (dikeyde ortalı) ──
  const label = String(d.badge || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
    .trim().toLocaleUpperCase('tr');

  const boxW = HV_CARD_W - M * 2;
  const TOP = 250, BOTTOM = HV_CARD_H - 470;   // Instagram hikayesi güvenli alanı
  const avail = BOTTOM - TOP;

  const LBL = 52;
  const lblH = label ? LBL + 58 : 0;

  let arFit = null, arH = 0;
  if (d.arabic) {
    arFit = hvCardFit(ctx, d.arabic, boxW, avail * 0.28, {
      max: 76, min: 36, weight: '400',
      family: "'Amiri', 'Traditional Arabic', serif", lineHeight: 1.85
    });
    arH = arFit.lines.length * arFit.size * arFit.lh + 112;
  }

  const bodyFit = hvCardFit(ctx, '\u201C' + (d.text || '') + '\u201D', boxW,
    avail - lblH - arH - 130, { max: 80, min: 34, weight: '500', lineHeight: 1.36 });
  const bodyH = bodyFit.lines.length * bodyFit.size * bodyFit.lh;
  const srcH = d.source ? 118 : 0;

  let y = TOP + Math.max(0, (avail - (lblH + arH + bodyH + srcH)) / 2);

  if (label) {
    y += LBL;
    ctx.fillStyle = GOLD;
    ctx.font = `600 ${LBL}px 'Outfit', system-ui, sans-serif`;
    ctx.letterSpacing = '6px';
    ctx.fillText(label, cx, y);
    ctx.letterSpacing = '0px';
    y += 58;
  }

  if (arFit) {
    ctx.fillStyle = CREAM;
    ctx.font = `${arFit.weight} ${arFit.size}px ${arFit.family}`;
    ctx.direction = 'rtl';
    for (const ln of arFit.lines) { y += arFit.size * arFit.lh; ctx.fillText(ln, cx, y); }
    ctx.direction = 'ltr';
    y += 50;
    ctx.strokeStyle = 'rgba(227,173,130,0.40)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 82, y); ctx.lineTo(cx + 82, y); ctx.stroke();
    y += 62;
  }

  ctx.fillStyle = WHITE;
  ctx.font = `${bodyFit.weight} ${bodyFit.size}px ${bodyFit.family}`;
  for (const ln of bodyFit.lines) { y += bodyFit.size * bodyFit.lh; ctx.fillText(ln, cx, y); }

  if (d.source) {
    y += 82;
    ctx.fillStyle = GOLD;
    ctx.font = "600 42px 'Outfit', system-ui, sans-serif";
    ctx.fillText('\u2014 ' + d.source, cx, y);
  }

  // ── Alt imza: hilal + isim (üst üste binmez) ──
  ctx.strokeStyle = 'rgba(227,173,130,0.30)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 140, HV_CARD_H - 344); ctx.lineTo(cx + 140, HV_CARD_H - 344); ctx.stroke();

  const SS = 52, GAP = 24, name = 'Namaz Dostu';
  ctx.font = `600 ${SS}px 'Outfit', system-ui, sans-serif`;
  const tw = ctx.measureText(name).width;
  const r = SS * 0.46;
  const x0 = cx - (r * 2 + GAP + tw) / 2;
  hvCardMoon(ctx, x0 + r, HV_CARD_H - 264 - SS * 0.34, r, GOLD, 0.95);
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  ctx.fillText(name, x0 + r * 2 + GAP, HV_CARD_H - 264);
  ctx.textAlign = 'center';

  return cv;
}

// Görsel önizleme + paylaş penceresi
async function hvOpenShareCard(data) {
  const d = data || {};
  let cv;
  try { cv = d.canvas || await hvBuildShareCard(d); }
  catch (e) { console.warn('Kart üretilemedi:', e); return hvShareText(d.fallbackText || d.text || ''); }

  const dataUrl = cv.toDataURL('image/png');
  const old = document.getElementById('hv-share-modal');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'hv-share-modal';
  wrap.className = 'hv-sc-backdrop';
  wrap.innerHTML = `
    <div class="hv-sc-box">
      <img class="hv-sc-img" src="${dataUrl}" alt="Paylaşım görseli">
      <div class="hv-sc-actions">
        <button class="hv-sc-btn hv-sc-primary" id="hv-sc-share">📤 Paylaş</button>
        <button class="hv-sc-btn" id="hv-sc-save">⬇️ Kaydet</button>
        <button class="hv-sc-btn hv-sc-ghost" id="hv-sc-text">Yazı olarak paylaş</button>
      </div>
      <button class="hv-sc-close" id="hv-sc-close">Kapat</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.getElementById('hv-sc-close').onclick = () => wrap.remove();

  const toBlob = () => new Promise((res) => cv.toBlob(res, 'image/png', 0.95));

  document.getElementById('hv-sc-share').onclick = async () => {
    // Android uygulaması: yerel köprü ile paylaş (WebView'de dosya paylaşımı yok)
    try {
      const bridge = window.webkit && window.webkit.messageHandlers
        && window.webkit.messageHandlers['share-image'];
      if (window.hvIsAndroid && bridge) {
        bridge.postMessage({ data: dataUrl });
        wrap.remove();
        return;
      }
    } catch (e) { console.warn('Köprü ile paylaşılamadı:', e); }

    try {
      const blob = await toBlob();
      const file = new File([blob], 'namaz-dostu.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        wrap.remove();
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    // görsel paylaşılamıyorsa yazıya düş
    hvShareText(d.fallbackText || d.text || '');
    wrap.remove();
  };

  document.getElementById('hv-sc-save').onclick = () => {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'namaz-dostu.png';
    document.body.appendChild(a); a.click(); a.remove();
    if (typeof hvToast === 'function') hvToast('⬇️ Kaydedildi', 'Görsel galerine indi, oradan paylaşabilirsin.');
  };

  document.getElementById('hv-sc-text').onclick = () => {
    hvShareText(d.fallbackText || d.text || '');
    wrap.remove();
  };
}
window.hvOpenShareCard = hvOpenShareCard;
window.hvBuildShareCard = hvBuildShareCard;

/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — MUSHAF (SAYFA SAYFA KUR'AN-I KERİM)
   Kaynak: alquran.cloud  •  Sayfa numaraları standart 604 sayfalık
   mushaf düzenidir (Diyanet basımıyla aynı).
   Ses: her ayet ayrı dosya → okunan ayet vurgulanabiliyor.
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   v61.8 — DİYANET MEÂLİ (uygulamanın içinde)
   6236 âyetin tamamı meal.js dosyasında. Dosya, meal ilk kez
   gösterileceği zaman yüklenir; sonrası internetsiz de çalışır.
   ═══════════════════════════════════════════════════════════════════════ */
let hvMealSozu = null;
function hvMealHazir() {
  if (window.DIYANET_MEAL) return Promise.resolve(true);
  if (hvMealSozu) return hvMealSozu;
  hvMealSozu = new Promise(cozum => {
    const e = document.createElement('script');
    e.src = 'meal.js?v=' + (window.HV_SURUM || '61.8.0');
    e.onload  = () => cozum(!!window.DIYANET_MEAL);
    e.onerror = () => { hvMealSozu = null; cozum(false); };
    document.head.appendChild(e);
  });
  return hvMealSozu;
}
window.hvMealHazir = hvMealHazir;

function hvMeal(sure, ayet) {
  try {
    const a = window.DIYANET_MEAL[String(sure)];
    return (a && a[ayet - 1]) ? a[ayet - 1] : '';
  } catch (e) { return ''; }
}
window.hvMeal = hvMeal;

/* Diyanet bazı âyetleri birleştirerek çevirmiştir (ör. "2, 3, 4.").
   Bu âyet öyle bir grubun içindeyse {bas, son} döner. */
function hvMealGrup(sure, ayet) {
  try {
    const g = window.DIYANET_MEAL_GRUP[String(sure)];
    if (!g) return null;
    for (let i = 0; i < g.length; i++) {
      if (ayet >= g[i][0] && ayet <= g[i][1]) return { bas: g[i][0], son: g[i][1] };
    }
  } catch (e) {}
  return null;
}
window.hvMealGrup = hvMealGrup;

/* Ekranda gösterilecek âyet numarası etiketi: tek âyet "5", grup "2-4" */
function hvMealEtiket(sure, ayet) {
  const g = hvMealGrup(sure, ayet);
  return g ? (g.bas + '-' + g.son) : String(ayet);
}
window.hvMealEtiket = hvMealEtiket;

/* Grubun ilk âyeti mi? (listede metni bir kez yazmak için) */
/* Arama için normalize edilmiş dizin — bir kez kurulur */
let hvMealIdx = null;
function hvMealIndeks() {
  if (hvMealIdx) return hvMealIdx;
  hvMealIdx = [];
  try {
    const adlar = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : [];
    for (let sn = 1; sn <= 114; sn++) {
      const dizi = window.DIYANET_MEAL[String(sn)] || [];
      const sr = adlar.find(x => Number(x.id) === sn);
      let onceki = null;
      for (let i = 0; i < dizi.length; i++) {
        const metin = dizi[i];
        if (!metin || metin === onceki) { onceki = metin; continue; }
        onceki = metin;
        hvMealIdx.push({ s: sn, ad: sr ? sr.name : (sn + '. Sûre'), v: i + 1, t: metin, n: hvTrNorm(metin) });
      }
    }
  } catch (e) {}
  return hvMealIdx;
}
window.hvMealIndeks = hvMealIndeks;

function hvMealGrupIlk(sure, ayet) {
  const g = hvMealGrup(sure, ayet);
  return !g || g.bas === ayet;
}
window.hvMealGrupIlk = hvMealGrupIlk;

const HV_MUSHAF_SON = 604;

const HV_QARILER = [
  { id: 'ar.husary',             ad: 'Mahmud Halil el-Husarî' },
  { id: 'ar.alafasy',            ad: 'Mishary Rashid Alafasy' },
  { id: 'ar.abdulsamad',         ad: 'Abdulbasit Abdussamed' },
  { id: 'ar.mahermuaiqly',       ad: 'Maher Al Muaiqly' },
  { id: 'ar.abdurrahmaansudais', ad: 'Abdurrahman es-Sudeys' },
  { id: 'ar.saoodshuraym',       ad: 'Suud eş-Şureym' }
];

function hvGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
function hvSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }

// Arap rakamları (١٢٣)
function hvArNum(n) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]); }

// Ayet 1'in başındaki besmeleyi ayırır (alquran.cloud besmeleyi 1. ayete ekliyor)
function hvBesmeleAyir(text) {
  const hedef = 'بسماللهالرحمنالرحيم';
  let sade = '', harita = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[ؐ-ًؚ-ٰٟۖ-ۭـ\s]/.test(ch)) continue;
    sade += (ch === 'ٱ' ? 'ا' : ch);
    harita.push(i);
  }
  if (sade.indexOf(hedef) === 0 && harita.length > hedef.length) {
    const kes = harita[hedef.length - 1] + 1;
    return { besmele: text.slice(0, kes).trim(), kalan: text.slice(kes).trim() };
  }
  return { besmele: '', kalan: text };
}

/* ── Sayfa önbelleği (internetsiz okuma) ───────────────────────────── */
const HV_MP_IDX = 'hv_mushaf_idx2';

function hvMushafOnbellekAl(p) {
  try { const r = localStorage.getItem('hv_mp2_' + p); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
function hvMushafOnbellekYaz(p, veri) {
  try {
    localStorage.setItem('hv_mp2_' + p, JSON.stringify(veri));
    let idx = [];
    try { idx = JSON.parse(localStorage.getItem(HV_MP_IDX) || '[]'); } catch (e) {}
    idx = idx.filter(x => x !== p); idx.push(p);
    while (idx.length > 120) { const eski = idx.shift(); try { localStorage.removeItem('hv_mp2_' + eski); } catch (e) {} }
    localStorage.setItem(HV_MP_IDX, JSON.stringify(idx));
  } catch (e) {
    // Depolama doldu → mushaf önbelleğini boşalt, uygulamanın gerisi etkilenmesin
    try {
      const idx = JSON.parse(localStorage.getItem(HV_MP_IDX) || '[]');
      idx.forEach(x => { try { localStorage.removeItem('hv_mp2_' + x); } catch (e2) {} });
      localStorage.setItem(HV_MP_IDX, '[]');
    } catch (e2) {}
  }
}

async function hvMushafSayfaGetir(p) {
  const c = hvMushafOnbellekAl(p);
  if (c && c.length) return c;

  const arRes = await fetch('https://api.alquran.cloud/v1/page/' + p + '/quran-uthmani');
  const arJson = await arRes.json();
  if (!arJson || !arJson.data || !Array.isArray(arJson.data.ayahs)) throw new Error('Sayfa alınamadı');

  // Meal artık uygulamanın içinde (Diyanet meal.js) — internet gerekmez
  await hvMealHazir();

  const veri = arJson.data.ayahs.map(a => ({
    n: a.number,
    s: a.surah.number,
    sadi: a.surah.englishName,
    sar: a.surah.name,
    v: a.numberInSurah,
    ar: a.text,
    tr: hvMeal(a.surah.number, a.numberInSurah)
  }));
  hvMushafOnbellekYaz(p, veri);
  return veri;
}

/* ── Ses ───────────────────────────────────────────────────────────── */
let hvMvSes = null, hvMvSira = [], hvMvKonum = -1, hvMvCalisiyor = false;

function hvMvSesNesnesi() {
  if (!hvMvSes) {
    hvMvSes = new Audio();
    hvMvSes.preload = 'auto';
    hvMvSes.addEventListener('ended', () => { hvMvAyetBitti(); });
    hvMvSes.addEventListener('timeupdate', hvMvIlerleme);
    hvMvSes.addEventListener('loadedmetadata', hvMvIlerleme);
    // Ses gelmezse ayetleri hızla atlamak yerine dur ve haber ver
    hvMvSes.addEventListener('error', () => {
      hvMvDurdur();
      try { showToastNotification('🔇 Ses yüklenemedi', 'İnternet bağlantını kontrol et ya da başka bir okuyucu seç.'); } catch (e) {}
    });
  }
  return hvMvSes;
}

/* mm:ss */
function hvSure2(sn) {
  sn = Math.max(0, Math.floor(sn || 0));
  return Math.floor(sn / 60) + ':' + String(sn % 60).padStart(2, '0');
}

/* Okurken âyetin üstünde yavaşça ilerleyen vurgu + süre göstergesi */
/* Âyeti kelimelere ayır (bir kez) — vurgu kelime kelime ilerlesin */
function hvMvKelimele(el) {
  if (!el || el.dataset.kelimeli === '1') return;
  const num = el.querySelector('.mv-num');
  const numHtml = num ? num.outerHTML : '';
  if (num) num.remove();
  const txt = (el.textContent || '').trim();
  if (!txt) { el.dataset.kelimeli = '1'; return; }
  el.innerHTML = txt.split(/\s+/).filter(Boolean)
    .map(k => '<span class="mv-w">' + hvEsc(k) + '</span>').join(' ') + numHtml;
  el.dataset.kelimeli = '1';
}

function hvMvIlerleme() {
  const s = hvMvSes;
  if (!s) return;
  const oran = (s.duration && isFinite(s.duration)) ? Math.min(1, s.currentTime / s.duration) : 0;
  document.querySelectorAll('.mv-ayah.okunuyor').forEach(el => {
    el.style.setProperty('--hv-oran', (oran * 100).toFixed(1) + '%');
    const ks = el.querySelectorAll('.mv-w');
    if (!ks.length) return;
    const k = Math.round(oran * ks.length);
    for (let i = 0; i < ks.length; i++) ks[i].classList.toggle('gecti', i < k);
  });
  const g = document.getElementById('mv-gecen'), t = document.getElementById('mv-toplam');
  const c = document.getElementById('mv-cizgi');
  if (g) g.textContent = hvSure2(s.currentTime);
  if (t) t.textContent = (s.duration && isFinite(s.duration)) ? hvSure2(s.duration) : '--:--';
  if (c && !c.dataset.tutuluyor) c.value = String(Math.round(oran * 100));
  const g2 = document.getElementById('te-gecen'), t2 = document.getElementById('te-toplam');
  if (g2) g2.textContent = hvSure2(s.currentTime);
  if (t2) t2.textContent = (s.duration && isFinite(s.duration)) ? hvSure2(s.duration) : '--:--';
}
window.hvMvIlerleme = hvMvIlerleme;

/* Sesi konumlandır */
function hvMvSar(deger) {
  const s = hvMvSes;
  if (s && s.duration && isFinite(s.duration)) { try { s.currentTime = (deger / 100) * s.duration; } catch (e) {} }
}
window.hvMvSar = hvMvSar;

/* Arapça bitti → moda göre meâli oku ya da sıradaki âyete geç */
function hvMvAyetBitti() {
  if (!hvMvCalisiyor) return;
  if (hvGet('hv_mushaf_mode', 'ar') === 'both') { hvMvMealOku(); return; }
  hvMvSonraki();
}

/* Sayfadaki âyetin Türkçe meâlini oku (Meal ve Arapça+Meal modlarında) */
function hvMvMealOku() {
  const r = hvMvRef[hvMvSira[hvMvKonum]];
  const metin = r ? hvMeal(r[0], r[1]) : '';
  const oncekiR = hvMvKonum > 0 ? hvMvRef[hvMvSira[hvMvKonum - 1]] : null;
  const onceki = oncekiR ? hvMeal(oncekiR[0], oncekiR[1]) : '';
  // Diyanet'in birleştirdiği meâl iki kez okunmasın
  if (!metin || metin === onceki || !hvTtsTurkceVarMi()) { hvMvSonraki(); return; }
  hvTtsOku(metin, () => { if (hvMvCalisiyor) hvMvSonraki(); });
}

/* Okunan âyeti bul, vurgula ve kapsayıcıyı yavaşça ortala */
function hvMvKaydirilabilir(el) {
  let p = el && el.parentElement;
  while (p && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight - p.clientHeight > 8) return p;
    p = p.parentElement;
  }
  return null;
}

function hvMvVurgula(n) {
  document.querySelectorAll('.mv-ayah.okunuyor, .mv-meal.okunuyor, .te-m-ayet.okunuyor')
    .forEach(el => {
      el.classList.remove('okunuyor');
      el.style.removeProperty('--hv-oran');
      el.querySelectorAll('.mv-w.gecti').forEach(w => w.classList.remove('gecti'));
    });
  if (!n) return;

  // Tam ekran açıksa oradaki kopyayı hedefle (aynı id iki yerde bulunuyor)
  const tam = document.getElementById('mv-full');
  const tamAcik = tam && getComputedStyle(tam).display !== 'none';
  const kok = tamAcik ? tam : document;

  const a = kok.querySelector('#mv-a-' + n) || document.getElementById('mv-a-' + n);
  const m = kok.querySelector('#mv-m-' + n) || kok.querySelector('#te-m-' + n)
            || document.getElementById('mv-m-' + n) || document.getElementById('te-m-' + n);
  if (m) m.classList.add('okunuyor');
  const rr = hvMvRef[n];
  if (rr) hvSureSeritYaz(rr[0]);
  if (!a) return;
  a.classList.add('okunuyor');
  hvMvKelimele(a);

  const kap = hvMvKaydirilabilir(a);
  if (!kap) { try { a.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} return; }
  const k = kap.getBoundingClientRect(), r = a.getBoundingClientRect();
  const hedef = kap.scrollTop + (r.top - k.top) - (k.height / 2) + (r.height / 2);
  const son = Math.max(0, Math.min(kap.scrollHeight - kap.clientHeight, hedef));
  try { kap.scrollTo({ top: son, behavior: 'smooth' }); } catch (e) { kap.scrollTop = son; }
}

/* Sayfadaki âyetlerin sûre/âyet karşılığı — ses adresi için gerekir */
let hvMvRef = {};

function hvMvCal(i) {
  if (i < 0 || i >= hvMvSira.length) { hvMvDurdur(); return; }
  hvMvKonum = i;
  hvMvCalisiyor = true;
  hvMvVurgula(hvMvSira[i]);
  hvMvDugmeTazele();

  // "Meal" modunda Arapça çalınmaz, doğrudan Türkçe okunur
  if (hvGet('hv_mushaf_mode', 'ar') === 'tr') {
    try { if (hvMvSes) hvMvSes.pause(); } catch (e) {}
    hvMvMealOku();
    return;
  }

  const ses = hvMvSesNesnesi();
  const r = hvMvRef[hvMvSira[i]];
  ses.src = r ? hvAaUrl(r[0], r[1])
              : 'https://cdn.islamic.network/quran/audio/128/ar.husary/' + hvMvSira[i];
  ses.play().catch(() => {});
  hvMvCalisiyor = true;
  hvMvVurgula(hvMvSira[i]);
  hvMvDugmeTazele();
}

function hvMvSonraki() {
  if (!hvMvCalisiyor) return;
  if (hvMvKonum + 1 < hvMvSira.length) { hvMvCal(hvMvKonum + 1); return; }
  // Sayfa bitti → sonraki sayfaya geç ve okumaya devam et
  const sayfa = parseInt(hvGet('hv_mushaf_page', '1'), 10);
  if (sayfa < HV_MUSHAF_SON) {
    const tam = document.getElementById('mv-full');
    const tamAcik = tam && getComputedStyle(tam).display !== 'none';
    hvSet('hv_mushaf_page', sayfa + 1);
    if (tamAcik) hvTamEkranCiz(true); else renderMushaf(true);
    return;
  }
  hvMvDurdur();
}

function hvMvDurdur() {
  hvMvCalisiyor = false;
  try { if (hvMvSes) hvMvSes.pause(); } catch (e) {}
  try { hvTtsDurdur(); } catch (e) {}
  hvMvVurgula(null);
  hvMvDugmeTazele();
}
window.hvMvDurdur = hvMvDurdur;

function hvMvDugmeTazele() {
  const b = document.getElementById('mv-play');
  if (b) b.innerHTML = hvMvCalisiyor ? '⏸ Duraklat' : '▶️ Dinle';
  const t = document.getElementById('te-play');
  if (t) t.innerHTML = hvMvCalisiyor ? '⏸' : '▶️';
}

function hvMvBasDurdur() {
  if (hvMvCalisiyor) { hvMvDurdur(); return; }
  try { hvTtsIsit(); } catch (e) {}   // iOS: konuşma iznini kullanıcı dokunuşuyla aç
  if (hvGet('hv_mushaf_mode', 'ar') !== 'tr' && hvMvKonum >= 0 && hvMvSes && hvMvSes.src && hvMvSes.currentTime > 0) {
    hvMvCalisiyor = true; hvMvSes.play().catch(() => {});
    hvMvVurgula(hvMvSira[hvMvKonum]); hvMvDugmeTazele();
  } else {
    hvMvCal(Math.max(0, hvMvKonum));
  }
}
window.hvMvBasDurdur = hvMvBasDurdur;

/* Okurken âyet atla */
function hvMvAtla(yon) {
  if (!hvMvSira.length) return;
  try { hvTtsDurdur(); } catch (e) {}
  const y = hvMvKonum + yon;
  if (y < 0) { hvMvCal(0); return; }
  if (y >= hvMvSira.length) { hvMvSonraki(); return; }
  hvMvCalisiyor = true;
  hvMvCal(y);
}
window.hvMvAtla = hvMvAtla;

function hvMvAyettenBasla(n) {
  const i = hvMvSira.indexOf(n);
  if (i >= 0) hvMvCal(i);
}
window.hvMvAyettenBasla = hvMvAyettenBasla;

/* ── Yer imi (sayfa) ───────────────────────────────────────────────── */
function hvMushafImler() { try { return JSON.parse(localStorage.getItem('hv_mushaf_marks') || '[]'); } catch (e) { return []; } }
function hvMushafImDegistir() {
  const p = parseInt(hvGet('hv_mushaf_page', '1'), 10);
  let m = hvMushafImler();
  m = m.indexOf(p) >= 0 ? m.filter(x => x !== p) : m.concat([p]).sort((a, b) => a - b);
  try { localStorage.setItem('hv_mushaf_marks', JSON.stringify(m)); } catch (e) {}
  hvMushafArayuzTazele();
}
window.hvMushafImDegistir = hvMushafImDegistir;

/* ── Ayarlar ───────────────────────────────────────────────────────── */
function hvMushafPunto(delta) {
  let f = parseInt(hvGet('hv_mushaf_font', '30'), 10) + delta;
  f = Math.max(20, Math.min(60, f));
  hvSet('hv_mushaf_font', f);
  const el = document.getElementById('mv-arabic');
  if (el) el.style.fontSize = f + 'px';
  const lbl = document.getElementById('mv-font-val');
  if (lbl) lbl.textContent = f + 'px';
}
window.hvMushafPunto = hvMushafPunto;

function hvMushafModDegistir(m) { hvSet('hv_mushaf_mode', m); hvMushafGit(parseInt(hvGet('hv_mushaf_page', '1'), 10)); }
window.hvMushafModDegistir = hvMushafModDegistir;

function hvMushafQariDegistir(q) {
  hvSet('hv_mushaf_qari', q);
  if (hvMvCalisiyor && hvMvKonum >= 0) hvMvCal(hvMvKonum);
}
window.hvMushafQariDegistir = hvMushafQariDegistir;

/* ── Gezinme ───────────────────────────────────────────────────────── */
function hvMushafGit(p, calmayaDevam) {
  p = Math.max(1, Math.min(HV_MUSHAF_SON, parseInt(p, 10) || 1));
  hvSet('hv_mushaf_page', p);
  renderMushaf(calmayaDevam === true);
}
window.hvMushafGit = hvMushafGit;

function hvMushafAtla() {
  const el = document.getElementById('mv-page-input');
  if (el) hvMushafGit(el.value);
}
window.hvMushafAtla = hvMushafAtla;

function hvMushafArayuzTazele() {
  const p = parseInt(hvGet('hv_mushaf_page', '1'), 10);
  const b = document.getElementById('mv-mark');
  if (b) {
    const imli = hvMushafImler().indexOf(p) >= 0;
    b.classList.toggle('on', imli);
    b.innerHTML = imli ? '⭐' : '☆';
  }
}

/* ── Ekran ─────────────────────────────────────────────────────────── */
/* Parmakla sayfa çevirme — mushaf sağdan sola okunduğu için
   parmağı sağa kaydırmak SONRAKİ, sola kaydırmak ÖNCEKİ sayfaya götürür. */
/* Parmakla sayfa çevirme — ortak yardımcı.
   SOLA kaydır  = sonraki sayfa
   SAĞA kaydır  = önceki sayfa
   (iOS'ta ekran kenarından sağa kaydırma "geri" hareketi olduğu için
    ileri gitmek sola kaydırmaya bağlandı.) */
function hvSayfaKaydirmaBagla(el, git) {
  if (!el || el.dataset.kaydirmaBagli === '1') return;
  el.dataset.kaydirmaBagli = '1';
  let x0 = 0, y0 = 0, xs = 0, ys = 0, izle = false;

  const basla = (x, y) => { x0 = xs = x; y0 = ys = y; izle = true; };
  const surdur = (x, y) => { xs = x; ys = y; };
  const bitir = () => {
    if (!izle) return;
    izle = false;
    const dx = xs - x0, dy = ys - y0;
    if (Math.abs(dx) < 55) return;                    // çok kısa dokunuş
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return;    // dikey kaydırma sayfayı çevirmesin
    const s = parseInt(hvGet('hv_mushaf_page', '1'), 10);
    if (dx < 0 && s < HV_MUSHAF_SON) git(s + 1);      // sola  → ileri
    else if (dx > 0 && s > 1) git(s - 1);             // sağa  → geri
  };

  el.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { izle = false; return; }
    basla(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (!izle || e.touches.length !== 1) return;
    surdur(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  el.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) surdur(t.clientX, t.clientY);
    bitir();
  }, { passive: true });
  el.addEventListener('touchcancel', () => { izle = false; }, { passive: true });

  // Fare / kalem (masaüstü ve bazı WebView'ler)
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    basla(e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', e => {
    if (e.pointerType === 'touch') return;
    surdur(e.clientX, e.clientY); bitir();
  });
}
window.hvSayfaKaydirmaBagla = hvSayfaKaydirmaBagla;

/* Mushaf sesi: hafız seçimi Kuran Dinle ile ortak */
/* Okuma alanının üstünde duran sûre adı şeridi */
function hvSureSeritYaz(sure) {
  const e = document.getElementById('mv-sure-serit');
  if (e && sure) e.textContent = hvSureAdi(sure);
  const t = document.getElementById('te-sure-serit');
  if (t && sure) t.textContent = hvSureAdi(sure);
}
window.hvSureSeritYaz = hvSureSeritYaz;

/* Ekranda en üstte görünen âyetin sûresini bul, şeride yaz */
function hvSureSeritTazele() {
  const tam = document.getElementById('mv-full');
  const tamAcik = tam && getComputedStyle(tam).display !== 'none';
  const kok = tamAcik ? tam : document.getElementById('mv-body');
  if (!kok) return;
  const kap = tamAcik ? tam.querySelector('.te-orta') : hvMvKaydirilabilir(kok.querySelector('.mv-ayah'));
  const ust = kap ? kap.getBoundingClientRect().top + 60 : 120;
  const hepsi = kok.querySelectorAll('.mv-ayah');
  let secili = null;
  for (let i = 0; i < hepsi.length; i++) {
    const r = hepsi[i].getBoundingClientRect();
    if (r.bottom >= ust) { secili = hepsi[i]; break; }
  }
  if (!secili && hepsi.length) secili = hepsi[0];
  if (!secili) return;
  const n = parseInt((secili.id || '').replace('mv-a-', ''), 10);
  const r2 = hvMvRef[n];
  if (r2) hvSureSeritYaz(r2[0]);
}
window.hvSureSeritTazele = hvSureSeritTazele;

let hvSeritZaman = null;
function hvSureSeritBagla(kap) {
  if (!kap || kap.dataset.seritBagli === '1') return;
  kap.dataset.seritBagli = '1';
  kap.addEventListener('scroll', () => {
    if (hvSeritZaman) return;
    hvSeritZaman = setTimeout(() => { hvSeritZaman = null; hvSureSeritTazele(); }, 120);
  }, { passive: true });
}

function hvMushafSesQari(id) {
  hvSet('hv_dinle_qari', id);
  if (hvMvCalisiyor && hvMvKonum >= 0) hvMvCal(hvMvKonum);
}
window.hvMushafSesQari = hvMushafSesQari;

/* Bu sayfayı hatim ilerlemesi olarak işaretle */
function hvMushafHatimIsaretle(sayfa) {
  try {
    hvSave('hatim_page', Math.max(0, Math.min(604, parseInt(sayfa, 10) || 0)));
    if (typeof renderHatim === 'function') renderHatim();
    if (typeof hvToast === 'function') hvToast('✓ Hatim güncellendi', sayfa + '. sayfaya kadar okundu olarak işaretlendi.');
  } catch (e) {}
}
window.hvMushafHatimIsaretle = hvMushafHatimIsaretle;

function hvMushafKaydirmaBagla() {
  hvSayfaKaydirmaBagla(document.getElementById('mv-body'), hvMushafGit);
}
window.hvMushafKaydirmaBagla = hvMushafKaydirmaBagla;

/* ═══════════════════════════════════════════════════════════════════════
   v61.6 — SÛRE ARAMA (sayfa sayfa mushafta doğrudan sûreye atlama)
   Sûre → başlangıç sayfası tablosu. 114'ünün tamamı
   api.alquran.cloud/v1/surah/{n}/quran-uthmani ile tek tek doğrulandı.
   ═══════════════════════════════════════════════════════════════════════ */
const HV_SURE_SAYFA = [1,2,50,77,106,128,151,177,187,208,221,235,249,255,262,267,282,293,305,312,322,332,342,350,359,367,377,385,396,404,411,415,418,428,434,440,446,453,458,467,477,483,489,496,499,502,507,511,515,518,520,523,526,528,531,534,537,542,545,549,551,553,554,556,558,560,562,564,566,568,570,572,574,575,577,578,580,582,583,585,586,587,587,589,590,591,591,592,593,594,595,595,596,596,597,597,598,598,599,599,600,600,601,601,601,602,602,602,603,603,603,604,604,604];

function hvSureSayfasi(no) {
  const p = HV_SURE_SAYFA[Number(no) - 1];
  return p ? p : 1;
}
window.hvSureSayfasi = hvSureSayfasi;

/* Türkçe arama: şapka, ı/i, ş/s… hepsini sadeleştir */
function hvTrNorm(x) {
  return String(x || '')
    .toLocaleLowerCase('tr')
    .replace(/[âäàá]/g, 'a').replace(/[îïìí]/g, 'i').replace(/[ûüùú]/g, 'u')
    .replace(/[ôöòó]/g, 'o').replace(/[êëèé]/g, 'e')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}
window.hvTrNorm = hvTrNorm;

function hvSureListesi() {
  try { return (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : []; } catch (e) { return []; }
}

function hvMushafAraGit(sayfa) {
  hvMushafAraKapat();
  hvMushafGit(sayfa);
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
}
window.hvMushafAraGit = hvMushafAraGit;

function hvMushafAraKapat() {
  const g = document.getElementById('mv-ara-sonuc');
  const i = document.getElementById('mv-ara-input');
  if (g) { g.innerHTML = ''; g.classList.remove('acik'); }
  if (i) i.value = '';
  const t = document.getElementById('mv-ara-temizle');
  if (t) t.style.display = 'none';
}
window.hvMushafAraKapat = hvMushafAraKapat;

function hvMushafAraCiz(q) {
  const g = document.getElementById('mv-ara-sonuc');
  if (!g) return;
  const t = document.getElementById('mv-ara-temizle');
  if (t) t.style.display = q ? 'block' : 'none';

  const ara = hvTrNorm(q);
  const liste = hvSureListesi();
  let html = '';

  // Sayfa numarası yazıldıysa önce onu öner
  const say = parseInt(q, 10);
  if (q && /^\d+$/.test(q.trim()) && say >= 1 && say <= HV_MUSHAF_SON) {
    html += `<button class="mv-ara-sat sayfa" onclick="hvMushafAraGit(${say})">
               <span class="mv-ara-no">📄</span>
               <span class="mv-ara-ad">${say}. sayfayı aç</span>
             </button>`;
  }

  const bulunan = liste.filter(s => {
    if (!ara) return true;
    if (String(s.id) === q.trim()) return true;
    return hvTrNorm(s.name).indexOf(ara) >= 0;
  });

  if (!bulunan.length && !html) {
    g.innerHTML = '<div class="mv-ara-yok">Sûre bulunamadı. Örnek: Cuma, Yâsîn, Kehf, 36</div>';
    g.classList.add('acik');
    return;
  }

  html += bulunan.map(s => {
    const p = hvSureSayfasi(s.id);
    return `<button class="mv-ara-sat" onclick="hvMushafAraGit(${p})">
              <span class="mv-ara-no">${s.id}</span>
              <span class="mv-ara-ad">${s.name} Sûresi</span>
              <span class="mv-ara-sy">sayfa ${p}</span>
            </button>`;
  }).join('');

  g.innerHTML = html;
  g.classList.add('acik');
}

function hvMushafAraYaz(q) { hvMushafAraCiz(q); }
window.hvMushafAraYaz = hvMushafAraYaz;

function hvMushafAraAc() {
  const i = document.getElementById('mv-ara-input');
  hvMushafAraCiz(i ? i.value : '');
}
window.hvMushafAraAc = hvMushafAraAc;

async function renderMushaf(calmayaDevam) {
  const kok = document.getElementById('mushaf-root');
  if (!kok) return;

  const sayfa = parseInt(hvGet('hv_mushaf_page', '1'), 10);
  const mod   = hvGet('hv_mushaf_mode', 'ar');
  const font  = parseInt(hvGet('hv_mushaf_font', '30'), 10);
  const qari  = hvGet('hv_mushaf_qari', 'ar.husary');
  const imler = hvMushafImler();

  kok.innerHTML = `
    <div class="page-header-title">
      <h2>📖 Kuran-ı Kerim</h2>
      <p>Sayfa sayfa • gerçek mushaf düzeni • 604 sayfa</p>
    </div>
    <div class="qmode">
      <button class="on">📜 Sayfa Sayfa</button>
      <button onclick="hvKuranModu('sure')">📖 Sure Sure</button>
    </div>

    <div class="mv-ara">
      <span class="mv-ara-ikon">🔍</span>
      <input id="mv-ara-input" type="search" autocomplete="off"
             placeholder="Sûre ara — ör. Cuma, Yâsîn, Kehf ya da 36"
             oninput="hvMushafAraYaz(this.value)" onfocus="hvMushafAraAc()">
      <button id="mv-ara-temizle" class="mv-ara-x" style="display:none"
              onclick="hvMushafAraKapat()">✕</button>
    </div>
    <div id="mv-ara-sonuc" class="mv-ara-sonuc"></div>

    <div class="mv-bar">
      <button class="mv-nav" onclick="hvMushafGit(${sayfa - 1})" ${sayfa <= 1 ? 'disabled' : ''}>‹</button>
      <div class="mv-page-box">
        <input id="mv-page-input" type="number" min="1" max="604" value="${sayfa}"
               onchange="hvMushafAtla()" inputmode="numeric">
        <span>/ 604</span>
      </div>
      <button class="mv-nav" onclick="hvMushafGit(${sayfa + 1})" ${sayfa >= HV_MUSHAF_SON ? 'disabled' : ''}>›</button>
      <button id="mv-mark" class="mv-mark ${imler.indexOf(sayfa) >= 0 ? 'on' : ''}" onclick="hvMushafImDegistir()">${imler.indexOf(sayfa) >= 0 ? '⭐' : '☆'}</button>
      <button class="mv-mark" onclick="hvTamEkranAc()" title="Tam ekran">⛶</button>
    </div>

    <div class="mv-bar mv-bar2">
      <div class="mv-mode">
        <button class="${mod === 'ar' ? 'on' : ''}" onclick="hvMushafModDegistir('ar')">Arapça</button>
        <button class="${mod === 'both' ? 'on' : ''}" onclick="hvMushafModDegistir('both')">Arapça + Meal</button>
        <button class="${mod === 'tr' ? 'on' : ''}" onclick="hvMushafModDegistir('tr')">Meal</button>
      </div>
      <div class="mv-font">
        <button onclick="hvMushafPunto(-2)">A−</button>
        <span id="mv-font-val">${font}px</span>
        <button onclick="hvMushafPunto(2)">A+</button>
      </div>
    </div>

    <div class="mv-ses">
      <button class="mv-ses-yan" onclick="hvMvAtla(-1)" title="Önceki âyet">⏮</button>
      <button id="mv-play" class="mv-play" onclick="hvMvBasDurdur()">${hvMvCalisiyor ? '⏸ Duraklat' : '▶️ Dinle'}</button>
      <button class="mv-ses-yan" onclick="hvMvAtla(1)" title="Sonraki âyet">⏭</button>
    </div>
    <div class="mv-ses2">
      <span id="mv-gecen">0:00</span>
      <input id="mv-cizgi" class="mv-cizgi" type="range" min="0" max="100" value="0"
             oninput="this.dataset.tutuluyor='1'" onchange="hvMvSar(this.value); this.dataset.tutuluyor='';">
      <span id="mv-toplam">--:--</span>
      <select class="mv-qari" onchange="hvMushafSesQari(this.value)">
        ${HV_DINLE_QARILER.map(q => `<option value="${q.id}" ${q.id === hvDnQari().id ? 'selected' : ''}>${q.ad}</option>`).join('')}
      </select>
    </div>
    ${!hvDnAyetKaydiVar(hvDnQari().id) ? `<div class="mv-tts-not">ℹ️ ${hvEsc(hvDnQari().ad)}'in âyet âyet kaydı bulunmuyor; sayfa okurken Husarî okur. Tam sûre dinlemek için Kur'an Dinle.</div>` : ''}
    ${mod !== 'ar' ? `<div class="mv-tts-not">🔊 Meâli telefonunun Türkçe sesi okur.${hvTtsTurkceVarMi() ? '' : ' <b>Bu cihazda Türkçe konuşma sesi bulunamadı.</b> <button class="tts-yardim-btn" onclick="hvTtsYardim()">🔧 Ücretsiz nasıl düzeltirim?</button>'}</div>` : ''}

    <div class="mv-ilerleme">
      <div class="mv-il-ust">
        <span>📖 Sayfa <b>${sayfa}</b> / 604</span>
        <span>${Math.min(30, Math.max(1, Math.ceil(sayfa / 20.14)))}. cüz</span>
        <span><b>%${Math.round((sayfa / 604) * 100)}</b></span>
      </div>
      <div class="mv-il-cubuk"><div class="mv-il-dolu" style="width:${Math.round((sayfa / 604) * 100)}%"></div></div>
      <button class="mv-il-btn" onclick="hvMushafHatimIsaretle(${sayfa})">✓ Hatimde buraya kadar okudum</button>
    </div>

    <div class="mv-where">
      ${imler.length
        ? `<div class="mv-marks">${imler.slice(0, 14).map(x =>
            `<button class="mv-chip ${x === sayfa ? 'on' : ''}" onclick="hvMushafGit(${x})">⭐ ${x}</button>`).join('')}
           ${imler.length > 14 ? `<span class="mv-chip-more">+${imler.length - 14}</span>` : ''}</div>`
        : `<div class="mv-marks-empty">Sayfayı kaydetmek için yukarıdaki ☆ düğmesine dokun.</div>`}
    </div>

    <div id="mv-body" class="mv-body">
      <div id="mv-sure-serit" class="mv-sure-serit">Sayfa yükleniyor…</div>
      <div class="mv-loading">Sayfa yükleniyor…</div>
    </div>
  `;

  let rows;
  try {
    rows = await hvMushafSayfaGetir(sayfa);
  } catch (e) {
    document.getElementById('mv-body').innerHTML =
      `<div class="mv-error">Sayfa yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.
       <button class="gold-outline-btn" onclick="hvMushafGit(${sayfa})">↻ Tekrar Dene</button></div>`;
    return;
  }

  hvMvSira = rows.map(r => r.n);
  hvMvKonum = -1;

  // Sayfadaki sûre adlarını sayfanın KENDİ verisinden yaz (elle tablo yok)
  const sureNolari = rows.map(r => r.s).filter((x, i, a) => a.indexOf(x) === i);
  const nerede = document.getElementById('mv-where-now');
  if (nerede) nerede.textContent = '📍 Sayfa ' + sayfa + ' • ' + sureNolari.map(hvSureAdi).join(' / ');

  // ── Arapça blok ──
  let arHtml = '';
  let sonSure = null;
  rows.forEach(r => {
    if (r.s !== sonSure) {
      sonSure = r.s;
      if (r.v === 1) {
        arHtml += `<div class="mv-sure-basi">${r.sar}</div>`;
      }
    }
    let metin = r.ar;
    if (r.v === 1 && r.s !== 1 && r.s !== 9) {
      const b = hvBesmeleAyir(metin);
      if (b.besmele) { arHtml += `<div class="mv-besmele">${b.besmele}</div>`; metin = b.kalan; }
    }
    arHtml += `<span class="mv-ayah" id="mv-a-${r.n}">${metin}<span class="mv-num">${hvArNum(r.v)}</span></span> `;
  });

  // ── Meal blok ──
  let trHtml = '';
  let sonSure2 = null;
  rows.forEach((r, i) => {
    if (r.s !== sonSure2) { sonSure2 = r.s; trHtml += `<div class="mv-meal-sure">${hvSureAdi(r.s)}</div>`; }
    // Diyanet birleşik meallerinde aynı metni tekrar yazma
    if (i > 0 && r.tr && rows[i - 1].tr === r.tr && !hvMealGrupIlk(r.s, r.v)) return;
    trHtml += `<div class="mv-meal" id="mv-m-${r.n}">
                 <span class="mv-meal-no">${hvMealEtiket(r.s, r.v)}</span>${r.tr || '—'}</div>`;
  });

  hvMvSira = rows.map(r => r.n);
  hvMvRef = {}; rows.forEach(r => { hvMvRef[r.n] = [r.s, r.v]; });

  const govde = document.getElementById('mv-body');
  const ilkSure = rows.length ? rows[0].s : 0;
  govde.innerHTML =
    `<div id="mv-sure-serit" class="mv-sure-serit">${ilkSure ? hvSureAdi(ilkSure) : ''}</div>` +
    (mod !== 'tr' ? `<div id="mv-arabic" class="mv-arabic" style="font-size:${font}px">${arHtml}</div>` : '') +
    (mod !== 'ar' ? `<div class="mv-meal-wrap">${trHtml}</div>` : '') +
    `<div class="mv-swipe-hint">← Sola kaydır: sonraki sayfa · Sağa kaydır: önceki →</div>
     <div class="mv-foot">— ${sayfa} —</div>`;

  hvMushafArayuzTazele();
  hvMushafKaydirmaBagla();
  try { hvSureSeritBagla(hvMvKaydirilabilir(govde.querySelector('.mv-ayah'))); hvSureSeritTazele(); } catch (e) {}
  if (calmayaDevam) { hvMvCalisiyor = true; hvMvCal(0); }
}
window.renderMushaf = renderMushaf;
try { if (window.FEATURE_ROUTES) window.FEATURE_ROUTES['mushaf'] = renderMushaf; } catch (e) {}



/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — DUA & SURE EZBERLEME (satır satır dinle ve tekrarla)
   Sureler ve Kur'an'dan olan dualar ayet ayet, sesiyle birlikte.
   Kur'an dışı dualarda (Sübhaneke, Ettehiyyâtü…) hazır ses kaydı
   olmadığı için okunuşundan tekrar edilir.
   ═══════════════════════════════════════════════════════════════════════ */

const HV_SURE_NO = {
  'Fâtiha Sûresi': 1,
  'Duhâ Sûresi': 93, 'İnşirâh (Şerh) Sûresi': 94, 'Tîn Sûresi': 95, 'Alak Sûresi': 96,
  'Kadir Sûresi': 97, 'Beyyine Sûresi': 98, 'Zilzâl Sûresi': 99, 'Âdiyât Sûresi': 100,
  'Kâria Sûresi': 101, 'Tekâsür Sûresi': 102, 'Asr Sûresi': 103, 'Hümeze Sûresi': 104,
  'Fîl Sûresi': 105, 'Kureyş Sûresi': 106, 'Mâûn Sûresi': 107, 'Kevser Sûresi': 108,
  'Kâfirûn Sûresi': 109, 'Nasr Sûresi': 110, 'Tebbet (Mesed) Sûresi': 111,
  'İhlâs Sûresi': 112, 'Felâk Sûresi': 113, 'Nâs Sûresi': 114
};

// Kur'an'dan olan dualar → ayet aralığı (sesli çalışır)
const HV_DUA_AYET = {
  'Âyetel Kürsî': { s: 2, bas: 255, son: 255 },
  'Âmenerrasûlü (Bakara 285-286)': { s: 2, bas: 285, son: 286 }
};
/* v66.4 — Namaz Duaları içinde Kur'an âyeti olanlar: duanın cümleleri
   sırasıyla bu âyetlere denk gelir → bunlar da sesli dinlenebilir. */
const HV_DUA_SES = {
  'Rabbenâ Duaları': [{ s: 2, a: 201 }, { s: 14, a: 41 }]
};

/* ═══════════════════════════════════════════════════════════════════════
   v66.4 — ÖĞREN HOCASI + ORTAK PARÇA ÇALAR
   "Dua & Sure Öğren" (Ezberle ve Oku) için ayrı hoca seçimi.
   Varsayılan hoca: Muhammed el-Fakih.
   • Âyet âyet kaydı olan hocalar (everyayah) o âyetin dosyasını çalar.
   • el-Fakih ve el-Mûsâ'nın yalnızca sûrenin tamamı var → sûre dosyasının
     içinden o âyetin zaman aralığı (saniye) çalınır:
       – el-Mûsâ: mp3quran.net'in resmî âyet zaman tablosu (her sûre).
       – el-Fakih: namaz sûreleri (Fâtiha, Duhâ…Nâs) için kaydın sessizlikleri
         20 hocanın âyet süreleriyle hizalanarak çıkarıldı. (Fâtiha dışında
         ilk bölüm besmele.) Bunların dışındaki âyetlerde Husarî okur.
   Tek bir ses nesnesi hem Ezberle hem Oku sayfasında kullanılır; aynı sûre
   dosyasında sıradaki âyete geçerken ses durmadan devam eder.
   ═══════════════════════════════════════════════════════════════════════ */
const HV_OGREN_VARSAYILAN = 'alfaqih';
const HV_FAKIH_ZAMAN = {
  1: [[0.52,4.55],[5.56,10.01],[9.9,13.03],[14.44,17.17],[17.12,21.57],[22.52,25.95],[26.98,36.41]],
  93: [[0.66,4.29],[4.7,5.29],[5.16,7.77],[7.7,10.15],[10.64,14.47],[14.32,17.51],[18.16,22.37],[22.22,26.59],[27.36,31.39],[31.82,35.03],[35.58,39.77],[40.28,44.83]],
  94: [[0.96,4.35],[4.82,7.03],[7.54,10.57],[11.26,15.17],[15.74,18.05],[19.16,21.89],[21.76,25.31],[25.88,28.93],[29.26,32.13]],
  95: [[0.96,4.54],[4.74,7.08],[6.7,9.24],[8.8,11.3],[11.92,17.76],[18.14,22.94],[23.08,30.18],[30.4,34.38],[34.56,39.63]],
  96: [[0.58,4.31],[4.92,7.83],[8.46,11.79],[12.24,14.69],[15.1,17.57],[17.74,21.49],[22.5,28.19],[28.66,30.71],[31.6,35.09],[35.54,37.97],[37.82,39.83],[40.56,44.03],[43.88,45.97],[46.48,50.29],[50.94,55.35],[55.94,61.81],[62.7,66.27],[67,68.99],[68.84,70.73],[71.36,75.73]],
  97: [[0.38,4.19],[4.92,10.89],[11.7,15.83],[16.56,20.55],[21.36,30.17],[30.66,34.63]],
  98: [[0.2,4.55],[5.34,14.19],[15.26,20.49],[21.46,24.19],[25.14,33.17],[34.12,53.17],[54.12,68.11],[68.82,77.31],[78.28,97.39]],
  99: [[0.34,3.95],[4.78,8.21],[8.58,11.65],[12.1,15.93],[16.34,20.53],[21.16,24.93],[25.4,31.43],[32.1,37.05],[37.82,44.05]],
  100: [[1.2,4.55],[4.56,6.73],[7.22,9.47],[9.86,12.11],[12.36,14.71],[15.1,17.61],[18.16,23.93],[24.4,28.97],[29.48,34.17],[34.58,38.83],[39.28,41.99],[42.38,48.49]],
  101: [[0.82,4.29],[4.32,5.43],[5.3,6.61],[7.64,11.73],[12.56,18.05],[18.9,23.63],[24.38,28.91],[28.76,31.27],[32.18,36.25],[36.12,38.63],[39.54,43.29],[43.78,46.17]],
  102: [[0.76,4.41],[4.82,6.71],[7.26,9.49],[10,13.27],[13.14,16.35],[16.98,20.21],[20.06,22.51],[23,27.57],[28.02,34.65]],
  103: [[0.8,4.55],[4.86,5.55],[5.42,9.11],[9.86,17.31]],
  104: [[0.74,3.83],[4.48,7.45],[8,11.47],[12.08,15.73],[16.3,20.15],[20.76,24.75],[25.16,27.53],[28.02,30.91],[31.4,35.29],[36.02,39.45]],
  105: [[0.16,3.95],[4.48,9.17],[9.58,13.31],[13.52,17.17],[17.56,22.55],[22.92,28.43]],
  106: [[0.68,4.23],[4.56,6.81],[7.1,11.47],[12.18,14.65],[14.52,21.85]],
  107: [[0.68,4.28],[4.56,7.7],[7.28,10.56],[10.74,14.54],[14.66,17.26],[16.82,21.24],[21.44,25.86],[25.44,28.81]],
  108: [[0.36,3.95],[4.48,9.03],[9.46,11.71],[12.02,16.17]],
  109: [[0.56,3.83],[4.58,9.75],[10.22,14.61],[15.1,21.09],[21.58,26.29],[26.64,32.61],[32.92,36.97]],
  110: [[0.66,4.09],[4.44,8.33],[9,14.61],[15.22,23.07]],
  111: [[0.62,4.01],[4.38,8.95],[9.44,14.33],[14.9,18.29],[18.64,22.21],[22.56,26.81]],
  112: [[0.6,4.15],[4.54,6.37],[6.66,8.21],[8.54,10.73],[11,14.57]],
  113: [[0.26,4.05],[4.62,7.01],[7.48,10.21],[10.64,14.67],[15.2,19.75],[20.24,24.51]],
  114: [[0.42,4.3],[4.58,7.74],[7.34,9.7],[9.26,11.86],[12.64,17.68],[18.04,23.02],[23.34,28.57]]
};

function hvOgrenQari() {
  const id = hvGet('hv_ogren_qari', HV_OGREN_VARSAYILAN);
  return HV_DINLE_QARILER.find(q => q.id === id) ||
         HV_DINLE_QARILER.find(q => q.id === HV_OGREN_VARSAYILAN) || HV_DINLE_QARILER[0];
}
window.hvOgrenQari = hvOgrenQari;
/* Hoca seçim kutusu (fn: değişince çağrılacak global fonksiyonun adı) */
function hvOgrenQariSecim(fn) {
  const q = hvOgrenQari();
  const sira = [HV_OGREN_VARSAYILAN].concat(HV_DINLE_QARILER.map(x => x.id).filter(x => x !== HV_OGREN_VARSAYILAN));
  const sec = sira.map(id => {
    const x = HV_DINLE_QARILER.find(k => k.id === id);
    return x ? `<option value="${x.id}"${x.id === q.id ? ' selected' : ''}>${hvEsc(x.ad)}</option>` : '';
  }).join('');
  return `<label class="og-qari"><span class="og-qari-et">🎙️ Hoca</span><select onchange="${fn}(this.value)" aria-label="Hoca seç">${sec}</select></label>`;
}

const hvP3 = n => String(n).padStart(3, '0');
function hvOgEveryayah(klasor, s, a) { return 'https://everyayah.com/data/' + klasor + '/' + hvP3(s) + hvP3(a) + '.mp3'; }
function hvOgSureUrl(q, s) { return 'https://' + q.sunucu + '.mp3quran.net/' + (q.yol || q.id) + '/' + hvP3(s) + '.mp3'; }

/* el-Mûsâ resmî âyet zamanları (ms) — bir kez indirilir, cihazda saklanır */
const hvMusaZamanBellek = {};
async function hvMusaZaman(s) {
  if (hvMusaZamanBellek[s]) return hvMusaZamanBellek[s];
  try {
    const c = JSON.parse(localStorage.getItem('hv_musa_z_' + s) || 'null');
    if (Array.isArray(c) && c.length) { hvMusaZamanBellek[s] = c; return c; }
  } catch (e) {}
  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const t = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
  try {
    const r = await fetch('https://mp3quran.net/api/v3/ayat_timing?surah=' + s + '&read=243', ctrl ? { signal: ctrl.signal } : undefined);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) throw new Error('boş');
    const z = j.map(x => [x.ayah, x.start_time, x.end_time]);
    hvMusaZamanBellek[s] = z;
    try { localStorage.setItem('hv_musa_z_' + s, JSON.stringify(z)); } catch (e) {}
    return z;
  } finally { if (t) clearTimeout(t); }
}

/* refs: [{ s: sûre, a: âyet }]  (a = 0 → o sûrenin başındaki besmele)
   Dönen: [{ url, bas?, son?, yedek? }]  — bas/son yoksa dosyanın tamamı çalınır.
   yedek: seçilen hocanın bu âyet için kaydı yok → Husarî okuyor. */
async function hvOgrenSesCoz(refs, qari) {
  const q = qari || hvOgrenQari();
  const husr = HV_AA_KLASOR.husr;
  const besmeleMi = r => r.a === 0;
  const yedek = r => ({ url: hvOgEveryayah(husr, besmeleMi(r) ? 1 : r.s, besmeleMi(r) ? 1 : r.a), yedek: true });
  if (HV_AA_KLASOR[q.id]) {
    const k = HV_AA_KLASOR[q.id];
    return refs.map(r => ({ url: hvOgEveryayah(k, besmeleMi(r) ? 1 : r.s, besmeleMi(r) ? 1 : r.a) }));
  }
  if (q.id === 'alfaqih') {
    return refs.map(r => {
      const z = HV_FAKIH_ZAMAN[r.s];
      const i = (r.s === 1) ? (besmeleMi(r) ? 0 : r.a - 1) : r.a;
      if (z && z[i]) return { url: hvOgSureUrl(q, r.s), bas: z[i][0], son: z[i][1] };
      if (besmeleMi(r)) { const f = HV_FAKIH_ZAMAN[1][0]; return { url: hvOgSureUrl(q, 1), bas: f[0], son: f[1] }; }
      return yedek(r);
    });
  }
  if (q.id === 'mousa') {
    const sureler = refs.map(r => r.s).filter((x, i, a) => a.indexOf(x) === i);
    const tablo = {};
    await Promise.all(sureler.map(async s => { try { tablo[s] = await hvMusaZaman(s); } catch (e) { tablo[s] = null; } }));
    return refs.map(r => {
      const z = tablo[r.s];
      if (!z) return yedek(r);
      const ilk = z.find(y => y[0] === 1);
      if (besmeleMi(r)) {
        if (r.s === 1) return ilk ? { url: hvOgSureUrl(q, 1), bas: Math.max(0, ilk[1] / 1000 - 0.05), son: ilk[2] / 1000 } : yedek(r);
        return ilk ? { url: hvOgSureUrl(q, r.s), bas: 0, son: Math.max(0.5, ilk[1] / 1000) } : yedek(r);
      }
      const x = z.find(y => y[0] === r.a);
      return x ? { url: hvOgSureUrl(q, r.s), bas: Math.max(0, x[1] / 1000 - 0.05), son: x[2] / 1000 } : yedek(r);
    });
  }
  return refs.map(yedek);
}
window.hvOgrenSesCoz = hvOgrenSesCoz;

/* Seçilen hocanın kaydı olmayan kısımlar için küçük açıklama */
function hvOgYedekNotu(sesler) {
  if (!sesler || !sesler.some(x => x && x.yedek)) return '';
  const q = hvOgrenQari();
  const hepsi = sesler.every(x => !x || x.yedek);
  return `<div class="og-yedek-not">ℹ️ ${hvEsc(q.ad)} hocanın ${hepsi ? 'bu bölüm' : 'bazı âyetler'} için âyet âyet kaydı yok; ${hepsi ? 'bu bölümü' : 'o kısımları'} Mahmud Halil el-Husarî okuyor.</div>`;
}

/* ── Ortak parça çalar ──
   liste: [{ url, bas?, son?, i? }]
   ayar: { tekrar, onBasla(), onSira(k, parca), onIlerle(oran, k), onBitti(), onDur(), onHata() } */
let hvOgSes = null, hvOgDurum = null, hvOgSaat = null;
function hvOgAyniUrl(a, b) {
  const t = u => String(u || '').split('#')[0];
  return !!a && !!b && t(a) === t(b);
}
function hvOgSesNesnesi() {
  if (hvOgSes) return hvOgSes;
  const s = new Audio();
  s.preload = 'auto';
  s.addEventListener('ended', () => hvOgParcaBitti(true));
  s.addEventListener('error', () => {
    const d = hvOgDurum;
    if (!d) return;
    hvOgDurum = null;
    if (hvOgSaat) { clearInterval(hvOgSaat); hvOgSaat = null; }
    try { if (d.ayar.onHata) d.ayar.onHata(); else if (d.ayar.onDur) d.ayar.onDur(); } catch (e) {}
  });
  s.addEventListener('timeupdate', hvOgKontrol);
  hvOgSes = s;
  return s;
}
function hvOgOynat(liste, ayar) {
  hvOgDurdur();                      // öncekini durdur (onun arayüzü kendini sıfırlar)
  if (!liste || !liste.length) return;
  ayar = ayar || {};
  const tekrar = Math.max(1, parseInt(ayar.tekrar, 10) || 1);
  hvOgDurum = { liste: liste, sira: 0, tekrar: tekrar, kalan: tekrar, ayar: ayar, hazir: false };
  try { if (ayar.onBasla) ayar.onBasla(); } catch (e) {}
  hvOgBaslat(0);
  hvOgSaat = setInterval(hvOgKontrol, 60);
}
window.hvOgOynat = hvOgOynat;
function hvOgBaslat(i) {
  const d = hvOgDurum;
  if (!d) return;
  d.sira = i;
  const p = d.liste[i];
  const s = hvOgSesNesnesi();
  try { if (d.ayar.onSira) d.ayar.onSira(i, p); } catch (e) {}
  const bas = (typeof p.bas === 'number') ? p.bas : 0;
  d.hazir = false;
  const oynat = () => {
    if (hvOgDurum !== d || d.sira !== i) return;
    try { if (Math.abs((s.currentTime || 0) - bas) > 0.3) s.currentTime = bas; } catch (e) {}
    d.hazir = true;
    const pr = s.play();
    if (pr && pr.catch) pr.catch(() => {
      if (hvOgDurum !== d) return;
      hvOgDurum = null;
      if (hvOgSaat) { clearInterval(hvOgSaat); hvOgSaat = null; }
      try { if (d.ayar.onHata) d.ayar.onHata(); else if (d.ayar.onDur) d.ayar.onDur(); } catch (e) {}
    });
  };
  if (hvOgAyniUrl(s.currentSrc || s.src, p.url) && s.readyState >= 1) { oynat(); return; }
  // Yeni dosya: başlangıç noktası adrese yazılır (#t=) → baştan ses kaçmaz
  s.src = p.url + (bas > 0 ? '#t=' + bas.toFixed(2) : '');
  const hazir = () => { s.removeEventListener('loadedmetadata', hazir); oynat(); };
  s.addEventListener('loadedmetadata', hazir);
  try { s.load(); } catch (e) {}
  // iOS: oynatma izni dokunuşun içinde istenmeli → hemen çağır
  const pr = s.play();
  if (pr && pr.catch) pr.catch(() => {});
}
function hvOgKontrol() {
  const d = hvOgDurum;
  if (!d || !hvOgSes || !d.hazir) return;
  const p = d.liste[d.sira];
  if (!p) return;
  const t = hvOgSes.currentTime || 0;
  const b = (typeof p.bas === 'number') ? p.bas : 0;
  const e = (typeof p.son === 'number') ? p.son : (isFinite(hvOgSes.duration) ? hvOgSes.duration : 0);
  if (d.ayar.onIlerle && e > b) { try { d.ayar.onIlerle(Math.max(0, Math.min(1, (t - b) / (e - b))), d.sira); } catch (er) {} }
  if (typeof p.son === 'number' && t >= p.son) hvOgParcaBitti(false);
}
function hvOgParcaBitti(dosyaBitti) {
  const d = hvOgDurum;
  if (!d) return;
  if (!dosyaBitti && !d.hazir) return;
  const p = d.liste[d.sira];
  if (d.kalan > 1) {                 // aynı parçayı yeniden (tekrar sayısı)
    d.kalan--;
    try { hvOgSes.currentTime = (typeof p.bas === 'number') ? p.bas : 0; } catch (e) {}
    const pr = hvOgSes.play(); if (pr && pr.catch) pr.catch(() => {});
    return;
  }
  d.kalan = d.tekrar;
  const i = d.sira + 1;
  if (i >= d.liste.length) {
    hvOgDurum = null;
    if (hvOgSaat) { clearInterval(hvOgSaat); hvOgSaat = null; }
    try { hvOgSes.pause(); } catch (e) {}
    try { if (d.ayar.onBitti) d.ayar.onBitti(); } catch (e) {}
    return;
  }
  const q = d.liste[i];
  // Aynı sûre dosyasında sıradaki âyet hemen arkadaysa: durmadan devam et
  if (!dosyaBitti && hvOgAyniUrl(p.url, q.url) && typeof q.bas === 'number' &&
      typeof p.son === 'number' && q.bas - p.son < 1.5 && q.bas - p.son > -1.5) {
    d.sira = i;
    try { if (d.ayar.onSira) d.ayar.onSira(i, q); } catch (e) {}
    return;
  }
  hvOgBaslat(i);
}
function hvOgDurdur() {
  const d = hvOgDurum;
  hvOgDurum = null;
  if (hvOgSaat) { clearInterval(hvOgSaat); hvOgSaat = null; }
  try { if (hvOgSes) hvOgSes.pause(); } catch (e) {}
  if (d) { try { if (d.ayar.onDur) d.ayar.onDur(); } catch (e) {} }
}
window.hvOgDurdur = hvOgDurdur;
function hvOgCaliyorMu() { return !!hvOgDurum; }

/* ── DUA & SURE EZBERLE (v66.4: önce TAMAMI, istenirse parça parça) ── */
let hvEzKayit = null;   // { baslik, tur, parcalar:[{ar,ok,tr,ref,ses,no,besmele}], anahtar, ayriAr, sesQari }
let hvEzIdx = 0;
let hvEzTekrar = 1;
let hvEzGorunum = 'tam';     // 'tam' = tamamı (varsayılan) | 'parca' = parça parça
let hvEzCalan = null;        // 'tam' | 'tek' | 'parca'
let hvEzTekIdx = -1;

function hvEzSesVar() { return !!(hvEzKayit && hvEzKayit.parcalar.some(p => p.ses)); }
function hvEzSesDurdur() { hvOgDurdur(); hvEzCalmaBitti(); }
window.hvEzSesDurdur = hvEzSesDurdur;

function hvEzCalmaBitti() {
  hvEzCalan = null; hvEzTekIdx = -1;
  hvEzDugmeleriTazele();
  hvEzVurgula(-1);
}
function hvEzDugmeleriTazele() {
  const b = document.getElementById('ez-play');
  if (b) b.innerHTML = hvEzCalan === 'parca' ? '⏸ Durdur' : '🔊 Dinle';
  const t = document.getElementById('ez-tam-cal');
  if (t) { t.innerHTML = hvEzCalan === 'tam' ? '⏸ Durdur' : '▶️ Tamamını Dinle'; t.classList.toggle('on', hvEzCalan === 'tam'); }
}
function hvEzVurgula(i) {
  document.querySelectorAll('.ez-tam-kart .ez-caliyor').forEach(e => e.classList.remove('ez-caliyor'));
  document.querySelectorAll('.ez-tam-kart .ez-w.gecti, .ez-tam-kart .ez-ow.gecti').forEach(w => w.classList.remove('gecti'));
  if (i < 0) return;
  const els = document.querySelectorAll('.ez-tam-kart .ez-i-' + i);
  els.forEach(e => e.classList.add('ez-caliyor'));
  // önceki âyetlerin kelimeleri dolu kalsın (Arapça ve okunuş)
  for (let k = 0; k < i; k++) document.querySelectorAll('.ez-tam-kart .ez-i-' + k + ' .ez-w, .ez-tam-kart .ez-i-' + k + ' .ez-ow').forEach(w => w.classList.add('gecti'));
  // okunuş artık asıl okunan kısım → ekran onu takip eder
  const hedef = document.querySelector('.ez-tam-kart .ez-o.ez-i-' + i) ||
                document.querySelector('.ez-tam-kart .ez-a.ez-i-' + i) || document.querySelector('.ez-tam-kart .ez-tk-besmele.ez-i-' + i);
  if (hedef) { try { hedef.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
}
/* Okunan âyetin kelimeleri sesle birlikte dolar (Arapça + okunuş) */
function hvEzKelimeIlerle(oran, i) {
  const r = Math.max(0, Math.min(1, oran || 0));
  const doldur = (el, sec) => {
    if (!el) return;
    const w = el.querySelectorAll(sec);
    const n = Math.round(r * w.length);
    w.forEach((x, m) => x.classList.toggle('gecti', m < n));
  };
  doldur(document.querySelector('.ez-tam-kart .ez-a.ez-i-' + i) || document.querySelector('.ez-tam-kart .ez-tk-besmele.ez-i-' + i), '.ez-w');
  doldur(document.querySelector('.ez-tam-kart .ez-o.ez-i-' + i), '.ez-ow');
}
function hvEzSesHata() {
  hvEzCalmaBitti();
  try { hvToast('🔇 Ses açılamadı', 'İnternet bağlantını kontrol edip tekrar dene.'); } catch (e) {}
}

// Parça görünümü: o parçayı seçilen tekrar sayısı kadar çalar
function hvEzCal() {
  const p = hvEzKayit && hvEzKayit.parcalar[hvEzIdx];
  if (!p || !p.ses) return;
  if (hvEzCalan === 'parca') { hvEzSesDurdur(); return; }
  hvOgOynat([Object.assign({ i: hvEzIdx }, p.ses)], {
    tekrar: hvEzTekrar,
    onBasla: () => { hvEzCalan = 'parca'; hvEzDugmeleriTazele(); },
    onBitti: hvEzCalmaBitti, onDur: hvEzCalmaBitti, onHata: hvEzSesHata
  });
}
window.hvEzCal = hvEzCal;

// Tam görünüm: baştan sona hepsini sırayla, okunan kısım vurgulu
function hvEzTamCal() {
  if (!hvEzKayit) return;
  if (hvEzCalan === 'tam') { hvEzSesDurdur(); return; }
  const liste = [];
  hvEzKayit.parcalar.forEach((p, i) => { if (p.ses) liste.push(Object.assign({ i: i }, p.ses)); });
  if (!liste.length) return;
  hvOgOynat(liste, {
    onBasla: () => { hvEzCalan = 'tam'; hvEzDugmeleriTazele(); },
    onSira: (k, x) => hvEzVurgula(x.i),
    onIlerle: (oran, k) => { const x = liste[k]; if (x) hvEzKelimeIlerle(oran, x.i); },
    onBitti: hvEzCalmaBitti, onDur: hvEzCalmaBitti, onHata: hvEzSesHata
  });
}
window.hvEzTamCal = hvEzTamCal;

// Tam görünümde tek bir âyeti dinle
function hvEzTekCal(i) {
  const p = hvEzKayit && hvEzKayit.parcalar[i];
  if (!p || !p.ses) return;
  if (hvEzCalan === 'tek' && hvEzTekIdx === i) { hvEzSesDurdur(); return; }
  hvOgOynat([Object.assign({ i: i }, p.ses)], {
    onBasla: () => { hvEzCalan = 'tek'; hvEzTekIdx = i; hvEzDugmeleriTazele(); hvEzVurgula(i); },
    onIlerle: (oran) => hvEzKelimeIlerle(oran, i),
    onBitti: hvEzCalmaBitti, onDur: hvEzCalmaBitti, onHata: hvEzSesHata
  });
}
window.hvEzTekCal = hvEzTekCal;

function hvEzTekrarAyarla(n) {
  hvEzTekrar = parseInt(n, 10) || 1;
  hvSet('hv_ezber_tekrar', hvEzTekrar);
  document.querySelectorAll('.ez-rep button').forEach(b => b.classList.toggle('on', b.dataset.n === String(hvEzTekrar)));
}
window.hvEzTekrarAyarla = hvEzTekrarAyarla;

/* Öğrendim işaretleri */
function hvEzOgrenilenler() {
  try { return JSON.parse(localStorage.getItem('hv_ezber_ogrenildi') || '[]'); } catch (e) { return []; }
}
function hvEzOgrenildiMi(anahtar) { return hvEzOgrenilenler().indexOf(anahtar) >= 0; }

function hvEzOgrendimDegistir() {
  if (!hvEzKayit) return;
  let l = hvEzOgrenilenler();
  const a = hvEzKayit.anahtar;
  l = l.indexOf(a) >= 0 ? l.filter(x => x !== a) : l.concat([a]);
  try { localStorage.setItem('hv_ezber_ogrenildi', JSON.stringify(l)); } catch (e) {}
  const b = document.getElementById('ez-ogrendim');
  if (b) {
    const on = l.indexOf(a) >= 0;
    b.classList.toggle('on', on);
    b.innerHTML = on ? '✓ Öğrendim' : '○ Öğrendim';
  }
}
window.hvEzOgrendimDegistir = hvEzOgrendimDegistir;

function hvEzGit(i) {
  if (!hvEzKayit) return;
  hvEzSesDurdur();
  hvEzIdx = Math.max(0, Math.min(hvEzKayit.parcalar.length - 1, i));
  try { localStorage.setItem('hv_ezber_' + hvEzKayit.anahtar, String(hvEzIdx)); } catch (e) {}
  if (hvEzGorunum !== 'parca') { hvEzGorunumSec('parca'); return; }
  hvEzParcaCiz();
}
window.hvEzGit = hvEzGit;

/* Görünüm seçimi: 📖 Tamamı | 🧩 Parça parça */
function hvEzGorunumSec(g) {
  if (!hvEzKayit) return;
  hvEzSesDurdur();
  hvEzGorunum = (g === 'parca') ? 'parca' : 'tam';
  const t = document.getElementById('ez-g-tam'), p = document.getElementById('ez-g-parca');
  if (t) t.classList.toggle('active', hvEzGorunum === 'tam');
  if (p) p.classList.toggle('active', hvEzGorunum === 'parca');
  if (hvEzGorunum === 'parca') hvEzParcaCiz(); else hvEzTamCiz();
  hvEzBasaSar();
}
window.hvEzGorunumSec = hvEzGorunumSec;

function hvEzYedekNotu() {
  if (!hvEzKayit) return '';
  return hvOgYedekNotu(hvEzKayit.parcalar.filter(p => p.ref).map(p => p.ses));
}

function hvEzParcaCiz() {
  const kutu = document.getElementById('ez-step');
  if (!kutu || !hvEzKayit) return;
  const top = hvEzKayit.parcalar.length;
  const p = hvEzKayit.parcalar[hvEzIdx];
  const sonuncu = hvEzIdx === top - 1;

  kutu.innerHTML = `
    <div class="ez-count">${p.besmele ? 'Besmele · ' : ''}${hvEzIdx + 1} / ${top}</div>
    <div class="ez-dots">${hvEzKayit.parcalar.map((_, i) =>
      `<span class="ez-dot ${i === hvEzIdx ? 'on' : (i < hvEzIdx ? 'done' : '')}" onclick="hvEzGit(${i})"></span>`).join('')}</div>

    <div class="ez-ar">${p.ar}</div>
    ${p.ok ? `<div class="ez-ok">${p.ok}</div>` : ''}
    ${p.tr ? `<div class="ez-tr">${p.tr}</div>` : ''}

    <div class="ez-controls">
      ${p.ses
        ? `<button id="ez-play" class="ez-play" onclick="hvEzCal()">🔊 Dinle</button>
           <div class="ez-rep">
             <span>Tekrar:</span>
             ${[1, 3, 5].map(n => `<button data-n="${n}" class="${hvEzTekrar === n ? 'on' : ''}" onclick="hvEzTekrarAyarla(${n})">${n}×</button>`).join('')}
           </div>`
        : `<div class="ez-nosound">Bu dua Kur'an'dan olmadığı için hazır ses kaydı yok — okunuşundan tekrar edin.</div>`}
    </div>
    ${p.ses && p.ses.yedek ? hvOgYedekNotu([p.ses]) : ''}

    <div class="ez-nav">
      <button class="gold-outline-btn" onclick="hvEzGit(${hvEzIdx - 1})" ${hvEzIdx === 0 ? 'disabled' : ''}>← Önceki</button>
      ${sonuncu
        ? `<button class="gold-primary-btn" onclick="hvEzGorunumSec('tam')">✅ Tamamını Gör</button>`
        : `<button class="gold-primary-btn" onclick="hvEzGit(${hvEzIdx + 1})">Sonraki →</button>`}
    </div>
    ${sonuncu ? '' : `<button class="ez-full-link" onclick="hvEzGorunumSec('tam')">📖 Tamamını gör ve dinle</button>`}
  `;
}

// Aynı metin her parçada tekrarlanıyorsa (dualarda Arapça ve anlam) bir kez yaz
function hvEzTekilBirlestir(dizi) {
  const temiz = dizi.filter(Boolean);
  const tekil = temiz.filter((x, i) => temiz.indexOf(x) === i);
  return tekil.join(' ');
}

/* Tam görünüm (v66.4): metnin TAMAMI tek sayfada, kesintisiz — Arapça bir
   bütün halinde akar (âyet sonlarında numara), altında okunuşun ve anlamın
   tamamı. "Tamamını Dinle" ile okunan âyet üç bölümde birden vurgulanır ve
   kelimeler hocanın sesiyle dolar; bir âyete dokununca yalnız o âyet okunur. */
function hvEzKelimeler(metin) {
  return String(metin || '').trim().split(/\s+/).filter(Boolean).map(k => '<span class="ez-w">' + k + '</span>').join(' ');
}
// Okunuş da kelime kelime (sesle birlikte dolar — artık asıl okunan kısım o)
function hvEzOkKelimeler(metin) {
  return String(metin || '').trim().split(/\s+/).filter(Boolean).map(k => '<span class="ez-ow">' + hvEsc(k) + '</span>').join(' ');
}
function hvEzTamCiz() {
  const kutu = document.getElementById('ez-step');
  if (!kutu || !hvEzKayit) return;
  const K = hvEzKayit;
  const sesli = hvEzSesVar();
  const refVar = K.parcalar.some(p => p.ref);
  let arHtml = '', okHtml = '', trHtml = '';
  if (K.tur === 'dua' && !K.ayriAr) {
    // Kur'an dışı dualar: Arapça bir bütün, okunuş ve anlam birer paragraf
    arHtml = `<div class="ez-tk-ar" dir="rtl" lang="ar">${hvEzTekilBirlestir(K.parcalar.map(p => p.ar))}</div>`;
    okHtml = K.parcalar.map(p => p.ok).filter(Boolean).join(' ');
    trHtml = hvEzTekilBirlestir(K.parcalar.map(p => p.tr));
  } else {
    const dokun = i => (K.parcalar[i] && K.parcalar[i].ses) ? ` onclick="hvEzTekCal(${i})"` : '';
    let besmele = '';
    const ayetler = [];
    K.parcalar.forEach((p, i) => {
      if (p.besmele) { besmele = `<div class="ez-tk-besmele ez-i-${i}"${dokun(i)}>${hvEzKelimeler(p.ar)}</div>`; return; }
      const no = (typeof hvArNum === 'function') ? hvArNum(p.no || (i + 1)) : (p.no || (i + 1));
      ayetler.push(`<span class="ez-a ez-i-${i}" data-i="${i}"${dokun(i)}>${hvEzKelimeler(p.ar)}<span class="ez-ayno">${no}</span></span>`);
    });
    arHtml = besmele + `<div class="ez-tk-ar" dir="rtl" lang="ar">${ayetler.join(' ')}</div>`;
    okHtml = K.parcalar.map((p, i) => {
      if (!p.ok) return '';
      const et = p.besmele ? '' : `<sup>${p.no || (i + 1)}</sup>`;
      return `<span class="ez-o ez-i-${i}"${dokun(i)}>${et}${hvEzOkKelimeler(p.ok)}</span>`;
    }).filter(Boolean).join(' ');
    // Meal: Diyanet bazı âyetleri birlikte çevirir → aynı metin bir kez, numarası "2-4"
    const gruplar = [];
    K.parcalar.forEach((p, i) => {
      if (!p.tr) return;
      const son = gruplar[gruplar.length - 1];
      if (son && son.tr === p.tr) { son.idx.push(i); son.bitis = p.no; return; }
      gruplar.push({ tr: p.tr, idx: [i], basla: p.no, bitis: p.no, besmele: !!p.besmele });
    });
    trHtml = gruplar.map(g => {
      const et = g.besmele ? '' : `<sup>${g.basla}${g.bitis && g.bitis !== g.basla ? '-' + g.bitis : ''}</sup>`;
      return `<span class="ez-m ${g.idx.map(i => 'ez-i-' + i).join(' ')}">${et}${g.tr}</span>`;
    }).join(' ');
  }
  kutu.innerHTML = `
    ${sesli
      ? `<div class="ez-tam-arac"><button id="ez-tam-cal" class="ez-play ez-tam-cal" onclick="hvEzTamCal()">▶️ Tamamını Dinle</button></div>
         <div class="ez-tk-ipucu">Bir âyete dokunursan yalnız o âyet okunur.</div>`
      : (refVar
        ? `<div class="ez-tam-arac"><button id="ez-tam-cal" class="ez-play ez-tam-cal" disabled>⏳ Ses hazırlanıyor…</button></div>`
        : `<div class="ez-nosound">Bu dua Kur'an'dan olmadığı için hazır ses kaydı yok — okunuşundan tekrar edin.</div>`)}
    ${hvEzYedekNotu()}
    <div class="ez-tam-kart">
      ${arHtml}
      ${okHtml ? `<div class="ez-tk-baslik"><span>Okunuşu</span></div><div class="ez-tk-ok">${okHtml}</div>` : ''}
      ${trHtml ? `<div class="ez-tk-baslik"><span>Anlamı</span></div><div class="ez-tk-tr">${trHtml}</div>` : ''}
    </div>
    <div class="ez-nav">
      <button class="gold-outline-btn" onclick="hvEzGorunumSec('parca')">🧩 Parça parça çalış</button>
      <button class="gold-primary-btn" onclick="renderEzber()">← Listeye Dön</button>
    </div>
  `;
}

// Eski adıyla da çağrılabilsin
function hvEzTumu() { hvEzGorunumSec('tam'); }
window.hvEzTumu = hvEzTumu;

/* Seçili hocaya göre parçaların ses adreslerini hazırlar */
async function hvEzSesleriHazirla() {
  const K = hvEzKayit;
  if (!K) return;
  const refs = K.parcalar.map(p => p.ref).filter(Boolean);
  if (!refs.length) return;
  const q = hvOgrenQari();
  let sesler = [];
  try { sesler = await hvOgrenSesCoz(refs, q); } catch (e) { sesler = []; }
  if (hvEzKayit !== K) return;
  let n = 0;
  K.parcalar.forEach(p => { if (p.ref) p.ses = sesler[n++] || null; });
  K.sesQari = q.id;
}

/* Hoca değişti (liste ya da dua/sûre ekranından) */
async function hvEzHocaDegistir(id) {
  hvSet('hv_ogren_qari', id);
  try { const a = document.getElementById('settings-ogren-qari-select'); if (a) a.value = id; } catch (e) {}
  hvEzSesDurdur();
  if (!hvEzKayit || !document.getElementById('ez-step')) return;
  const kutu = document.getElementById('ez-step');
  if (kutu && hvEzSesVar()) {
    const b = document.getElementById('ez-tam-cal') || document.getElementById('ez-play');
    if (b) { b.disabled = true; b.innerHTML = '⏳ Hazırlanıyor…'; }
  }
  await hvEzSesleriHazirla();
  if (hvEzGorunum === 'parca') hvEzParcaCiz(); else hvEzTamCiz();
}
window.hvEzHocaDegistir = hvEzHocaDegistir;

/* ── Kayıt yükleme ─────────────────────────────────────────────────── */
/* Kaynak transliterasyon akademik diakritikler kullanıyor (ḳ, ḥ, ẕ, ŝ…).
   Türkçe okunuş için sadeleştirilir; tire, asimile olan harften sonraya
   kaydırılır (mine-l'ûlâ → minel-ûlâ) ve cümle başları büyütülür. */
const HV_OK_HARF = {
  'ḍ':'d','ḥ':'h','ḫ':'h','ḣ':'h','ṣ':'s','ṡ':'s','ṭ':'t','ṫ':'t',
  'ẓ':'z','ż':'z','ẕ':'z','ẑ':'z','ŝ':'s','š':'ş','ḳ':'k','ḵ':'k',
  'ġ':'ğ','ǧ':'ğ','ḡ':'ğ','ʿ':"'",'`':"'",'ʾ':"'",'ʼ':"'",'ñ':'n','ṇ':'n','ṛ':'r','ḷ':'l'
};
function hvOkunusSadelestir(metin) {
  let t = String(metin || '');
  if (!t) return '';
  t = t.split('').map(c => (HV_OK_HARF[c] !== undefined ? HV_OK_HARF[c] : c)).join('');
  t = t.replace(/-\s*([a-zçğıöşüâîû])'?/gi, (m, h) => h + '-');
  t = t.replace(/-\s+/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/(^|[.!?]\s+)('?)([a-zçğıöşü])/g, (m, o, k, c) => o + k + c.toLocaleUpperCase('tr'));
  return t;
}

async function hvEzAyetleriGetir(sureNo, bas, son) {
  await hvMealHazir();   // Türkçe meal uygulamanın içinden (Diyanet)
  // Ses adresi burada verilmez; parçaya {s, a} referansı yazılır ve seçili
  // Öğren hocasına göre hvOgrenSesCoz ile çözülür (v66.4).
  const res = await fetch('https://api.alquran.cloud/v1/surah/' + sureNo +
    '/editions/quran-uthmani,tr.transliteration');
  const j = await res.json();
  if (!j || !j.data || j.data.length < 2) throw new Error('Ayetler alınamadı');
  const ar = j.data[0].ayahs, ok = j.data[1].ayahs;
  const out = [];
  ar.forEach((a, i) => {
    if (bas && (a.numberInSurah < bas || a.numberInSurah > son)) return;
    let metin = a.text;
    if (a.numberInSurah === 1 && sureNo !== 1 && sureNo !== 9) {
      const b = hvBesmeleAyir(metin);
      if (b.besmele) metin = b.kalan;
    }
    out.push({
      ar: metin,
      ok: ok[i] ? hvOkunusSadelestir(ok[i].text) : '',
      tr: hvMeal(sureNo, a.numberInSurah),
      no: a.numberInSurah,
      ref: { s: sureNo, a: a.numberInSurah }   // v66.4: ses, seçili Öğren hocasına göre sonradan çözülür
    });
  });
  return out;
}

// Okunuşu ezberlenebilir parçalara ayırır.
// Önce cümle sonlarından, olmazsa "ve" bağlaçlarından böler.
function hvEzCumleBol(metin) {
  if (!metin) return [];
  let p = metin.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  if (p.length < 2) {
    p = metin.split(/\s+(?=ve\s)/i).map(x => x.trim()).filter(Boolean);
  }
  // Çok uzun parçaları ikiye böl, çok kısa olanları öncekine ekle
  const son = [];
  p.forEach(x => {
    if (son.length && x.length < 12) { son[son.length - 1] += ' ' + x; return; }
    son.push(x);
  });
  return son.length ? son : [metin];
}

/* v66.4 — Sûre ve Kur'an duası metinleri uygulamanın İÇİNDEN gelir (internet
   gerekmez; Wi-Fi'de servis takılsa da açılır). Arapça + okunuş 0'dan Dua
   Öğren ile aynı kaynaktan (KISA_SURELER / SIFIRDAN_*), meal Diyanet meal.js.
   Bulunamazsa eskisi gibi alquran.cloud servisine düşer. */
async function hvEzYerelGetir(tur, ad) {
  try { await hvMealHazir(); } catch (e) {}
  if (tur === 'sure') {
    const k = (typeof KISA_SURELER !== 'undefined' ? KISA_SURELER : []).find(x => x.title === ad);
    const no = HV_SURE_NO[ad];
    if (!k || !no) return null;
    const ar = String(k.arabic || '').split('۝').map(x => x.trim()).filter(Boolean);
    const duzelt = (typeof SIFIRDAN_SURE_OKUNUS !== 'undefined') ? SIFIRDAN_SURE_OKUNUS[k.title] : null;
    const ok = duzelt || hvSdCumleler(k.okunusu);
    if (!ar.length || ok.length !== ar.length) return null;
    return ar.map((a, i) => ({ ar: a, ok: ok[i] || '', tr: hvMeal(no, i + 1), no: i + 1, ref: { s: no, a: i + 1 } }));
  }
  if (tur === 'kurandua') {
    const h = HV_DUA_AYET[ad];
    const esle = { 'Âyetel Kürsî': 'Âyetel Kürsî', 'Âmenerrasûlü (Bakara 285-286)': 'Âmenerrasûlü' }[ad];
    const d = (typeof SIFIRDAN_NAMAZ_DUALARI !== 'undefined' ? SIFIRDAN_NAMAZ_DUALARI : []).find(x => x.ad === esle);
    if (!h || !d || !d.ses || d.ses.length !== (h.son - h.bas + 1)) return null;
    return d.ses.map((r, k) => {
      const satir = d.satirlar.filter(x => (typeof x.seg === 'number' ? x.seg : 0) === k);
      if (!satir.length) return null;
      return { ar: satir.map(x => x.ar).join(' '), ok: satir.map(x => x.ok).join(' '), tr: hvMeal(r.s, r.a), no: r.a, ref: { s: r.s, a: r.a } };
    }).filter(Boolean);
  }
  return null;
}

/* Liste ↔ detay geçişinde önceki kaydırma konumu kalıyordu; içerik kısa
   olunca ekran yarım görünüyordu. Her geçişte başa sar. */
function hvEzBasaSar() {
  const kok = document.getElementById('ezber-root');
  const kap = kok ? hvMvKaydirilabilir(kok) : null;
  try {
    if (kap) kap.scrollTo({ top: 0, behavior: 'auto' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (e) {
    if (kap) kap.scrollTop = 0; else window.scrollTo(0, 0);
  }
}

async function hvEzAc(tur, ad) {
  const kok = document.getElementById('ezber-root');
  if (!kok) return;
  hvEzSesDurdur();
  hvEzTekrar = parseInt(hvGet('hv_ezber_tekrar', '1'), 10) || 1;
  hvEzGorunum = 'tam';   // v66.4: dua/sûre açılınca önce TAMAMI gelir

  kok.innerHTML = `
    <div class="page-header-title ez-detay-baslik"><h2>🧠 ${ad}</h2></div>
    <div class="ez-ust-satir">
      <button class="gold-outline-btn" onclick="renderEzber()">← Listeye Dön</button>
      <button id="ez-ogrendim" class="ez-ogrendim" onclick="hvEzOgrendimDegistir()">○ Öğrendim</button>
    </div>
    <div class="ez-secim-satir">
      <div class="share-type-switch ez-gorunum">
        <button id="ez-g-tam" class="seg-btn active" onclick="hvEzGorunumSec('tam')">📖 Tamamı</button>
        <button id="ez-g-parca" class="seg-btn" onclick="hvEzGorunumSec('parca')">🧩 Parça Parça</button>
      </div>
      <div id="ez-hoca-kutu" class="ez-hoca-kutu"></div>
    </div>
    <div id="ez-step" class="ez-step"><div class="mv-loading">Yükleniyor…</div></div>
  `;
  hvEzBasaSar();

  try {
    let parcalar = [];
    let ayriAr = false;
    if (tur === 'sure') {
      const no = HV_SURE_NO[ad];
      parcalar = (await hvEzYerelGetir('sure', ad)) || await hvEzAyetleriGetir(no, 0, 0);
      // Fâtiha dışındaki sûrelerin başına besmele (hocanın okuyuşuyla birlikte)
      if (no !== 1 && no !== 9) {
        parcalar.unshift({
          ar: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', ok: 'Bismillâhir-rahmânir-rahîm',
          tr: hvMeal(1, 1) || "Rahmân ve Rahîm olan Allah'ın adıyla.",
          ref: { s: no, a: 0 }, besmele: true
        });
      }
    } else if (tur === 'kurandua') {
      const a = HV_DUA_AYET[ad];
      const yerel = await hvEzYerelGetir('kurandua', ad);
      parcalar = (yerel && yerel.length) ? yerel : await hvEzAyetleriGetir(a.s, a.bas, a.son);
    } else {
      const d = (typeof DUA_LEARN !== 'undefined' ? DUA_LEARN : []).find(x => x.title === ad);
      if (!d) throw new Error('Dua bulunamadı');
      // Okunuş cümlelere bölünür. Arapça da (۝ işaretiyle) aynı sayıda parçaya
      // ayrılabiliyorsa her parça kendi Arapçasıyla gösterilir; yoksa
      // bütünlüğü bozulmasın diye her adımda Arapçanın tamamı üstte durur.
      const okP = hvEzCumleBol(d.okunusu);
      const arP = String(d.arabic || '').split('۝').map(x => x.trim()).filter(Boolean);
      ayriAr = arP.length > 1 && arP.length === okP.length;
      const sesRef = HV_DUA_SES[ad];
      parcalar = okP.map((o, i) => ({
        ar: ayriAr ? arP[i] : d.arabic, ok: o, tr: d.turkish,
        ref: (sesRef && sesRef.length === okP.length) ? sesRef[i] : null
      }));
      if (!parcalar.length) parcalar = [{ ar: d.arabic, ok: d.okunusu, tr: d.turkish, ref: null }];
    }

    hvEzKayit = { baslik: ad, tur: tur, parcalar: parcalar, anahtar: (tur + '_' + ad).replace(/\s+/g, '_'), ayriAr: ayriAr };
    let kaldigi = 0;
    try { kaldigi = parseInt(localStorage.getItem('hv_ezber_' + hvEzKayit.anahtar) || '0', 10) || 0; } catch (e) {}
    hvEzIdx = Math.max(0, Math.min(parcalar.length - 1, kaldigi));
    const ob = document.getElementById('ez-ogrendim');
    if (ob) {
      const on = hvEzOgrenildiMi(hvEzKayit.anahtar);
      ob.classList.toggle('on', on);
      ob.innerHTML = on ? '✓ Öğrendim' : '○ Öğrendim';
    }
    // Sesler hazırlanırken metin hemen görünsün (el-Mûsâ'da zaman tablosu ağdan iner)
    const K = hvEzKayit;
    const sesSozu = hvEzSesleriHazirla();
    const hazir = await Promise.race([sesSozu.then(() => true), new Promise(r => setTimeout(() => r(false), 200))]);
    if (hvEzKayit !== K) return;
    const hk = document.getElementById('ez-hoca-kutu');
    if (hk) hk.innerHTML = parcalar.some(p => p.ref) ? hvOgrenQariSecim('hvEzHocaDegistir') : '';
    hvEzTamCiz();
    hvEzBasaSar();
    if (!hazir) sesSozu.then(() => {
      if (hvEzKayit !== K || !document.getElementById('ez-step') || hvEzCalan) return;
      if (hvEzGorunum === 'parca') hvEzParcaCiz(); else hvEzTamCiz();
    });
  } catch (e) {
    const s = document.getElementById('ez-step');
    if (s) s.innerHTML = `<div class="mv-error">Yüklenemedi. İnternet bağlantını kontrol et.
      <button class="gold-outline-btn" onclick="hvEzAc('${tur}','${ad.replace(/'/g, "\\'")}')">↻ Tekrar Dene</button></div>`;
  }
}
window.hvEzAc = hvEzAc;

function renderEzber() {
  const kok = document.getElementById('ezber-root');
  if (!kok) return;
  hvEzSesDurdur();
  hvEzKayit = null;

  // Öğrenilmiş olanlar listenin altına iner; çalışılacaklar üstte kalır.
  // Kendi içlerinde özgün sıra korunur (kararlı sıralama).
  const ogrenilmisMi = (tur, ad) => hvEzOgrenildiMi((tur + '_' + ad).replace(/\s+/g, '_'));
  const altaAl = (tur, liste) => {
    const kalan = [], bitmis = [];
    liste.forEach(ad => (ogrenilmisMi(tur, ad) ? bitmis : kalan).push(ad));
    return kalan.concat(bitmis);
  };

  const sureler = altaAl('sure', Object.keys(HV_SURE_NO));
  const kuranDua = altaAl('kurandua', Object.keys(HV_DUA_AYET));
  const digerDua = altaAl('dua', (typeof DUA_LEARN !== 'undefined' ? DUA_LEARN : [])
    .map(d => d.title).filter(t => !HV_DUA_AYET[t]));

  const kart = (tur, ad, alt, sesli) => {
    const anahtar = (tur + '_' + ad).replace(/\s+/g, '_');
    const ogr = hvEzOgrenildiMi(anahtar);
    return `
    <button class="ez-card ${ogr ? 'ogrenildi' : ''}" onclick="hvEzAc('${tur}','${ad.replace(/'/g, "\\'")}')">
      <span class="ez-card-t">${ogr ? '✓ ' : ''}${ad}</span>
      <span class="ez-card-s">${alt}</span>
      ${sesli ? '<span class="ez-badge">🔊 Sesli</span>' : '<span class="ez-badge muted">Okunuşlu</span>'}
    </button>`;
  };

  kok.innerHTML = `
    <div class="page-header-title">
      <h2>🧠 Dua & Sure Ezberle</h2>
      <p>Tamamını dinle, parça parça tekrarla, ezberle</p>
    </div>
    <div class="ez-hoca-ust">${hvOgrenQariSecim('hvEzHocaDegistir')}</div>
    ${hvEzOgrenilenler().length ? `<div class="ez-sayac">✓ ${hvEzOgrenilenler().length} metin öğrenildi olarak işaretli</div>` : ''}
    <div class="ez-info">Bir metne dokun: önce tamamı açılır, <b>Tamamını Dinle</b> ile baştan sona dinlersin. İstersen <b>Parça Parça</b>'ya geçip her kısmı ayrı ayrı dinleyip tekrar edebilirsin. Kaldığın yer hatırlanır.</div>

    <div class="ez-group-title">📖 Sûreler</div>
    <div class="ez-grid">${sureler.map(s => kart('sure', s, 'Âyet âyet', true)).join('')}</div>

    <div class="ez-group-title">🤲 Kur'an'dan Dualar</div>
    <div class="ez-grid">${kuranDua.map(s => kart('kurandua', s, 'Âyet âyet', true)).join('')}</div>

    <div class="ez-group-title">🕌 Namaz Duaları</div>
    <div class="ez-grid">${digerDua.map(s => kart('dua', s, 'Satır satır', !!HV_DUA_SES[s])).join('')}</div>
  `;
  hvEzBasaSar();
}
window.renderEzber = renderEzber;
try { if (window.FEATURE_ROUTES) window.FEATURE_ROUTES['ezber'] = renderEzber; } catch (e) {}

/* ── Sure adı / kaldığın yer ────────────────────────────────────── */
function hvSureAdi(no) {
  try {
    const l = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : [];
    const s = l.find(x => Number(x.id) === Number(no));
    if (s && s.name) return s.name + ' Sûresi';
  } catch (e) {}
  return no + '. Sûre';
}


// Sure sure ↔ sayfa sayfa geçişi
function hvKuranModu(mod) {
  if (mod === 'sayfa') { navigateTo('mushaf'); return; }
  const liste = document.getElementById('surah-list-view');
  const detay = document.getElementById('surah-detail-view');
  if (liste) liste.style.display = 'block';
  if (detay) detay.style.display = 'none';
  navigateTo('quran');
}
window.hvKuranModu = hvKuranModu;

/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — KURAN DİNLE
   Sure sure kesintisiz dinleme. Uygulamanın başka bölümlerine geçsen de
   çalmaya devam eder; kilit ekranından da yönetilebilir.
   Kaynak: mp3quran.net (uygulamada zaten kullanılan sunucu)
   ═══════════════════════════════════════════════════════════════════════ */

const HV_DINLE_QARILER = [
  { id: 'husr',   sunucu: 'server13', ad: 'Mahmud Halil el-Husarî' },
  { id: 'afs',    sunucu: 'server8',  ad: 'Mishary Rashid Alafasy' },
  { id: 'minsh',  sunucu: 'server10', ad: 'Muhammed Sıddık el-Minşâvî' },
  { id: 'yasser', sunucu: 'server11', ad: 'Yâsir ed-Devserî' },
  // v66.1 — kullanıcı isteğiyle eklendi (mp3quran.net, 114 sûre tam; âyet âyet kayıtları yok → o modlarda Husarî okur)
  { id: 'alfaqih', sunucu: 'server16', yol: 'M_Alfaqih/Rewayat-Hafs-A-n-Assem', ad: 'Muhammed el-Fakih' },
  { id: 'mousa',   sunucu: 'server14', yol: 'mousa/Rewayat-Hafs-A-n-Assem',     ad: 'Abdullah el-Mûsâ' },
  // v66.2 — 10 hâfız (hepsi mp3quran 114 sûre + everyayah âyet âyet, doğrulandı)
  { id: 'basit',   sunucu: 'server7',  ad: 'Abdülbâsıt Abdüssamed' },
  { id: 'sds',     sunucu: 'server11', ad: 'Abdurrahman es-Sudeys' },
  { id: 's_gmd',   sunucu: 'server7',  ad: 'Saad el-Ğâmidî' },
  { id: 'maher',   sunucu: 'server12', ad: 'Mâhir el-Muaykılî' }
];
/* Seçili hâfızın âyet âyet (everyayah) kaydı var mı? Yoksa âyet modları Husarî ile okur. */
function hvDnAyetKaydiVar(id) { return !!(typeof HV_AA_KLASOR !== 'undefined' && HV_AA_KLASOR[id]); }

let hvDnSes = null;
let hvDnSure = 0;          // 0 = seçilmemiş
let hvDnCaliyor = false;

function hvDnSureAdi(no) {
  try {
    const l = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : [];
    const s = l.find(x => Number(x.id) === Number(no));
    if (s && s.name) return s.name;
  } catch (e) {}
  return no + '. Sûre';
}
function hvDnQari() {
  const id = hvGet('hv_dinle_qari', 'husr');
  return HV_DINLE_QARILER.find(q => q.id === id) || HV_DINLE_QARILER[0];
}
function hvDnUrl(no) {
  const q = hvDnQari();
  return 'https://' + q.sunucu + '.mp3quran.net/' + (q.yol || q.id) + '/' + String(no).padStart(3, '0') + '.mp3';
}
function hvDnSure2(sn) { const m = Math.floor(sn / 60), s = Math.floor(sn % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

function hvDnNesne() {
  if (hvDnSes) return hvDnSes;
  hvDnSes = new Audio();
  hvDnSes.preload = 'metadata';

  hvDnSes.addEventListener('timeupdate', () => {
    const c = document.getElementById('dn-cizgi');
    const g = document.getElementById('dn-gecen');
    const t = document.getElementById('dn-toplam');
    if (c && hvDnSes.duration) c.value = (hvDnSes.currentTime / hvDnSes.duration) * 100;
    if (g) g.textContent = hvDnSure2(hvDnSes.currentTime || 0);
    if (t) t.textContent = hvDnSes.duration ? hvDnSure2(hvDnSes.duration) : '--:--';
    if (hvDnSure) { try { localStorage.setItem('hv_dinle_pos', String(Math.floor(hvDnSes.currentTime))); } catch (e) {} }
  });

  hvDnSes.addEventListener('ended', () => {
    const surekli = hvGet('hv_dinle_surekli', '1') === '1';
    if (surekli && hvDnSure < 114) { hvDnCal(hvDnSure + 1); }
    else { hvDnCaliyor = false; hvDnTazele(); }
  });

  hvDnSes.addEventListener('error', () => {
    hvDnCaliyor = false; hvDnTazele();
    try { showToastNotification('🔇 Ses yüklenemedi', 'İnternet bağlantını kontrol et ya da başka bir okuyucu seç.'); } catch (e) {}
  });

  hvDnSes.addEventListener('play',  () => { hvDnCaliyor = true;  hvDnTazele(); });
  hvDnSes.addEventListener('pause', () => { hvDnCaliyor = false; hvDnTazele(); });
  return hvDnSes;
}

// Kilit ekranı / kulaklık düğmeleri
function hvDnMedyaBilgisi() {
  try {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: hvDnSureAdi(hvDnSure) + ' Sûresi',
      artist: hvDnQari().ad,
      album: 'Kur\'an-ı Kerim — Namaz Dostu'
    });
    navigator.mediaSession.setActionHandler('play',  () => hvDnBasDurdur());
    navigator.mediaSession.setActionHandler('pause', () => hvDnBasDurdur());
    navigator.mediaSession.setActionHandler('previoustrack', () => hvDnAtla(-1));
    navigator.mediaSession.setActionHandler('nexttrack',     () => hvDnAtla(1));
  } catch (e) {}
}

function hvDnCal(no, baslangicSn) {
  if (hvDnMod() !== 'ar') { hvAaCal(no, 0); return; }
  no = Math.max(1, Math.min(114, parseInt(no, 10) || 1));
  hvDnSure = no;
  hvSet('hv_dinle_sure', no);
  const s = hvDnNesne();
  s.src = hvDnUrl(no);
  s.load();
  if (baslangicSn) {
    const atla = () => { try { s.currentTime = baslangicSn; } catch (e) {} s.removeEventListener('loadedmetadata', atla); };
    s.addEventListener('loadedmetadata', atla);
  } else {
    try { localStorage.setItem('hv_dinle_pos', '0'); } catch (e) {}
  }
  s.play().catch(() => {});
  hvDnMedyaBilgisi();
  hvDnTazele();
}
window.hvDnCal = hvDnCal;

function hvDnBasDurdur() {
  if (hvDnMod() !== 'ar') { hvAaBasDurdur(); return; }
  const s = hvDnNesne();
  if (!hvDnSure) { hvDnCal(parseInt(hvGet('hv_dinle_sure', '1'), 10)); return; }
  if (s.paused) { if (!s.src) { hvDnCal(hvDnSure); return; } s.play().catch(() => {}); }
  else s.pause();
}
window.hvDnBasDurdur = hvDnBasDurdur;

function hvDnAtla(yon) {
  if (hvDnMod() !== 'ar') { hvAaAtlaAyet(yon); return; }   // âyet âyet modda âyet atlar
  const y = hvDnSure + yon;
  if (y < 1 || y > 114) return;
  hvDnCal(y);
}
window.hvDnAtla = hvDnAtla;

function hvDnSar(deger) {
  const s = hvDnNesne();
  if (s.duration) { try { s.currentTime = (deger / 100) * s.duration; } catch (e) {} }
}
window.hvDnSar = hvDnSar;

function hvDnQariDegistir(id) {
  hvSet('hv_dinle_qari', id);
  if (hvDnMod() !== 'ar') {
    const devam = hvAaCaliyor;
    hvAaDurdur();
    if (devam && hvAaSure) hvAaCal(hvAaSure, hvAaIdx);
    hvDnTazele();
    return;
  }
  if (hvDnSure) {
    const kaldi = hvDnSes ? hvDnSes.currentTime : 0;
    const caliyordu = hvDnCaliyor;
    hvDnCal(hvDnSure, kaldi);
    if (!caliyordu && hvDnSes) hvDnSes.pause();
  }
  hvDnTazele();
}
window.hvDnQariDegistir = hvDnQariDegistir;

function hvDnSurekliDegistir(el) { hvSet('hv_dinle_surekli', el.checked ? '1' : '0'); }
window.hvDnSurekliDegistir = hvDnSurekliDegistir;

function hvDnTazele() {
  const ayetMod = hvDnMod() !== 'ar';
  const b = document.getElementById('dn-play');
  if (b) b.innerHTML = (ayetMod ? hvAaCaliyor : hvDnCaliyor) ? '⏸' : '▶️';
  const ad = document.getElementById('dn-simdi');
  const aktif = ayetMod ? hvAaSure : hvDnSure;
  if (ad) ad.textContent = aktif ? (hvDnSureAdi(aktif) + ' Sûresi') : 'Bir sûre seçin';
  const q = document.getElementById('dn-qari-ad');
  if (q) q.textContent = hvDnQari().ad;
  document.querySelectorAll('.dn-sure').forEach(el => {
    el.classList.toggle('caliyor', Number(el.dataset.no) === aktif);
  });
}

function hvDnAra(q) {
  const t = (q || '').toLocaleLowerCase('tr').trim();
  document.querySelectorAll('.dn-sure').forEach(el => {
    const ad = (el.dataset.ad || '').toLocaleLowerCase('tr');
    el.style.display = (!t || ad.includes(t) || el.dataset.no === t) ? '' : 'none';
  });
}
window.hvDnAra = hvDnAra;

/* ═══════════════════════════════════════════════════════════════════════
   v62.1 — KURAN DİNLE: ÂYET ÂYET ARAPÇA + TÜRKÇE MEÂL
   Üç mod: Arapça (tam sûre kaydı) · Arapça + Meal · Sadece Meal
   Meâli telefonun kendi Türkçe sesi okur (Web Speech). Cihazda en iyi
   Türkçe ses otomatik seçilir; hız ve ton meal okumaya göre ayarlanır.
   ═══════════════════════════════════════════════════════════════════════ */

/* everyayah.com âyet âyet kayıtları — dördü de doğrulandı */
const HV_AA_KLASOR = {
  husr:   'Husary_128kbps',
  afs:    'Alafasy_128kbps',
  minsh:  'Minshawy_Murattal_128kbps',
  yasser: 'Yasser_Ad-Dussary_128kbps',
  basit:  'Abdul_Basit_Murattal_192kbps',
  sds:    'Abdurrahmaan_As-Sudais_192kbps',
  s_gmd:  'Ghamadi_40kbps',
  maher:  'MaherAlMuaiqly128kbps'
};
function hvAaUrl(sure, ayet) {
  const q = hvDnQari();
  const k = HV_AA_KLASOR[q.id] || HV_AA_KLASOR.husr;
  const p3 = n => String(n).padStart(3, '0');
  return 'https://everyayah.com/data/' + k + '/' + p3(sure) + p3(ayet) + '.mp3';
}

function hvDnMod() { return hvGet('hv_dinle_mod', 'ar'); }
function hvDnModDegistir(m) {
  hvAaDurdur(); hvDnDurdurTam();
  hvSet('hv_dinle_mod', m);
  renderDinle();
}
window.hvDnModDegistir = hvDnModDegistir;

/* ── Türkçe ses (Web Speech) ───────────────────────────────────────── */
let hvTtsSecili = null;
function hvTtsSesler() {
  try { return window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { return []; }
}
function hvTtsVar() { return !!window.speechSynthesis; }
function hvTtsTurkceSesler() {
  return hvTtsSesler().filter(v => /^tr(-|_|$)/i.test(v.lang || ''));
}
window.hvTtsTurkceSesler = hvTtsTurkceSesler;

function hvTtsSesSec(ad) {
  hvSet('hv_tts_ses', ad || '');
  hvTtsSecili = null;
  hvTtsTurkceSes();
}
window.hvTtsSesSec = hvTtsSesSec;

function hvTtsTurkceSes() {
  if (hvTtsSecili) return hvTtsSecili;
  const hepsi = hvTtsTurkceSesler();
  if (!hepsi.length) return null;
  // Kullanıcı elle bir ses seçtiyse onu kullan
  const secilenAd = hvGet('hv_tts_ses', '');
  if (secilenAd) {
    const bul = hepsi.find(v => v.name === secilenAd);
    if (bul) { hvTtsSecili = bul; return bul; }
  }
  // Önce "geliştirilmiş/premium" sesler, sonra cihazın kendi sesi
  const puan = v => {
    const ad = (v.name || '').toLowerCase();
    let p = 0;
    if (/premium|enhanced|geliştir|neural|natural/.test(ad)) p += 10;
    if (/yelda|filiz|tolga|emel/.test(ad)) p += 4;
    if (v.localService) p += 2;
    return p;
  };
  hepsi.sort((a, b) => puan(b) - puan(a));
  hvTtsSecili = hepsi[0];
  return hvTtsSecili;
}
try {
  if (window.speechSynthesis && typeof speechSynthesis.addEventListener === 'function') {
    speechSynthesis.addEventListener('voiceschanged', () => { hvTtsSecili = null; hvTtsTurkceSes(); });
  }
} catch (e) {}

function hvTtsHiz() { return parseFloat(hvGet('hv_tts_hiz', '0.9')) || 0.9; }
function hvTtsHizDegistir(v) { hvSet('hv_tts_hiz', v); document.querySelectorAll('.dn-hiz button').forEach(b => b.classList.toggle('on', b.dataset.h === String(v))); }
window.hvTtsHizDegistir = hvTtsHizDegistir;

/* Uzun meâli cümlelere böl — robot tınısını azaltır, iOS'ta kesilmeyi önler */
function hvTtsParcala(metin) {
  const t = String(metin || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const p = t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t];
  const out = []; let biriktir = '';
  p.forEach(x => {
    if ((biriktir + x).length < 90) { biriktir += x; }
    else { if (biriktir.trim()) out.push(biriktir.trim()); biriktir = x; }
  });
  if (biriktir.trim()) out.push(biriktir.trim());
  return out;
}

function hvTtsDurdur() { try { speechSynthesis.cancel(); } catch (e) {} }

/* iOS/Safari konuşmayı yalnızca kullanıcı dokunuşundan sonra başlatır.
   ▶️ tuşuna basıldığında sessiz bir cümle söyleyip izni açarız. */
let hvTtsIsitildi = false;
function hvTtsIsit() {
  if (hvTtsIsitildi || !hvTtsVar()) return;
  try {
    hvTtsTurkceSes();                       // ses listesini tetikle
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 1; u.lang = 'tr-TR';
    speechSynthesis.speak(u);
    hvTtsIsitildi = true;
  } catch (e) {}
}
window.hvTtsIsit = hvTtsIsit;

function hvTtsOku(metin, bitince) {
  if (!hvTtsVar()) { if (bitince) bitince(false); return; }
  const parcalar = hvTtsParcala(metin);
  if (!parcalar.length) { if (bitince) bitince(true); return; }
  const ses = hvTtsTurkceSes();
  try { speechSynthesis.cancel(); } catch (e) {}
  let i = 0, nobet = null;
  const temizle = () => { if (nobet) { clearTimeout(nobet); nobet = null; } };
  const sonraki = () => {
    temizle();
    // Hem Kuran Dinle hem Kuran Oku bu okuyucuyu kullanır
    if (!hvAaCaliyor && !hvMvCalisiyor) return;
    if (i >= parcalar.length) { if (bitince) bitince(true); return; }
    const metinParca = parcalar[i++];
    const u = new SpeechSynthesisUtterance(metinParca);
    u.lang = 'tr-TR';
    if (ses) u.voice = ses;
    u.rate = hvTtsHiz();
    u.pitch = 1.0;
    u.volume = 1.0;
    let bitti = false;
    const bir = ok => { if (bitti) return; bitti = true; temizle(); ok ? sonraki() : (bitince && bitince(false)); };
    u.onend = () => bir(true);
    u.onerror = () => bir(false);
    // Emniyet: bazı cihazlarda onend hiç gelmez → tahmini süre + 3sn sonra devam
    const tahmin = Math.max(2500, (metinParca.length * 95) / Math.max(0.5, hvTtsHiz()) + 3000);
    nobet = setTimeout(() => bir(true), tahmin);
    try { speechSynthesis.speak(u); } catch (e) { bir(false); }
  };
  sonraki();
}

/* Cihazda Türkçe ses var mı? (yoksa kullanıcıya söylenir) */
function hvTtsTurkceVarMi() { return !!(hvTtsVar() && hvTtsTurkceSes()); }
window.hvTtsTurkceVarMi = hvTtsTurkceVarMi;

/* ── Âyet âyet çalar ───────────────────────────────────────────────── */
let hvAaSure = 0, hvAaIdx = 0, hvAaCaliyor = false, hvAaSes = null, hvAaListe = [];

function hvAaSesNesnesi() {
  if (!hvAaSes) {
    hvAaSes = new Audio();
    hvAaSes.preload = 'auto';
    hvAaSes.addEventListener('ended', () => {
      if (!hvAaCaliyor) return;
      if (hvDnMod() === 'both') hvAaMealOku();
      else hvAaSonraki();
    });
    hvAaSes.addEventListener('error', () => {
      if (!hvAaCaliyor) return;
      if (hvDnMod() === 'both') hvAaMealOku(); else hvAaSonraki();
    });
  }
  return hvAaSes;
}

function hvAaListeKur(sure) {
  const liste = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : [];
  const s = liste.find(x => Number(x.id) === Number(sure));
  const adet = s ? Number(s.verse_count) : 0;
  const out = [];
  let oncekiMeal = null;
  for (let v = 1; v <= adet; v++) {
    const tr = (typeof hvMeal === 'function') ? hvMeal(sure, v) : '';
    // Diyanet birleşik meâllerinde metin bir kez okunur
    const tekrar = (tr && tr === oncekiMeal);
    oncekiMeal = tr;
    out.push({ v: v, tr: tr, okuma: !tekrar });
  }
  return out;
}

async function hvAaCal(sure, baslaIdx) {
  try { hvTtsIsit(); } catch (e) {}
  await hvMealHazir();
  hvAaSure = Math.max(1, Math.min(114, parseInt(sure, 10) || 1));
  hvAaListe = hvAaListeKur(hvAaSure);
  hvAaIdx = Math.max(0, Math.min(hvAaListe.length - 1, parseInt(baslaIdx, 10) || 0));
  hvAaCaliyor = true;
  hvSet('hv_dinle_sure', hvAaSure);
  hvAaOynat();
}
window.hvAaCal = hvAaCal;

function hvAaOynat() {
  if (!hvAaCaliyor) return;
  if (hvAaIdx >= hvAaListe.length) {   // sûre bitti
    if (hvGet('hv_dinle_surekli', '1') === '1' && hvAaSure < 114) { hvAaCal(hvAaSure + 1, 0); return; }
    hvAaIdx = Math.max(0, hvAaListe.length - 1);   // son âyet ekranda kalsın
    hvAaDurdur(); return;
  }
  hvAaEkran();
  const mod = hvDnMod();
  if (mod === 'tr') { hvAaMealOku(); return; }
  const s = hvAaSesNesnesi();
  s.src = hvAaUrl(hvAaSure, hvAaListe[hvAaIdx].v);
  s.play().catch(() => { if (hvAaCaliyor) { if (mod === 'both') hvAaMealOku(); else hvAaSonraki(); } });
}

function hvAaMealOku() {
  const p = hvAaListe[hvAaIdx];
  if (!p || !p.okuma || !p.tr) { hvAaSonraki(); return; }
  if (!hvTtsTurkceVarMi()) {
    // Türkçe ses yoksa meâli sadece ekranda göster, 6 sn bekleyip geç
    setTimeout(() => { if (hvAaCaliyor) hvAaSonraki(); }, 6000);
    return;
  }
  hvTtsOku(p.tr, () => { if (hvAaCaliyor) hvAaSonraki(); });
}

function hvAaSonraki() {
  hvAaIdx++;
  hvAaOynat();
}

function hvAaAtlaAyet(yon) {
  if (!hvAaListe.length) return;
  hvTtsDurdur();
  try { if (hvAaSes) hvAaSes.pause(); } catch (e) {}
  hvAaIdx = Math.max(0, Math.min(hvAaListe.length - 1, hvAaIdx + yon));
  if (hvAaCaliyor) hvAaOynat(); else hvAaEkran();
}
window.hvAaAtlaAyet = hvAaAtlaAyet;

function hvAaDurdur() {
  hvAaCaliyor = false;
  hvTtsDurdur();
  try { if (hvAaSes) hvAaSes.pause(); } catch (e) {}
  hvAaEkran();
  hvDnTazele();
}
window.hvAaDurdur = hvAaDurdur;

function hvAaBasDurdur() {
  if (hvAaCaliyor) { hvAaDurdur(); return; }
  try { hvTtsIsit(); } catch (e) {}
  const sure = hvAaSure || parseInt(hvGet('hv_dinle_sure', '1'), 10) || 1;
  hvAaCal(sure, hvAaIdx);
}
window.hvAaBasDurdur = hvAaBasDurdur;

function hvAaEkran() {
  const k = document.getElementById('dn-ayet-kutu');
  if (!k) return;
  const p = hvAaListe[hvAaIdx];
  if (!p) { k.innerHTML = '<div class="dn-ayet-bos">Bir sûre seçip ▶️ tuşuna bas.</div>'; return; }
  k.innerHTML = `
    <div class="dn-ayet-ust">${hvDnSureAdi(hvAaSure)} Sûresi • ${p.v}. âyet <span class="dn-ayet-sayac">${hvAaIdx + 1}/${hvAaListe.length}</span></div>
    <div class="dn-ayet-meal">${hvEsc(p.tr || '—')}</div>`;
  const b = document.getElementById('dn-play');
  if (b) b.innerHTML = hvAaCaliyor ? '⏸' : '▶️';
  const ad = document.getElementById('dn-simdi');
  if (ad) ad.textContent = hvDnSureAdi(hvAaSure) + ' Sûresi';
}

function hvDnDurdurTam() { try { if (hvDnSes) hvDnSes.pause(); } catch (e) {} }

function renderDinle() {
  const kok = document.getElementById('dinle-root');
  if (!kok) return;
  const qari = hvDnQari().id;   // kayıtlı seçim listede yoksa ilk hafıza döner
  const mod = hvDnMod();
  const ayetMod = mod !== 'ar';
  const hiz = hvGet('hv_tts_hiz', '0.9');
  const surekli = hvGet('hv_dinle_surekli', '1') === '1';
  const kayitli = parseInt(hvGet('hv_dinle_sure', '0'), 10) || 0;
  const kayitliSn = parseInt(hvGet('hv_dinle_pos', '0'), 10) || 0;
  const liste = (typeof ALL_114_SURAHS !== 'undefined') ? ALL_114_SURAHS : [];

  kok.innerHTML = `
    <div class="page-header-title">
      <h2>🎧 Kuran Dinle</h2>
      <p>Kesintisiz dinle • uygulamada gezerken de çalar</p>
    </div>

    <div class="dn-mod">
      <button class="${mod === 'ar' ? 'on' : ''}" onclick="hvDnModDegistir('ar')">Arapça</button>
      <button class="${mod === 'both' ? 'on' : ''}" onclick="hvDnModDegistir('both')">Arapça + Meal</button>
      <button class="${mod === 'tr' ? 'on' : ''}" onclick="hvDnModDegistir('tr')">Sadece Meal</button>
    </div>

    <div class="dn-player">
      <div id="dn-simdi" class="dn-simdi">${hvDnSure ? hvDnSureAdi(hvDnSure) + ' Sûresi' : (kayitli ? hvDnSureAdi(kayitli) + ' Sûresi' : 'Bir sûre seçin')}</div>
      <div id="dn-qari-ad" class="dn-qari-ad">${hvDnQari().ad}</div>

      ${ayetMod ? `<div id="dn-ayet-kutu" class="dn-ayet-kutu"><div class="dn-ayet-bos">Aşağıdan bir sûre seç.</div></div>`
                : `<input id="dn-cizgi" class="dn-cizgi" type="range" min="0" max="100" value="0"
             oninput="hvDnSar(this.value)">
      <div class="dn-zaman"><span id="dn-gecen">0:00</span><span id="dn-toplam">--:--</span></div>`}

      <div class="dn-btns">
        <button class="dn-yan" onclick="hvDnAtla(-1)" title="${ayetMod ? 'Önceki âyet' : 'Önceki sûre'}">⏮</button>
        <button id="dn-play" class="dn-play" onclick="hvDnBasDurdur()">${(ayetMod ? hvAaCaliyor : hvDnCaliyor) ? '⏸' : '▶️'}</button>
        <button class="dn-yan" onclick="hvDnAtla(1)" title="${ayetMod ? 'Sonraki âyet' : 'Sonraki sûre'}">⏭</button>
      </div>

      ${kayitli && !hvDnSure ? `<button class="dn-devam" onclick="hvDnCal(${kayitli}, ${kayitliSn})">📍 Kaldığın yerden devam et — ${hvDnSureAdi(kayitli)} ${kayitliSn ? '(' + hvDnSure2(kayitliSn) + ')' : ''}</button>` : ''}
    </div>

    <div class="dn-ayar">
      <select class="mv-qari" onchange="hvDnQariDegistir(this.value)">
        ${HV_DINLE_QARILER.map(q => `<option value="${q.id}" ${q.id === qari ? 'selected' : ''}>${q.ad}</option>`).join('')}
      </select>
      ${(mod !== 'ar' && !hvDnAyetKaydiVar(qari)) ? `<div class="mv-tts-not">ℹ️ Bu hâfızın âyet âyet kaydı bulunmuyor; "Arapça + Meal" modunda Husarî okur. Kendi sesi için "Arapça" modunu seç.</div>` : ''}
      <label class="dn-switch">
        <input type="checkbox" ${surekli ? 'checked' : ''} onchange="hvDnSurekliDegistir(this)">
        <span>Bitince sıradaki sûre</span>
      </label>
    </div>

    ${ayetMod ? `
    ${hvTtsTurkceSesler().length > 1 ? `
    <div class="dn-hiz-satir">
      <span>Türkçe ses</span>
      <select class="mv-qari dn-ses-sec" onchange="hvTtsSesSec(this.value)">
        ${hvTtsTurkceSesler().map(v => `<option value="${v.name}" ${v.name === (hvTtsTurkceSes()||{}).name ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>
    </div>` : ''}

    <div class="dn-hiz-satir">
      <span>Meal okuma hızı</span>
      <div class="dn-hiz">
        <button class="${hiz === '0.75' ? 'on' : ''}" data-h="0.75" onclick="hvTtsHizDegistir('0.75')">Yavaş</button>
        <button class="${hiz === '0.9' ? 'on' : ''}"  data-h="0.9"  onclick="hvTtsHizDegistir('0.9')">Normal</button>
        <button class="${hiz === '1.05' ? 'on' : ''}" data-h="1.05" onclick="hvTtsHizDegistir('1.05')">Hızlı</button>
      </div>
    </div>
    ${hvTtsTurkceVarMi() ? '' : `<div class="dn-not uyari">⚠️ Bu cihazda Türkçe konuşma sesi bulunamadı. Meâl ekranda gösterilip sıradaki âyete geçilir. <button class="tts-yardim-btn" onclick="hvTtsYardim()">🔧 Ücretsiz nasıl düzeltirim?</button></div>`}
    <div class="dn-not">
      🔊 Meâli <b>telefonunun kendi Türkçe sesi</b> okur, bu yüzden kalite cihazdan cihaza değişir.
      Sesi belirgin şekilde iyileştirmek için ücretsiz "gelişmiş" sesi indir:<br>
      <b>iPhone:</b> Ayarlar → Erişilebilirlik → Konuşulan İçerik → Sesler → Türkçe → <b>Yelda (Gelişmiş)</b><br>
      <b>Android:</b> Ayarlar → Erişilebilirlik → Metin okuma → Google Metin Okuma → Sesi yükle → Türkçe
      <br>İndirdikten sonra uygulamayı kapatıp açman yeterli; yukarıdaki listeden yeni sesi seçebilirsin.
    </div>
    ` : ''}

    <div class="quran-search-bar">
      <span class="search-icon-fixed">🔍</span>
      <input type="text" class="search-input-field" placeholder="Sûre ara (ör. Yasin)..." oninput="hvDnAra(this.value)">
    </div>

    <div class="dn-liste">
      ${liste.map(s => `
        <button class="dn-sure ${Number(s.id) === hvDnSure ? 'caliyor' : ''}" data-no="${s.id}" data-ad="${s.name}"
                onclick="${ayetMod ? `hvAaCal(${s.id},0)` : `hvDnCal(${s.id})`}">
          <span class="dn-no">${s.id}</span>
          <span class="dn-ad">${s.name} Sûresi</span>
          <span class="dn-ayet">${s.verse_count} ayet</span>
        </button>`).join('')}
    </div>
  `;
  hvDnTazele();
  if (ayetMod) { hvMealHazir().then(() => { if (!hvAaListe.length && hvAaSure) hvAaListe = hvAaListeKur(hvAaSure); hvAaEkran(); }); }
}
window.renderDinle = renderDinle;
try { if (window.FEATURE_ROUTES) window.FEATURE_ROUTES['dinle'] = () => { hvSet('hv_dinle_mod', 'ar'); renderDinle(); }; } catch (e) {}   // sayfa her açılışta Arapça ile başlar

/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — ELİFBÂ (Kur'an okumayı öğrenme)
   28 harf • yazılış biçimleri • harekeler • tanıma alıştırması
   Harflerin başta/ortada/sonda biçimleri ZWJ (birleştirici) ile
   otomatik oluşturulur; elle glif yazılmaz, yanlış harf riski yoktur.
   ═══════════════════════════════════════════════════════════════════════ */

const HV_ELIFBA = [
  { h: 'ا', ad: 'Elif',  ok: 'Kendi sesi yoktur; uzatma harfidir.', nokta: 0, birlesir: false, ses: '', kalin: false },
  { h: 'ب', ad: 'Be',    ok: 'B sesi verir.', nokta: 1, birlesir: true, ses: 'b', kalin: false },
  { h: 'ت', ad: 'Te',    ok: 'İnce T sesi verir.', nokta: 2, birlesir: true, ses: 't', kalin: false },
  { h: 'ث', ad: 'Se',    ok: 'Peltek S — dil ucu ön dişlere değer.', nokta: 3, birlesir: true, ses: 's', kalin: false },
  { h: 'ج', ad: 'Cim',   ok: 'C sesi verir.', nokta: 1, birlesir: true, ses: 'c', kalin: false },
  { h: 'ح', ad: 'Ha',    ok: 'Boğazdan gelen ince H sesi.', nokta: 0, birlesir: true, ses: 'h', kalin: false },
  { h: 'خ', ad: 'Hı',    ok: 'Hırıltılı, kalın H sesi.', nokta: 1, birlesir: true, ses: 'h', kalin: true },
  { h: 'د', ad: 'Dal',   ok: 'D sesi verir.', nokta: 0, birlesir: false, ses: 'd', kalin: false },
  { h: 'ذ', ad: 'Zel',   ok: 'Peltek Z — dil ucu ön dişlere değer.', nokta: 1, birlesir: false, ses: 'z', kalin: false },
  { h: 'ر', ad: 'Ra',    ok: 'R sesi verir.', nokta: 0, birlesir: false, ses: 'r', kalin: false },
  { h: 'ز', ad: 'Ze',    ok: 'Z sesi verir.', nokta: 1, birlesir: false, ses: 'z', kalin: false },
  { h: 'س', ad: 'Sin',   ok: 'S sesi verir.', nokta: 0, birlesir: true, ses: 's', kalin: false },
  { h: 'ش', ad: 'Şın',   ok: 'Ş sesi verir.', nokta: 3, birlesir: true, ses: 'ş', kalin: false },
  { h: 'ص', ad: 'Sad',   ok: 'Kalın S sesi.', nokta: 0, birlesir: true, ses: 's', kalin: true },
  { h: 'ض', ad: 'Dad',   ok: 'Kalın D sesi.', nokta: 1, birlesir: true, ses: 'd', kalin: true },
  { h: 'ط', ad: 'Tı',    ok: 'Kalın T sesi.', nokta: 0, birlesir: true, ses: 't', kalin: true },
  { h: 'ظ', ad: 'Zı',    ok: 'Kalın, peltek Z sesi.', nokta: 1, birlesir: true, ses: 'z', kalin: true },
  { h: 'ع', ad: 'Ayn',   ok: 'Boğazın ortasından çıkan A sesi.', nokta: 0, birlesir: true, ses: '', kalin: false, harekeli: ['a', 'i', 'u'] },
  { h: 'غ', ad: 'Ğayn',  ok: 'Gırtlaktan gelen Ğ sesi.', nokta: 1, birlesir: true, ses: 'ğ', kalin: true },
  { h: 'ف', ad: 'Fe',    ok: 'F sesi verir.', nokta: 1, birlesir: true, ses: 'f', kalin: false },
  { h: 'ق', ad: 'Kaf',   ok: 'Dil kökünden çıkan kalın K sesi.', nokta: 2, birlesir: true, ses: 'k', kalin: true },
  { h: 'ك', ad: 'Kef',   ok: 'İnce K sesi.', nokta: 0, birlesir: true, ses: 'k', kalin: false },
  { h: 'ل', ad: 'Lam',   ok: 'L sesi verir.', nokta: 0, birlesir: true, ses: 'l', kalin: false },
  { h: 'م', ad: 'Mim',   ok: 'M sesi verir.', nokta: 0, birlesir: true, ses: 'm', kalin: false },
  { h: 'ن', ad: 'Nun',   ok: 'N sesi verir.', nokta: 1, birlesir: true, ses: 'n', kalin: false },
  { h: 'و', ad: 'Vav',   ok: 'V sesi verir; uzatma harfi de olur.', nokta: 0, birlesir: false, ses: 'v', kalin: false },
  { h: 'ه', ad: 'He',    ok: 'Yumuşak H sesi.', nokta: 0, birlesir: true, ses: 'h', kalin: false },
  { h: 'ي', ad: 'Ye',    ok: 'Y sesi verir; uzatma harfi de olur.', nokta: 2, birlesir: true, ses: 'y', kalin: false },
];

const HV_HAREKELER = [
  { ad: 'Üstün (Fetha)', im: 'َ', anlat: 'Harfin üstüne çizilir, harfe "e / a" sesi verir.', ornek: 'be' },
  { ad: 'Esre (Kesra)',  im: 'ِ', anlat: 'Harfin altına çizilir, harfe "i" sesi verir.', ornek: 'bi' },
  { ad: 'Ötre (Damme)',  im: 'ُ', anlat: 'Harfin üstüne konur, harfe "u / ü" sesi verir.', ornek: 'bü' },
  { ad: 'Cezim (Sükûn)', im: 'ْ', anlat: 'Harf harekesizdir; kendinden önceki sese bağlanır.', ornek: 'b' },
  { ad: 'Şedde',         im: 'ّ', anlat: 'Harfin iki kez okunduğunu gösterir.', ornek: 'bb' }
];

const HV_ZWJ = '‍';

// Harfin başta / ortada / sonda biçimini üretir
function hvElifbaBicim(harf, yer, birlesir) {
  if (yer === 'tek') return harf;
  if (!birlesir) {
    // Bu harfler kendinden sonrakine bağlanmaz
    if (yer === 'bas') return harf;
    return HV_ZWJ + harf;
  }
  if (yer === 'bas')  return harf + HV_ZWJ;
  if (yer === 'orta') return HV_ZWJ + harf + HV_ZWJ;
  return HV_ZWJ + harf;
}

let hvElIdx = -1;

function hvElifbaAc(i) {
  hvElIdx = i;
  const d = HV_ELIFBA[i];
  const kutu = document.getElementById('el-detay');
  if (!kutu || !d) return;
  const noktaYazi = d.nokta === 0 ? 'Noktasız' : (d.nokta + ' nokta');
  kutu.innerHTML = `
    <div class="el-detay-kart">
      <div class="el-buyuk">${d.h}</div>
      <div class="el-ad">${d.ad}</div>
      <div class="el-ok">${d.ok}</div>
      <div class="el-etiket">${noktaYazi}${d.birlesir ? '' : ' • sonraki harfe bağlanmaz'}</div>

      <div class="el-bolum">Yazılış biçimleri</div>
      <div class="el-bicimler">
        <div><span>${hvElifbaBicim(d.h, 'tek', d.birlesir)}</span><em>Tek başına</em></div>
        <div><span>${hvElifbaBicim(d.h, 'bas', d.birlesir)}</span><em>Başta</em></div>
        <div><span>${hvElifbaBicim(d.h, 'orta', d.birlesir)}</span><em>Ortada</em></div>
        <div><span>${hvElifbaBicim(d.h, 'son', d.birlesir)}</span><em>Sonda</em></div>
      </div>

      ${d.ad === 'Elif' ? '' : `
      <div class="el-bolum">Harekeli okunuşu</div>
      <div class="el-harekeli">
        <div><span>${d.h}َ</span><em>${d.harekeli ? d.harekeli[0] : d.ses + (d.kalin ? 'a' : 'e')}</em></div>
        <div><span>${d.h}ِ</span><em>${d.harekeli ? d.harekeli[1] : d.ses + (d.kalin ? 'ı' : 'i')}</em></div>
        <div><span>${d.h}ُ</span><em>${d.harekeli ? d.harekeli[2] : d.ses + (d.kalin ? 'u' : 'ü')}</em></div>
      </div>
      <div class="el-hareke-not">${d.harekeli ? 'Boğaz harfidir; sesi gırtlaktan çıkar.' : (d.kalin ? 'Kalın harftir; harekeler kalın okunur.' : 'İnce harftir; harekeler ince okunur.')}</div>`}

      <div class="el-nav">
        <button class="gold-outline-btn" onclick="hvElifbaAc(${i - 1})" ${i === 0 ? 'disabled' : ''}>← Önceki</button>
        <button class="gold-primary-btn" onclick="hvElifbaAc(${i + 1})" ${i === HV_ELIFBA.length - 1 ? 'disabled' : ''}>Sonraki →</button>
      </div>
    </div>`;
  kutu.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  document.querySelectorAll('.el-harf').forEach((el, k) => el.classList.toggle('secili', k === i));
}
window.hvElifbaAc = hvElifbaAc;

/* ── Tanıma alıştırması ── */
let hvElSoru = null, hvElDogru = 0, hvElToplam = 0;

function hvElifbaSoruUret() {
  const dogru = Math.floor(Math.random() * HV_ELIFBA.length);
  const secenekler = [dogru];
  while (secenekler.length < 4) {
    const r = Math.floor(Math.random() * HV_ELIFBA.length);
    if (secenekler.indexOf(r) === -1) secenekler.push(r);
  }
  secenekler.sort(() => Math.random() - 0.5);
  hvElSoru = { dogru: dogru, secenekler: secenekler };
  const k = document.getElementById('el-test');
  if (!k) return;
  k.innerHTML = `
    <div class="el-test-skor">Doğru: ${hvElDogru} / ${hvElToplam}</div>
    <div class="el-test-harf">${HV_ELIFBA[dogru].h}</div>
    <div class="el-test-soru">Bu harfin adı nedir?</div>
    <div class="el-test-secenekler">
      ${secenekler.map(s => `<button class="el-secenek" data-i="${s}" onclick="hvElifbaCevap(${s}, this)">${HV_ELIFBA[s].ad}</button>`).join('')}
    </div>`;
}
window.hvElifbaSoruUret = hvElifbaSoruUret;

function hvElifbaCevap(secilen, btn) {
  if (!hvElSoru || btn.disabled) return;
  hvElToplam++;
  const dogru = hvElSoru.dogru;
  document.querySelectorAll('.el-secenek').forEach(b => {
    b.disabled = true;
    if (Number(b.dataset.i) === dogru) b.classList.add('dogru');
  });
  if (secilen === dogru) { hvElDogru++; }
  else { btn.classList.add('yanlis'); }
  const skor = document.querySelector('.el-test-skor');
  if (skor) skor.textContent = 'Doğru: ' + hvElDogru + ' / ' + hvElToplam;
  const k = document.getElementById('el-test');
  const bar = document.createElement('button');
  bar.className = 'gold-primary-btn el-sonraki';
  bar.textContent = 'Sonraki soru →';
  bar.onclick = hvElifbaSoruUret;
  k.appendChild(bar);
}
window.hvElifbaCevap = hvElifbaCevap;

/* ── Ekran ── */
let hvElSekme = 'harfler';
function hvElifbaSekme(s) { hvElSekme = s; renderElifba(); }
window.hvElifbaSekme = hvElifbaSekme;

function renderElifba() {
  const kok = document.getElementById('elifba-root');
  if (!kok) return;

  const sekmeler = `
    <div class="qmode el-sekme">
      <button class="${hvElSekme === 'harfler' ? 'on' : ''}" onclick="hvElifbaSekme('harfler')">🔤 Harfler</button>
      <button class="${hvElSekme === 'hareke' ? 'on' : ''}" onclick="hvElifbaSekme('hareke')">◌َ Harekeler</button>
      <button class="${hvElSekme === 'test' ? 'on' : ''}" onclick="hvElifbaSekme('test')">✍️ Alıştırma</button>
    </div>`;

  let govde = '';
  if (hvElSekme === 'harfler') {
    govde = `
      <div class="el-info">28 harfe dokunarak adını, okunuşunu ve kelime içinde nasıl yazıldığını gör.</div>
      <div class="el-uyari">ℹ️ Bu bölüm genel elifbâ bilgisidir, Diyanet İşleri Başkanlığı kaynaklı değildir. Kur'an okumayı bir hocadan ya da Kur'an kursundan öğrenmen, telaffuzun doğru oturması için gereklidir.</div>
      <div class="el-grid">
        ${HV_ELIFBA.map((d, i) => `
          <button class="el-harf" onclick="hvElifbaAc(${i})">
            <span class="el-h">${d.h}</span><span class="el-n">${d.ad}</span>
          </button>`).join('')}
      </div>
      <div id="el-detay"></div>`;
  } else if (hvElSekme === 'hareke') {
    govde = `
      <div class="el-info">Harfler tek başına sessizdir. Hareke, harfe hangi sesle okunacağını söyler.</div>
      ${HV_HAREKELER.map(x => `
        <div class="el-hareke-kart">
          <div class="el-hareke-ust">
            <span class="el-hareke-im">ب${x.im}</span>
            <div>
              <div class="el-hareke-ad">${x.ad}</div>
              <div class="el-hareke-ornek">be harfi → <b>${x.ornek}</b></div>
            </div>
          </div>
          <div class="el-hareke-anlat">${x.anlat}</div>
        </div>`).join('')}`;
  } else {
    govde = `<div class="el-info">Ekranda çıkan harfin adını seç. Yanlış yaparsan doğrusu yeşil görünür.</div>
             <div id="el-test" class="el-test"></div>`;
  }

  kok.innerHTML = `
    <div class="page-header-title">
      <h2>🔤 Elifbâ</h2>
      <p>Kur'an okumayı sıfırdan öğren</p>
    </div>
    ${sekmeler}
    ${govde}`;

  if (hvElSekme === 'test') hvElifbaSoruUret();
}
window.renderElifba = renderElifba;
try { if (window.FEATURE_ROUTES) window.FEATURE_ROUTES['elifba'] = renderElifba; } catch (e) {}

/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — "NİÇİN MEAL?" AYET KARTI
   Kur'an'ın anlaşılmak için indirildiğini bildiren ayetler.
   Arapça: alquran.cloud (Osmanî/Hafs) • Meal: Diyanet İşleri Başkanlığı Kur'an-ı Kerim Meâli
   Her ayetin sûre ve numara eşleşmesi tek tek doğrulandı.
   ═══════════════════════════════════════════════════════════════════════ */

const HV_ANLAM_AYETLERI = [
  {
    ar: 'إِنَّآ أَنزَلْنَٰهُ قُرْءَٰنًا عَرَبِيًّۭا لَّعَلَّكُمْ تَعْقِلُونَ',
    tr: 'Biz onu, akıl erdiresiniz diye Arapça bir Kur\'an olarak indirdik.',
    kaynak: 'Yûsuf sûresi, 2. âyet'
  },
  {
    ar: 'كِتَٰبٌ أَنزَلْنَٰهُ إِلَيْكَ مُبَٰرَكٌۭ لِّيَدَّبَّرُوٓا۟ ءَايَٰتِهِۦ وَلِيَتَذَكَّرَ أُو۟لُوا۟ ٱلْأَلْبَٰبِ',
    tr: 'Bu Kur\'an, âyetlerini düşünsünler ve akıl sahipleri öğüt alsınlar diye sana indirdiğimiz mübarek bir kitaptır.',
    kaynak: 'Sâd sûresi, 29. âyet'
  },
  {
    ar: 'أَفَلَا يَتَدَبَّرُونَ ٱلْقُرْءَانَ أَمْ عَلَىٰ قُلُوبٍ أَقْفَالُهَآ',
    tr: 'Onlar Kur\'an\'ı düşünmüyorlar mı? Yoksa kalplerin üzerinde kilitleri mi var?',
    kaynak: 'Muhammed sûresi, 24. âyet'
  },
  {
    ar: 'وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍۢ',
    tr: 'Andolsun biz, Kur\'an\'ı düşünüp öğüt almak için kolaylaştırdık. Var mı düşünüp öğüt alan?',
    kaynak: 'Kamer sûresi, 17. âyet'
  }
];

let hvAnlamIdx = Math.floor(Math.random() * HV_ANLAM_AYETLERI.length);

function hvAnlamKart() {
  const a = HV_ANLAM_AYETLERI[hvAnlamIdx];
  return `
    <div class="anlam-kart" onclick="hvAnlamSonraki()">
      <div class="anlam-ust">📖 Kur'an niçin indirildi?</div>
      <div class="anlam-ar">${a.ar}</div>
      <div class="anlam-tr">${a.tr}</div>
      <div class="anlam-kaynak">— ${a.kaynak} <span class="anlam-ipucu">• dokun, sonraki âyet</span></div>
    </div>`;
}
window.hvAnlamKart = hvAnlamKart;

function hvAnlamSonraki() {
  hvAnlamIdx = (hvAnlamIdx + 1) % HV_ANLAM_AYETLERI.length;
  document.querySelectorAll('.anlam-kart').forEach(el => {
    const yeni = document.createElement('div');
    yeni.innerHTML = hvAnlamKart();
    el.replaceWith(yeni.firstElementChild);
  });
}
window.hvAnlamSonraki = hvAnlamSonraki;

/* ═══════════════════════════════════════════════════════════════════════
   v61.4 — TAM EKRAN OKUMA MODU
   Sadece mushaf sayfası. Üstte sayfa no ve yer imi, altta ses çubuğu.
   Ortaya dokununca çubuklar gizlenir; parmakla sayfa çevrilir.
   ═══════════════════════════════════════════════════════════════════════ */

let hvTeAcik = false, hvTeKilit = null, hvTeCubuk = true;

async function hvTamEkranAc() {
  if (hvTeAcik) return;
  hvTeAcik = true;
  let k = document.getElementById('mv-full');
  if (!k) {
    k = document.createElement('div');
    k.id = 'mv-full';
    k.className = 'te-kok';
    document.body.appendChild(k);
  }
  k.style.display = 'flex';
  document.body.classList.add('te-modda');
  hvTeCubuk = true;
  await hvTamEkranCiz();
  hvTeKaydirmaBagla();
  hvTeEkraniAcikTut();
}
window.hvTamEkranAc = hvTamEkranAc;

function hvTamEkranKapat() {
  hvTeAcik = false;
  const k = document.getElementById('mv-full');
  if (k) k.style.display = 'none';
  document.body.classList.remove('te-modda');
  try { if (hvTeKilit) { hvTeKilit.release(); hvTeKilit = null; } } catch (e) {}
  renderMushaf();
}
window.hvTamEkranKapat = hvTamEkranKapat;

// Okurken ekran sönmesin
async function hvTeEkraniAcikTut() {
  try {
    if ('wakeLock' in navigator && !hvTeKilit) hvTeKilit = await navigator.wakeLock.request('screen');
  } catch (e) {}
}

function hvTeCubukDegistir() {
  hvTeCubuk = !hvTeCubuk;
  const k = document.getElementById('mv-full');
  if (k) k.classList.toggle('cubuksuz', !hvTeCubuk);
}
window.hvTeCubukDegistir = hvTeCubukDegistir;

function hvTeKagit() {
  const y = hvGet('hv_te_kagit', '1') === '1' ? '0' : '1';
  hvSet('hv_te_kagit', y);
  hvTamEkranCiz();
}
window.hvTeKagit = hvTeKagit;

function hvTeGit(p) {
  p = Math.max(1, Math.min(HV_MUSHAF_SON, parseInt(p, 10) || 1));
  hvSet('hv_mushaf_page', p);
  hvTamEkranCiz();
}
window.hvTeGit = hvTeGit;

function hvTeKaydirmaBagla() {
  hvSayfaKaydirmaBagla(document.getElementById('mv-full'), hvTeGit);
}

function hvTeMod(m) { hvSet('hv_mushaf_mode', m); hvTamEkranCiz(); }
window.hvTeMod = hvTeMod;

async function hvTamEkranCiz(calmayaDevam) {
  const k = document.getElementById('mv-full');
  if (!k) return;
  const sayfa  = parseInt(hvGet('hv_mushaf_page', '1'), 10);
  const font   = parseInt(hvGet('hv_mushaf_font', '30'), 10);
  const kagit  = hvGet('hv_te_kagit', '1') === '1';
  const mod    = hvGet('hv_mushaf_mode', 'ar');
  const imli   = hvMushafImler().indexOf(sayfa) >= 0;
  const trFont = Math.max(15, Math.min(26, Math.round(font * 0.6)));

  k.classList.toggle('kagit', kagit);
  k.classList.toggle('cubuksuz', !hvTeCubuk);
  k.innerHTML = `
    <div class="te-ust">
      <button class="te-yuvarlak" onclick="hvTamEkranKapat()">✕</button>
      <div class="te-sayfa-no">${sayfa}</div>
      <button class="te-yuvarlak" onclick="hvMushafImDegistir(); hvTamEkranCiz();">${imli ? '⭐' : '☆'}</button>
    </div>

    <div class="te-mod">
      <button class="${mod === 'ar' ? 'on' : ''}" onclick="hvTeMod('ar')">Arapça</button>
      <button class="${mod === 'both' ? 'on' : ''}" onclick="hvTeMod('both')">Arapça + Meal</button>
      <button class="${mod === 'tr' ? 'on' : ''}" onclick="hvTeMod('tr')">Meal</button>
    </div>

    <div class="te-orta" onclick="hvTeCubukDegistir()">
      <div class="te-cerceve">
        <div class="te-baslik" id="te-sure-serit">Sayfa ${sayfa}</div>
        <div id="te-metin" class="te-metin" style="font-size:${font}px${mod === 'tr' ? ';display:none' : ''}">
          <div class="mv-loading">Sayfa yükleniyor…</div>
        </div>
        <div id="te-meal" class="te-meal${mod === 'both' ? ' ayrac' : ''}"
             style="font-size:${trFont}px${mod === 'ar' ? ';display:none' : ''}">
          ${mod === 'ar' ? '' : '<div class="mv-loading">Meal yükleniyor…</div>'}
        </div>
        <div class="te-alt-no">${hvArNum(sayfa)}</div>
      </div>
    </div>

    <div class="te-sure">
      <button class="te-mini" onclick="hvMvAtla(-1)">⏮</button>
      <span id="te-gecen">0:00</span><span class="te-sure-ayrac">/</span><span id="te-toplam">--:--</span>
      <button class="te-mini" onclick="hvMvAtla(1)">⏭</button>
    </div>

    <div class="te-alt">
      <button class="te-yan" onclick="hvTeGit(${sayfa - 1})" ${sayfa <= 1 ? 'disabled' : ''}>‹</button>
      <button class="te-kucuk" onclick="hvMushafPunto(-2); hvTamEkranCiz();">A−</button>
      <button id="te-play" class="te-play" onclick="hvMvBasDurdur()">${hvMvCalisiyor ? '⏸' : '▶️'}</button>
      <button class="te-kucuk" onclick="hvMushafPunto(2); hvTamEkranCiz();">A+</button>
      <button class="te-kucuk" onclick="hvTeKagit()">${kagit ? '🌙' : '📄'}</button>
      <button class="te-yan" onclick="hvTeGit(${sayfa + 1})" ${sayfa >= HV_MUSHAF_SON ? 'disabled' : ''}>›</button>
    </div>
  `;

  let rows;
  try {
    rows = await hvMushafSayfaGetir(sayfa);
  } catch (e) {
    const m = document.getElementById('te-metin');
    const t = document.getElementById('te-meal');
    const hata = `<div class="mv-error">Sayfa yüklenemedi.<button class="gold-outline-btn" onclick="hvTamEkranCiz()">↻ Tekrar Dene</button></div>`;
    if (m) m.innerHTML = hata;
    if (t) t.innerHTML = '';
    return;
  }

  hvMvSira = rows.map(r => r.n);
  hvMvRef = {}; rows.forEach(r => { hvMvRef[r.n] = [r.s, r.v]; });
  hvMvKonum = -1;

  const sureler = rows.map(r => r.s).filter((x, i, a) => a.indexOf(x) === i);
  const bas = document.getElementById('te-sure-serit');
  if (bas) bas.textContent = hvSureAdi(sureler[0]);
  try { hvSureSeritBagla(document.querySelector('#mv-full .te-orta')); } catch (e) {}

  // ── Arapça ──
  let html = '';
  let sonSure = null;
  rows.forEach(r => {
    if (r.s !== sonSure) { sonSure = r.s; if (r.v === 1) html += `<div class="mv-sure-basi">${r.sar}</div>`; }
    let metin = r.ar;
    if (r.v === 1 && r.s !== 1 && r.s !== 9) {
      const b = hvBesmeleAyir(metin);
      if (b.besmele) { html += `<div class="mv-besmele">${b.besmele}</div>`; metin = b.kalan; }
    }
    html += `<span class="mv-ayah" id="mv-a-${r.n}">${metin}<span class="mv-num">${hvArNum(r.v)}</span></span> `;
  });
  const m = document.getElementById('te-metin');
  if (m) m.innerHTML = html;
  if (calmayaDevam) { hvMvCalisiyor = true; hvMvCal(0); }

  // ── Meal ──
  if (mod !== 'ar') {
    let trHtml = '';
    let sonSure2 = null;
    rows.forEach((r, i) => {
      if (r.s !== sonSure2) { sonSure2 = r.s; trHtml += `<div class="te-m-sure">${hvSureAdi(r.s)}</div>`; }
      if (i > 0 && r.tr && rows[i - 1].tr === r.tr && !hvMealGrupIlk(r.s, r.v)) return;
      trHtml += `<div class="te-m-ayet" id="te-m-${r.n}"><span class="te-m-no">${hvMealEtiket(r.s, r.v)}</span>${r.tr || '—'}</div>`;
    });
    const t = document.getElementById('te-meal');
    if (t) t.innerHTML = trHtml;
  }
}
window.hvTamEkranCiz = hvTamEkranCiz;

/* ══════════════════════════════════════════════════════════════
   0'DAN DUA ÖĞREN — sayfa sayfa, satır satır Arapça + okunuş
   Bölümler: Namaz Duaları · Namaz Sureleri · Kur'an'daki Dualar
   Kaydırma (sağ/sol), A+/A-, hoca sesi, kaldığın yer, ✓ öğrendim
   ══════════════════════════════════════════════════════════════ */
const HV_SD_BOLUM = { dua: 'Namaz Duaları', sure: 'Namaz Sureleri', kdua: "Kur'an'daki Dualar" };
const HV_SD_BOLUM_IKON = { dua: '🤲', sure: '📖', kdua: '✨' };
let hvSdSayfalar = null, hvSdIdx = 0, hvSdListeAcik = false;
let hvSdSesSira = 0, hvSdCaliyor = false;   // v66.4: ses nesnesi ortak çalarda (hvOgSes)
let hvSdDokunX = null, hvSdDokunY = null;

function hvSdPunto() { const v = parseFloat(hvGet('hv_sd_punto', '1')); return isNaN(v) ? 1 : v; }
function hvSdPuntoAyarla(fark) {
  let v = Math.round((hvSdPunto() + fark) * 10) / 10;
  v = Math.max(0.7, Math.min(1.8, v));
  hvSet('hv_sd_punto', v);
  hvSdPuntoUygula();
}
window.hvSdPuntoAyarla = hvSdPuntoAyarla;
function hvSdPuntoUygula() {
  const kok = document.getElementById('sifirdan-root');
  if (kok) kok.style.setProperty('--sd-olcek', String(hvSdPunto()));
  const et = document.getElementById('sd-punto-deger');
  if (et) et.textContent = Math.round(hvSdPunto() * 100) + '%';
}

/* Öğrendim işaretleri (Ezber'den ayrı tutulur) */
function hvSdOgrenilenler() {
  try { return JSON.parse(localStorage.getItem('hv_sd_ogrenildi') || '[]'); } catch (e) { return []; }
}
function hvSdOgrenildiMi(a) { return hvSdOgrenilenler().indexOf(a) >= 0; }
function hvSdOgrendimDegistir() {
  const s = hvSdSayfalar && hvSdSayfalar[hvSdIdx];
  if (!s) return;
  let l = hvSdOgrenilenler();
  l = l.indexOf(s.anahtar) >= 0 ? l.filter(x => x !== s.anahtar) : l.concat([s.anahtar]);
  try { localStorage.setItem('hv_sd_ogrenildi', JSON.stringify(l)); } catch (e) {}
  hvSdOgrendimDugme();
}
window.hvSdOgrendimDegistir = hvSdOgrendimDegistir;
function hvSdOgrendimDugme() {
  const s = hvSdSayfalar && hvSdSayfalar[hvSdIdx];
  const b = document.getElementById('sd-ogrendim');
  if (!b || !s) return;
  const on = hvSdOgrenildiMi(s.anahtar);
  b.classList.toggle('on', on);
  b.innerHTML = on ? '✓ Öğrendim' : '○ Öğrendim';
}

/* ── Hece hece (yeni öğrenenler için) ──
   Okunuş Türkçe imlâyla yazıldığı için Türkçe heceleme kuralı uygulanır:
   her hecede bir ünlü; iki ünlü arasındaki tek ünsüz sonraki heceye,
   iki ünsüzden ilki önceki heceye gider. Kesme (') ve tire korunur. */
const HV_HECE_UNLU = 'aeıioöuüâêîôûAEIİOÖUÜÂÊÎÔÛ';
function hvHeceUnluMu(c) { return HV_HECE_UNLU.indexOf(c) >= 0; }
function hvHeceKelime(k) {
  const harf = k.split('');
  const heceler = []; let bas = 0;
  const unluIdx = [];
  harf.forEach((c, i) => { if (hvHeceUnluMu(c)) unluIdx.push(i); });
  if (unluIdx.length <= 1) return [k];
  for (let u = 0; u < unluIdx.length - 1; u++) {
    const a = unluIdx[u], b = unluIdx[u + 1];
    // a ile b arasındaki ünsüz sayısı (kesme işareti ünsüz sayılmaz, önceki heceye yapışır)
    let arasi = [];
    for (let i = a + 1; i < b; i++) if (harf[i] !== "'" && harf[i] !== '\u2019') arasi.push(i);
    let kes;
    if (arasi.length === 0) kes = b;                 // iki ünlü yan yana: ünlüden önce
    else if (arasi.length === 1) kes = arasi[0];      // tek ünsüz sonraki heceye
    else kes = arasi[arasi.length - 1];               // son ünsüz sonraki heceye
    heceler.push(k.slice(bas, kes)); bas = kes;
  }
  heceler.push(k.slice(bas));
  return heceler.filter(Boolean);
}
function hvHeceBol(metin) {
  // tire ile bağlı parçalar (fid-dünyâ) ayrı kelime gibi hecelenir
  return String(metin || '').split(/(\s+|-)/).map(par => {
    if (!par || /^\s+$/.test(par) || par === '-') return par;
    return hvHeceKelime(par).join('\u00b7');
  }).join('');
}
function hvHeceHtml(metin) {
  const parcalar = hvHeceBol(metin).split(/(\s+)/);
  return parcalar.map(p => {
    if (/^\s+$/.test(p)) return p;
    return p.split('\u00b7').map(h => '<span class="sd-hece">' + hvSdEsc(h) + '</span>').join('<span class="sd-hece-ayrac">-</span>');
  }).join('');
}
function hvSdHeceMi() { return hvGet('hv_sd_hece', '0') === '1'; }
function hvSdHeceDegistir() {
  hvSet('hv_sd_hece', hvSdHeceMi() ? '0' : '1');
  hvSdSayfaCiz();
}
window.hvSdHeceDegistir = hvSdHeceDegistir;

/* Cümle bölücü (lookbehind kullanmadan — eski Safari uyumu) */
function hvSdCumleler(metin) {
  const m = String(metin || '').match(/[^.!?]+[.!?]*/g) || [];
  return m.map(s => s.trim()).filter(Boolean);
}

/* Tüm sayfaların listesi */
function hvSdListeKur() {
  const L = [];
  const besmeleAr = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', besmeleOk = 'Bismillâhir-rahmânir-rahîm';

  (typeof SIFIRDAN_NAMAZ_DUALARI !== 'undefined' ? SIFIRDAN_NAMAZ_DUALARI : []).forEach(d => {
    L.push({
      tur: 'dua', ad: d.ad, alt: d.alt || '', anahtar: 'sd_dua_' + d.ad,
      satirlar: d.satirlar.map(s => ({ ar: s.ar, ok: s.ok, not: s.not || '', seg: (typeof s.seg === 'number' ? s.seg : 0) })),
      // v66.4: ses adresi yerine {sûre, âyet} — seçili Öğren hocasına göre çözülür
      sesRef: (d.ses || []).map(x => ({ s: x.s, a: x.a })), ses: []
    });
  });

  (typeof KISA_SURELER !== 'undefined' ? KISA_SURELER : []).forEach(k => {
    const no = (typeof HV_SURE_NO !== 'undefined' && HV_SURE_NO[k.title]) || 0;
    const ar = String(k.arabic || '').split('۝').map(s => s.trim()).filter(Boolean);
    const duzelt = (typeof SIFIRDAN_SURE_OKUNUS !== 'undefined') ? SIFIRDAN_SURE_OKUNUS[k.title] : null;
    const ok = duzelt || hvSdCumleler(k.okunusu);
    const satirlar = [];
    if (no !== 1) satirlar.push({ ar: besmeleAr, ok: besmeleOk, ref: no ? { s: no, a: 0 } : null, besmele: true });
    ar.forEach((a, i) => satirlar.push({ ar: a, ok: ok[i] || '', ref: no ? { s: no, a: i + 1 } : null, no: i + 1 }));
    L.push({
      tur: 'sure', ad: k.title, alt: (no ? no + '. sûre · ' : '') + ar.length + ' âyet',
      anahtar: 'sd_sure_' + k.title, satirlar: satirlar,
      sesRef: satirlar.map(s => s.ref).filter(Boolean), ses: []
    });
  });

  (typeof SIFIRDAN_KURAN_DUALARI !== 'undefined' ? SIFIRDAN_KURAN_DUALARI : []).forEach(d => {
    L.push({ tur: 'kdua', ad: d.ad, alt: d.alt || '', anahtar: 'sd_kdua_' + d.s + '_' + d.b, ref: d, satirlar: null, sesRef: [], ses: [] });
  });
  return L;
}

function hvSdBasaSar() {
  const kok = document.getElementById('sifirdan-root');
  const kap = kok ? hvMvKaydirilabilir(kok) : null;
  try {
    if (kap) kap.scrollTo({ top: 0, behavior: 'auto' }); else window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (e) { if (kap) kap.scrollTop = 0; else window.scrollTo(0, 0); }
}

/* ── Giriş noktası ── */
function renderSifirdan() {
  const kok = document.getElementById('sifirdan-root');
  if (!kok) return;
  if (!hvSdSayfalar) hvSdSayfalar = hvSdListeKur();
  if (!hvSdSayfalar.length) { kok.innerHTML = '<div class="mv-loading">İçerik bulunamadı.</div>'; return; }
  let son = parseInt(hvGet('hv_sd_son', '0'), 10);
  if (isNaN(son) || son < 0 || son >= hvSdSayfalar.length) son = 0;
  hvSdIdx = son;
  hvSdListeAcik = false;
  hvSdSayfaCiz();
}
window.renderSifirdan = renderSifirdan;

function hvSdGit(i) {
  if (!hvSdSayfalar) return;
  if (i < 0) i = 0;
  if (i >= hvSdSayfalar.length) i = hvSdSayfalar.length - 1;
  hvSdSesDurdur();
  hvSdIdx = i;
  hvSet('hv_sd_son', i);
  hvSdListeAcik = false;
  hvSdSayfaCiz();
}
window.hvSdGit = hvSdGit;
function hvSdIleri() { if (hvSdSayfalar && hvSdIdx < hvSdSayfalar.length - 1) hvSdGit(hvSdIdx + 1); }
function hvSdGeri() { if (hvSdIdx > 0) hvSdGit(hvSdIdx - 1); }
window.hvSdIleri = hvSdIleri; window.hvSdGeri = hvSdGeri;

function hvSdBolumeGit(tur) {
  const i = hvSdSayfalar.findIndex(s => s.tur === tur);
  if (i >= 0) hvSdGit(i);
}
window.hvSdBolumeGit = hvSdBolumeGit;

function hvSdEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Sayfa çizimi ── */
function hvSdSayfaCiz() {
  const kok = document.getElementById('sifirdan-root');
  if (!kok || !hvSdSayfalar) return;
  if (hvSdCaliyor) hvSdSesDurdur();   // v66.4: sayfa yeniden çizilirken ses yarım kalmasın
  const s = hvSdSayfalar[hvSdIdx];
  const toplam = hvSdSayfalar.length;
  const bolumSayi = { dua: 0, sure: 0, kdua: 0 };
  hvSdSayfalar.forEach(x => { bolumSayi[x.tur] = (bolumSayi[x.tur] || 0) + 1; });

  const chips = Object.keys(HV_SD_BOLUM).map(t =>
    `<button class="sd-chip${s.tur === t ? ' on' : ''}" onclick="hvSdBolumeGit('${t}')">${HV_SD_BOLUM_IKON[t]} ${HV_SD_BOLUM[t]} <span>${bolumSayi[t] || 0}</span></button>`
  ).join('');

  const sesVar = s.tur === 'kdua' ? true : (s.sesRef && s.sesRef.length > 0);

  kok.innerHTML = `
    <div class="sd-ust">
      <button class="hub-back-btn" onclick="hvGeri(\'kurandua\')">← Kuran &amp; Dua</button>
      <button class="sd-liste-btn" onclick="hvSdListeGoster()">☰ Liste</button>
      <div class="share-type-switch ogren-mod"><button class="seg-btn active">📖 Oku</button><button class="seg-btn" onclick="navigateTo('ezber')">🧠 Ezberle</button></div>
      <div class="sd-sayac">${hvSdIdx + 1} / ${toplam}</div>
    </div>
    <div class="sd-chips">${chips}</div>
    <div class="sd-kart" id="sd-kart">
      <div class="sd-baslik">
        <div class="sd-ad">${hvSdEsc(s.ad)}</div>
        ${s.alt ? `<div class="sd-alt-yazi">${hvSdEsc(s.alt)}</div>` : ''}
      </div>
      <div class="sd-satirlar" id="sd-satirlar">${s.satirlar ? hvSdSatirlarHtml(s) : '<div class="mv-loading">Âyetler yükleniyor…</div>'}</div>
      <div class="sd-ipucu">◀ Sağa-sola kaydırarak sayfa değiştir ▶</div>
    </div>
    <div class="sd-arac">
      <button class="sd-punto-btn" onclick="hvSdPuntoAyarla(-0.1)" aria-label="Yazıyı küçült">A−</button>
      <span class="sd-punto-deger" id="sd-punto-deger">${Math.round(hvSdPunto() * 100)}%</span>
      <button class="sd-punto-btn" onclick="hvSdPuntoAyarla(0.1)" aria-label="Yazıyı büyüt">A+</button>
      ${sesVar ? `<button class="sd-ses-btn" id="sd-ses" onclick="hvSdSesCal()">🔊 Dinle</button>` : ''}
      <button class="sd-hece-btn${hvSdHeceMi() ? ' on' : ''}" onclick="hvSdHeceDegistir()" title="Yeni öğrenenler için hece hece">${hvSdHeceMi() ? '✓ ' : ''}Hece hece</button>
      <button id="sd-ogrendim" class="ez-ogrendim" onclick="hvSdOgrendimDegistir()">○ Öğrendim</button>
    </div>
    ${sesVar ? `<div class="sd-hoca-satir">${hvOgrenQariSecim('hvSdHocaDegistir')}</div><div id="sd-yedek-not"></div>` : ''}
    <div class="sd-gecis">
      <button class="sd-gecis-btn" onclick="hvSdGeri()" ${hvSdIdx === 0 ? 'disabled' : ''}>◀ Önceki</button>
      <button class="sd-gecis-btn" onclick="hvSdIleri()" ${hvSdIdx === toplam - 1 ? 'disabled' : ''}>Sonraki ▶</button>
    </div>
  `;
  hvSdPuntoUygula();
  hvSdOgrendimDugme();
  hvSdKaydirmaBagla();
  hvSdBasaSar();

  if (!s.satirlar && s.tur === 'kdua') hvSdKuranDuasiYukle(s);
  else if (sesVar) hvSdSesHazirla(s);
}

/* Kuran Oku'daki gibi: Arapça kelimelere ayrılır, ses ilerledikçe kelime kelime dolar */
function hvSdKelimele(metin) {
  return String(metin || '').trim().split(/\s+/).filter(Boolean)
    .map(k => '<span class="sd-w">' + hvSdEsc(k) + '</span>').join(' ');
}

function hvSdSatirlarHtml(s) {
  return s.satirlar.map((r, i) => {
    let etiket = '';
    if (r.besmele) etiket = '';
    else if (s.tur === 'sure' && r.no) etiket = `<span class="sd-no">${r.no}</span>`;
    else if (s.tur === 'kdua' && r.no) etiket = `<span class="sd-no">${r.no}</span>`;
    return `<div class="sd-satir${r.besmele ? ' sd-besmele' : ''}" data-i="${i}">
      <div class="sd-ar" dir="rtl" lang="ar">${hvSdKelimele(r.ar)}</div>
      <div class="sd-ok-satir">${etiket}<span class="sd-ok">${hvSdHeceMi() ? hvHeceHtml(r.ok) : hvSdEsc(r.ok)}</span></div>
      ${r.not ? `<div class="sd-not">${hvSdEsc(r.not)}</div>` : ''}
    </div>`;
  }).join('');
}

/* Kur'an duaları: âyetler servisten, sonra cihazda saklanır */
async function hvSdKuranDuasiYukle(s) {
  const kap = document.getElementById('sd-satirlar');
  const d = s.ref;
  const anahtar = 'hv_sd_kd_' + d.s + '_' + d.b + '_' + d.e;
  let satirlar = null;
  try {
    const c = JSON.parse(localStorage.getItem(anahtar) || 'null');
    if (Array.isArray(c) && c.length) satirlar = c;
  } catch (e) {}
  if (!satirlar) {
    try {
      const out = await hvEzAyetleriGetir(d.s, d.b, d.e);
      if (!out || !out.length) throw new Error('boş');
      satirlar = out.map((x, i) => ({ ar: x.ar, ok: x.ok, no: d.b + i }));
      try { localStorage.setItem(anahtar, JSON.stringify(satirlar)); } catch (e) {}
    } catch (e) {
      if (kap && hvSdSayfalar[hvSdIdx] === s) {
        kap.innerHTML = `<div class="sd-hata">Âyetler alınamadı. İnternet bağlantını kontrol edip tekrar dene.<br>
          <button class="gold-outline-btn" onclick="hvSdGit(${hvSdIdx})">↻ Tekrar Dene</button></div>`;
      }
      return;
    }
  }
  s.satirlar = satirlar.map(r => ({ ar: r.ar, ok: r.ok, no: r.no, ref: { s: d.s, a: r.no } }));
  s.sesRef = s.satirlar.map(r => r.ref);
  s.ses = []; s.sesQari = null;
  if (kap && hvSdSayfalar[hvSdIdx] === s) {
    kap.innerHTML = hvSdSatirlarHtml(s);
    hvSdSesHazirla(s);
  }
}

/* ── Liste görünümü ── */
function hvSdListeGoster() {
  const kok = document.getElementById('sifirdan-root');
  if (!kok || !hvSdSayfalar) return;
  hvSdSesDurdur();
  hvSdListeAcik = true;
  const ogr = hvSdOgrenilenler();
  let html = `
    <div class="sd-ust">
      <button class="hub-back-btn" onclick="hvGeri(\'kurandua\')">← Kuran &amp; Dua</button>
      <button class="sd-liste-btn on" onclick="hvSdGit(${hvSdIdx})">📄 Sayfaya Dön</button>
      <div class="sd-sayac">${ogr.length} / ${hvSdSayfalar.length} ✓</div>
    </div>`;
  Object.keys(HV_SD_BOLUM).forEach(t => {
    const grup = hvSdSayfalar.map((s, i) => ({ s, i })).filter(x => x.s.tur === t);
    if (!grup.length) return;
    html += `<div class="sd-liste-baslik">${HV_SD_BOLUM_IKON[t]} ${HV_SD_BOLUM[t]} <span>${grup.length}</span></div><div class="sd-liste">`;
    grup.forEach(x => {
      const on = ogr.indexOf(x.s.anahtar) >= 0;
      html += `<button class="sd-liste-oge${on ? ' ogrenildi' : ''}${x.i === hvSdIdx ? ' simdiki' : ''}" onclick="hvSdGit(${x.i})">
        <span class="sd-liste-no">${x.i + 1}</span>
        <span class="sd-liste-metin"><b>${hvSdEsc(x.s.ad)}</b>${x.s.alt ? `<small>${hvSdEsc(x.s.alt)}</small>` : ''}</span>
        <span class="sd-liste-tik">${on ? '✓' : ''}</span>
      </button>`;
    });
    html += '</div>';
  });
  kok.innerHTML = html;
  hvSdBasaSar();
}
window.hvSdListeGoster = hvSdListeGoster;

/* ── Kaydırma (sağ/sol) ── */
function hvSdKaydirmaBagla() {
  const k = document.getElementById('sd-kart');
  if (!k) return;
  k.addEventListener('touchstart', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    hvSdDokunX = t.clientX; hvSdDokunY = t.clientY;
  }, { passive: true });
  k.addEventListener('touchend', e => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || hvSdDokunX === null) return;
    const dx = t.clientX - hvSdDokunX, dy = t.clientY - hvSdDokunY;
    hvSdDokunX = hvSdDokunY = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.8) return;
    if (dx < 0) hvSdIleri(); else hvSdGeri();
  }, { passive: true });
}
document.addEventListener('keydown', e => {
  const sayfa = document.getElementById('page-sifirdan');
  if (!sayfa || !sayfa.classList.contains('active') || hvSdListeAcik) return;
  if (e.key === 'ArrowRight') hvSdIleri();
  else if (e.key === 'ArrowLeft') hvSdGeri();
});

/* ── Ses: sayfadaki âyetleri sırayla çalar, okunan satırı vurgular ──
   v66.4: ortak parça çalar (hvOgOynat) + seçili Öğren hocası. el-Fakih /
   el-Mûsâ'da bütün sayfa tek sûre dosyasından kesintisiz okunur. */
/* Sayfanın seslerini seçili hocaya göre hazırlar (el-Mûsâ'da zaman tablosu iner) */
async function hvSdSesHazirla(s) {
  if (!s || !s.sesRef || !s.sesRef.length) return;
  const q = hvOgrenQari();
  const dugme = () => document.getElementById('sd-ses');
  if (s.sesQari === q.id && s.ses && s.ses.length) { hvSdYedekNotuYaz(s); return; }
  const b0 = dugme();
  if (b0 && hvSdSayfalar[hvSdIdx] === s) { b0.disabled = true; b0.innerHTML = '⏳'; }
  let sesler = [];
  try { sesler = await hvOgrenSesCoz(s.sesRef, q); } catch (e) { sesler = []; }
  s.ses = sesler; s.sesQari = q.id;
  if (hvSdSayfalar[hvSdIdx] !== s) return;
  const b = dugme();
  if (b && !hvSdCaliyor) { b.disabled = false; b.innerHTML = '🔊 Dinle'; }
  hvSdYedekNotuYaz(s);
}
function hvSdYedekNotuYaz(s) {
  const n = document.getElementById('sd-yedek-not');
  if (n) n.innerHTML = hvOgYedekNotu(s.ses);
}
async function hvSdHocaDegistir(id) {
  hvSet('hv_ogren_qari', id);
  try { const a = document.getElementById('settings-ogren-qari-select'); if (a) a.value = id; } catch (e) {}
  hvSdSesDurdur();
  (hvSdSayfalar || []).forEach(x => { x.sesQari = null; x.ses = []; });
  const s = hvSdSayfalar && hvSdSayfalar[hvSdIdx];
  if (s) await hvSdSesHazirla(s);
}
window.hvSdHocaDegistir = hvSdHocaDegistir;

/* k. ses parçasına ait satırlar (dua sayfasında 'seg' alanı, diğerlerinde sıra) */
function hvSdParcaSatirlari(sayfa, k) {
  if (!sayfa || !sayfa.satirlar) return [];
  if (sayfa.tur === 'dua') {
    const l = [];
    sayfa.satirlar.forEach((r, i) => { if (r.seg === k) l.push(i); });
    return l;
  }
  const l = [];
  let n = -1;
  sayfa.satirlar.forEach((r, i) => { if (r.ref) { n++; if (n === k) l.push(i); } });
  return l;
}
/* Ses ilerledikçe: okunan satır (sd-caliyor) + kelimeleri dolar (gecti) */
function hvSdSatirlariIsaretle(k, oran) {
  const sayfa = hvSdSayfalar && hvSdSayfalar[hvSdIdx];
  const idx = hvSdParcaSatirlari(sayfa, k);
  if (!idx.length) return;
  const kelimeler = [];
  idx.forEach(i => {
    const el = document.querySelector('.sd-satir[data-i="' + i + '"]');
    if (el) el.querySelectorAll('.sd-w').forEach(w => kelimeler.push({ w: w, i: i }));
  });
  if (!kelimeler.length) return;
  const n = Math.round(Math.max(0, Math.min(1, oran || 0)) * kelimeler.length);
  // önceki parçaların kelimeleri dolu kalsın, sonrakiler boş
  document.querySelectorAll('.sd-satir .sd-w.gecti').forEach(w => {
    const sat = w.closest('.sd-satir');
    const i = sat ? parseInt(sat.dataset.i, 10) : -1;
    if (idx.indexOf(i) < 0 && i > idx[idx.length - 1]) w.classList.remove('gecti');
  });
  kelimeler.forEach((x, m) => x.w.classList.toggle('gecti', m < n));
  const aktif = kelimeler[Math.max(0, Math.min(n, kelimeler.length) - 1)].i;
  const onceki = document.querySelector('.sd-satir.sd-caliyor');
  if (!onceki || onceki.dataset.i !== String(aktif)) {
    document.querySelectorAll('.sd-satir.sd-caliyor').forEach(e => e.classList.remove('sd-caliyor'));
    const el = document.querySelector('.sd-satir[data-i="' + aktif + '"]');
    if (el) {
      el.classList.add('sd-caliyor');
      try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
  }
}
function hvSdArayuzSifirla() {
  hvSdCaliyor = false;
  const b = document.getElementById('sd-ses');
  if (b) { b.innerHTML = '🔊 Dinle'; b.classList.remove('on'); b.disabled = false; }
  document.querySelectorAll('.sd-satir.sd-caliyor').forEach(el => el.classList.remove('sd-caliyor'));
  document.querySelectorAll('.sd-w.gecti').forEach(w => w.classList.remove('gecti'));
}
function hvSdSesCal() {
  const s = hvSdSayfalar && hvSdSayfalar[hvSdIdx];
  if (!s) return;
  if (hvSdCaliyor) { hvSdSesDurdur(); return; }
  const liste = (s.ses && s.ses.length) ? s.ses : [];
  if (!liste.length) { hvSdSesHazirla(s); return; }
  hvOgOynat(liste.map((x, k) => Object.assign({ i: k }, x)), {
    onBasla: () => {
      hvSdCaliyor = true;
      const b = document.getElementById('sd-ses');
      if (b) { b.innerHTML = '⏸ Durdur'; b.classList.add('on'); }
    },
    onSira: (k) => { hvSdSesSira = k; hvSdSatirlariIsaretle(k, 0); },
    onIlerle: (oran, k) => hvSdSatirlariIsaretle(k, oran),
    onBitti: hvSdArayuzSifirla,
    onDur: hvSdArayuzSifirla,
    onHata: () => { hvSdArayuzSifirla(); try { hvToast('🔇 Ses açılamadı', 'İnternet bağlantını kontrol edip tekrar dene.'); } catch (e) {} }
  });
}
window.hvSdSesCal = hvSdSesCal;
function hvSdSesDurdur() {
  if (hvSdCaliyor) hvOgDurdur();
  hvSdArayuzSifirla();
}
window.hvSdSesDurdur = hvSdSesDurdur;
