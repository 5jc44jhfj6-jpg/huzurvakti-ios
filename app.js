/* ========================================================
   Namaz Vakti - Application Core Engine v2.5
   ======================================================== */

const APP_STATE = {
  currentPage: 'home',
  userLocation: { lat: 40.5233, lng: 28.8350 }, // Armutlu, Yalova
  currentCity: 'Yalova',
  currentDistrict: 'Armutlu',
  prayerTimes: null,
  isDarkTheme: true,
  fontSize: 20,
  qiblaAngle: 0,
  surahList: [],
  activePrayerId: null,
  notifyEnabled: false,
  notifyOffset: 0,
  notifySound: 'ezan',
  qari: 'afs'
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  loadSavedSettings();
  applyStateSettings();
  populateLocationsDropdown();
  setupNavTabs();
  setupSettingsListeners();
  startClockTimer();
  loadDailyVerse();
  initPrayerGuideSection();

  // Initial prayer times fetch
  fetchPrayerTimes(APP_STATE.userLocation.lat, APP_STATE.userLocation.lng);

  // Initialize Quran Surah list immediately with all 114 Surahs
  initQuranSection();

  // Dismiss Loading screen with smooth fade out
  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; }, 500);
    }

    // First time Notification Prompt
    if (!localStorage.getItem('namaz_vakti_v25_prompted')) {
      localStorage.setItem('namaz_vakti_v25_prompted', 'true');
      setTimeout(() => {
        const notifyModal = document.getElementById('notify-permission-modal');
        if (notifyModal) notifyModal.style.display = 'flex';
      }, 600); // Wait a bit after loader is hidden
    }
  }, 800);
}

// Navigation Tab Handler
function setupNavTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPage = tab.getAttribute('data-page');
      navigateTo(targetPage);
    });
  });
}

function navigateTo(pageId) {
  // Pause audio when leaving page
  const audioPlayer = document.getElementById('surah-audio-player');
  if (audioPlayer) {
    audioPlayer.pause();
  }

  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-page') === pageId);
  });

  document.querySelectorAll('.page-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const activeSec = document.getElementById('page-' + pageId);
  if (activeSec) {
    activeSec.classList.add('active');
  }

  APP_STATE.currentPage = pageId;

  if (pageId === 'qibla') {
    initQiblaCompass();
  }
}

// Local Storage & Settings
function loadSavedSettings() {
  try {
    const data = localStorage.getItem('namaz_vakti_v25');
    if (data) {
      const parsed = JSON.parse(data);
      Object.assign(APP_STATE, parsed);
    }
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

function saveSettings() {
  localStorage.setItem('namaz_vakti_v25', JSON.stringify({
    currentCity: APP_STATE.currentCity,
    currentDistrict: APP_STATE.currentDistrict,
    userLocation: APP_STATE.userLocation,
    qiblaAngle: APP_STATE.qiblaAngle,
    isDarkTheme: APP_STATE.isDarkTheme,
    notifyEnabled: APP_STATE.notifyEnabled,
    notifyOffset: APP_STATE.notifyOffset,
    notifySound: APP_STATE.notifySound,
    qari: APP_STATE.qari
  }));
}

function applyStateSettings() {
  document.body.classList.toggle('dark-theme', APP_STATE.isDarkTheme);
  document.body.classList.toggle('light-theme', !APP_STATE.isDarkTheme);

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.checked = APP_STATE.isDarkTheme;

  const fontSlider = document.getElementById('font-size-slider');
  if (fontSlider) fontSlider.value = APP_STATE.fontSize;

  document.documentElement.style.setProperty('--quran-font-size', APP_STATE.fontSize + 'px');
  const sizeVal = document.getElementById('font-size-val');
  if (sizeVal) sizeVal.textContent = APP_STATE.fontSize + 'px';

  const notifyToggle = document.getElementById('notify-toggle');
  if (notifyToggle) notifyToggle.checked = APP_STATE.notifyEnabled;

  const notifyTime = document.getElementById('notify-time');
  if (notifyTime) notifyTime.value = APP_STATE.notifyOffset;

  const notifySound = document.getElementById('notify-sound');
  if (notifySound) notifySound.value = APP_STATE.notifySound;

  const settingsQariSelect = document.getElementById('settings-qari-select');
  if (settingsQariSelect) settingsQariSelect.value = APP_STATE.qari;

  const surahQariSelect = document.getElementById('qari-select');
  if (surahQariSelect) surahQariSelect.value = APP_STATE.qari;

  updateLocationHeaderLabel();
}

function updateLocationHeaderLabel() {
  const label = APP_STATE.currentDistrict
    ? `${APP_STATE.currentCity}, ${APP_STATE.currentDistrict}`
    : APP_STATE.currentCity;
  const headerLoc = document.getElementById('header-location');
  if (headerLoc) headerLoc.textContent = label;
}

// Locations (Cities & Districts) Setup
function populateLocationsDropdown() {
  const citySelect = document.getElementById('city-select');
  if (!citySelect || typeof TURKEY_LOCATIONS === 'undefined') return;

  citySelect.innerHTML = '';
  const sorted = [...TURKEY_LOCATIONS].sort((a, b) => a.il.localeCompare(b.il, 'tr'));
  sorted.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.il;
    opt.textContent = loc.il;
    if (loc.il === APP_STATE.currentCity) opt.selected = true;
    citySelect.appendChild(opt);
  });

  populateDistrictOptions(APP_STATE.currentCity);
}

function populateDistrictOptions(cityName) {
  const districtSelect = document.getElementById('district-select');
  if (!districtSelect || typeof TURKEY_LOCATIONS === 'undefined') return;

  districtSelect.innerHTML = '';
  const prov = TURKEY_LOCATIONS.find(p => p.il === cityName);

  if (prov && prov.ilceler && prov.ilceler.length > 0) {
    prov.ilceler.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      if (d.name === APP_STATE.currentDistrict) opt.selected = true;
      districtSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = 'Merkez';
    opt.textContent = 'Merkez';
    districtSelect.appendChild(opt);
  }
}

function getSelectedCoordinates(cityName, districtName) {
  if (typeof TURKEY_LOCATIONS === 'undefined') return null;
  const prov = TURKEY_LOCATIONS.find(p => p.il === cityName);
  if (!prov) return null;

  if (districtName && prov.ilceler) {
    const dist = prov.ilceler.find(d => d.name === districtName);
    if (dist) return { lat: dist.lat, lng: dist.lng };
  }
  return { lat: prov.lat, lng: prov.lng };
}

// Live Clock & Hijri Date
function startClockTimer() {
  updateClockDisplay();
  setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
  const now = new Date();
  const clockText = document.getElementById('clock-display');
  if (clockText) {
    clockText.textContent = now.toLocaleTimeString('tr-TR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  const dateText = document.getElementById('date-display');
  if (dateText) {
    const gregDate = now.toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });
    dateText.textContent = gregDate;
  }

  if (APP_STATE.prayerTimes) {
    updatePrayerCountdown();
  }
}

const HIJRI_MONTHS_TR = {
  "Muharram": "Muharrem",
  "Safar": "Safer",
  "Rabi' al-awwal": "Rebiülevvel",
  "Rabīʿ al-awwal": "Rebiülevvel",
  "Rabi' al-thani": "Rebiülahir",
  "Rabīʿ al-thānī": "Rebiülahir",
  "Jumada al-awwal": "Cemaziyelevvel",
  "Jumādā al-ūlā": "Cemaziyelevvel",
  "Jumada al-thani": "Cemaziyelahir",
  "Jumādā al-ākhirah": "Cemaziyelahir",
  "Rajab": "Recep",
  "Sha'ban": "Şaban",
  "Shaʿbān": "Şaban",
  "Ramadan": "Ramazan",
  "Ramadān": "Ramazan",
  "Shawwal": "Şevval",
  "Shawwāl": "Şevval",
  "Dhu al-Qadah": "Zilkade",
  "Dhū al-Qaʿdah": "Zilkade",
  "Dhu al-Hijjah": "Zilhicce",
  "Dhū al-Ḥijjah": "Zilhicce"
};

// Diyanet resmi sitesiyle birebir eşleştirme (API 1 dk geride kalıyor)
function addMinutes(timeStr, minsToAdd) {
  if (!timeStr) return timeStr;
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10) + minsToAdd;
  if (m >= 60) { h = (h + Math.floor(m / 60)) % 24; m = m % 60; }
  else if (m < 0) { h = (h - 1 + 24) % 24; m = (m + 60) % 60; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Prayer Times API & Calculation
async function fetchPrayerTimes(lat, lng) {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const apiUrl = `https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lng}&method=13`;
    const response = await fetch(apiUrl);
    const json = await response.json();

    if (json && json.data) {
      const t = json.data.timings;
      // Diyanet resmi sitesiyle birebir eşleştirme — Akşam ve Yatsı +1 dk
      t.Maghrib = addMinutes(t.Maghrib, 1); // 20:15 → 20:16
      t.Isha    = addMinutes(t.Isha,    1); // 21:46 → 21:47
      APP_STATE.prayerTimes = t;
      APP_STATE.hijriDateText = null;
      renderPrayerCards(t);
      updatePrayerCountdown();
    }
  } catch (err) {
    console.warn('Prayer times API failed, using fallback:', err);
    renderFallbackPrayerTimes();
  }
}

function updateHijriBadgeUI(day, month, year) {
  const dayEl = document.getElementById('hijri-day-num');
  const monthEl = document.getElementById('hijri-month-name');
  const yearEl = document.getElementById('hijri-year-num');

  if (dayEl) dayEl.textContent = day || "25";
  if (monthEl) monthEl.textContent = month || "Safer";
  if (yearEl) yearEl.textContent = year || "1448";
}

function renderPrayerCards(timings) {
  const container = document.getElementById('prayer-times-container');
  if (!container) return;

  container.innerHTML = '';
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  order.forEach(id => {
    const info = PRAYER_NAMES[id];
    const timeVal = timings[id];
    if (!info || !timeVal) return;

    const card = document.createElement('div');
    card.className = 'prayer-card';
    card.id = `prayer-card-${id}`;
    card.onclick = () => showPrayerTimeDetailsModal(id, info.name, timeVal);
    card.innerHTML = `
      <div class="prayer-card-icon-wrap">
        ${info.icon}
      </div>
      <div class="prayer-card-info-wrap">
        <span class="prayer-name">${info.name}</span>
        <span class="prayer-time">${timeVal}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Show remaining/elapsed time modal when clicking a prayer card
function showPrayerTimeDetailsModal(prayerId, prayerName, timeStr) {
  const now = new Date();
  const [hrs, mins] = timeStr.split(':').map(Number);
  
  const pDate = new Date();
  pDate.setHours(hrs, mins, 0, 0);

  const diffMs = pDate - now;
  const absDiff = Math.abs(diffMs);
  const h = Math.floor(absDiff / (1000 * 60 * 60));
  const m = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

  let msg = '';
  if (diffMs > 0) {
    msg = `${prayerName} vaktine ${h > 0 ? h + ' saat ' : ''}${m} dakika var.`;
  } else {
    msg = `${prayerName} vaktinin girmesinden ${h > 0 ? h + ' saat ' : ''}${m} dakika geçti.`;
  }

  showToastNotification(`🕌 ${prayerName} (${timeStr})`, msg);
}

function showToastNotification(title, message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast-box';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-desc">${message}</div>
  `;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

function renderFallbackPrayerTimes() {
  const mockTimings = { Fajr: "04:35", Sunrise: "06:12", Dhuhr: "13:18", Asr: "17:02", Maghrib: "20:15", Isha: "21:45" };
  APP_STATE.prayerTimes = mockTimings;

  APP_STATE.hijriDateText = "25 Safer 1448";
  updateHijriBadgeUI("25", "Safer", "1448");
  renderPrayerCards(mockTimings);
  updatePrayerCountdown();
}

function updatePrayerCountdown() {
  if (!APP_STATE.prayerTimes) return;

  const now = new Date();
  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let nextPrayer = null;
  let nextTimeDate = null;

  for (const id of order) {
    const timeStr = APP_STATE.prayerTimes[id];
    if (!timeStr) continue;

    const [hrs, mins] = timeStr.split(':').map(Number);
    const pDate = new Date();
    pDate.setHours(hrs, mins, 0, 0);

    if (pDate > now) {
      nextPrayer = { id, name: PRAYER_NAMES[id].name };
      nextTimeDate = pDate;
      break;
    }
  }

  if (!nextPrayer) {
    nextPrayer = { id: 'Fajr', name: PRAYER_NAMES['Fajr'].name };
    const [hrs, mins] = APP_STATE.prayerTimes['Fajr'].split(':').map(Number);
    nextTimeDate = new Date();
    nextTimeDate.setDate(nextTimeDate.getDate() + 1);
    nextTimeDate.setHours(hrs, mins, 0, 0);
  }

  const targetLabel = document.getElementById('countdown-target');
  if (targetLabel) targetLabel.textContent = `${nextPrayer.name} Vaktine Kalan`;

  const diffMs = nextTimeDate - now;
  const timerText = document.getElementById('countdown-timer');

  if (diffMs <= 0) {
    if (timerText) timerText.textContent = "00:00:00";
    return;
  }

  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (timerText) {
    timerText.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Handle Notifications
  checkPrayerNotification(nextPrayer, nextTimeDate, diffMs);

  const activeIdx = order.indexOf(nextPrayer.id) - 1;
  const currentActiveId = activeIdx >= 0 ? order[activeIdx] : order[order.length - 1];

  const circle = document.getElementById('countdown-progress');
  if (circle) {
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    let prevTimeDate = new Date();
    const prevTimeStr = APP_STATE.prayerTimes[currentActiveId];
    if (prevTimeStr) {
      const [pHrs, pMins] = prevTimeStr.split(':').map(Number);
      prevTimeDate.setHours(pHrs, pMins, 0, 0);
      if (currentActiveId === 'Isha' && nextPrayer.id === 'Fajr') {
        prevTimeDate.setDate(prevTimeDate.getDate() - 1);
      }
    } else {
      prevTimeDate.setTime(nextTimeDate.getTime() - 4 * 3600 * 1000);
    }
    
    const totalWindowMs = nextTimeDate - prevTimeDate;
    const progressRatio = Math.max(0, Math.min(1, diffMs / totalWindowMs));
    circle.style.strokeDashoffset = circumference * progressRatio;
  }

  document.querySelectorAll('.prayer-card').forEach(c => {
    c.classList.remove('active');
    const badge = c.querySelector('.active-check-icon');
    if (badge) badge.remove();
  });

  const activeCard = document.getElementById(`prayer-card-${currentActiveId}`);
  if (activeCard) {
    activeCard.classList.add('active');
  }
}

// Daily Verse
function loadDailyVerse() {
  if (typeof DAILY_VERSES !== 'undefined' && DAILY_VERSES.length) {
    const randomIndex = Math.floor(Math.random() * DAILY_VERSES.length);
    const v = DAILY_VERSES[randomIndex];

    const ar = document.getElementById('daily-verse-arabic');
    const tr = document.getElementById('daily-verse-turkish');
    const src = document.getElementById('daily-verse-source');

    if (ar) ar.textContent = v.arabic;
    if (tr) tr.textContent = `"${v.turkish}"`;
    if (src) src.textContent = `— ${v.surah} Suresi, ${v.ayah}. Ayet`;
  }
}


// Qibla Compass
function calculateQiblaBearing(lat, lng) {
  const kaabaLat = 21.4225 * Math.PI / 180;
  const kaabaLng = 39.8262 * Math.PI / 180;
  const userLat = lat * Math.PI / 180;
  const userLng = lng * Math.PI / 180;
  const dLng = kaabaLng - userLng;

  const y = Math.sin(dLng);
  const x = Math.cos(userLat) * Math.tan(kaabaLat) - Math.sin(userLat) * Math.cos(dLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}

function calculateGreatCircleDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

let smoothHeading = null;
let lastVibrateTime = 0;
let isDraggingCompass = false;
let startTouchAngle = 0;
let startHeadingAngle = 0;

function initQiblaCompass() {
  const { lat, lng } = APP_STATE.userLocation;
  APP_STATE.qiblaAngle = calculateQiblaBearing(lat, lng);
  const dist = calculateGreatCircleDistance(lat, lng, 21.4225, 39.8262);

  const degVal = document.getElementById('qibla-degree-val');
  const distVal = document.getElementById('kaaba-dist-val');
  const locVal = document.getElementById('qibla-user-loc');

  if (degVal) degVal.textContent = `${Math.round(APP_STATE.qiblaAngle)}° Güneydoğu`;
  if (distVal) distVal.textContent = `${dist.toLocaleString('tr-TR')} km`;
  if (locVal) locVal.textContent = `${APP_STATE.currentCity}, ${APP_STATE.currentDistrict} ➔ Mekke-i Mükerreme`;

  setupCompassTouchEvents();

  // If permission not granted yet, show prompt automatically
  const modal = document.getElementById('qibla-permission-modal');
  if (!localStorage.getItem('qibla_permission_granted')) {
    if (modal) modal.style.display = 'flex';
  } else {
    if (modal) modal.style.display = 'none';
    // Already granted in a previous session, try to start sensors
    startCompassSensors(true);
  }

  updateQiblaUI(0);
}

function requestQiblaPermissionFlow(event) {
  if (event) event.preventDefault();
  const modal = document.getElementById('qibla-permission-modal');
  if (modal) modal.style.display = 'flex';
}

function acceptQiblaPermissionFlow() {
  localStorage.setItem('qibla_permission_granted', 'true');
  closeQiblaPermissionModal();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        APP_STATE.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const degVal = document.getElementById('qibla-degree-val');
        const distVal = document.getElementById('kaaba-dist-val');
        APP_STATE.qiblaAngle = calculateQiblaBearing(pos.coords.latitude, pos.coords.longitude);
        const dist = calculateGreatCircleDistance(pos.coords.latitude, pos.coords.longitude, 21.4225, 39.8262);
        if (degVal) degVal.textContent = `${Math.round(APP_STATE.qiblaAngle)}° Güneydoğu`;
        if (distVal) distVal.textContent = `${dist.toLocaleString('tr-TR')} km`;
        updateQiblaUI(0);
      },
      (err) => { console.warn('Geolocation error:', err); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  startQiblaSensor();
}

function closeQiblaPermissionModal() {
  const modal = document.getElementById('qibla-permission-modal');
  if (modal) modal.style.display = 'none';
}

function setupCompassTouchEvents() {
  const box = document.getElementById('compass-interactive-box');
  if (!box || box.dataset.touchBound) return;
  box.dataset.touchBound = "true";

  const getAngleFromCenter = (e) => {
    const rect = box.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rad = Math.atan2(clientY - centerY, clientX - centerX);
    return rad * (180 / Math.PI);
  };

  const handleStart = (e) => {
    // Only treat as drag if moving
    startTouchAngle = getAngleFromCenter(e);
    startHeadingAngle = smoothHeading || 0;
  };

  const handleMove = (e) => {
    isDraggingCompass = true;
    const currentAngle = getAngleFromCenter(e);
    const delta = currentAngle - startTouchAngle;
    const newHeading = (startHeadingAngle - delta + 360) % 360;
    smoothHeading = newHeading;
    const slider = document.getElementById('manual-compass-slider');
    if (slider) slider.value = Math.round(newHeading);
    updateQiblaUI(newHeading);
  };

  const handleEnd = () => {
    setTimeout(() => { isDraggingCompass = false; }, 300);
  };

  box.addEventListener('touchstart', handleStart, { passive: true });
  box.addEventListener('touchmove', handleMove, { passive: true });
  box.addEventListener('touchend', handleEnd);
  box.addEventListener('mousedown', handleStart);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleEnd);
}

function requestQiblaPermissionFlow(event) {
  if (event) event.preventDefault();
  const modal = document.getElementById('qibla-permission-modal');
  if (modal) modal.style.display = 'flex';
}

function acceptQiblaPermissionFlow() {
  localStorage.setItem('qibla_permission_granted', 'true');
  closeQiblaPermissionModal();
  startCompassSensors(false);
}

function closeQiblaPermissionModal() {
  const modal = document.getElementById('qibla-permission-modal');
  if (modal) modal.style.display = 'none';
}

function startCompassSensors(isAutoStart = false) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        APP_STATE.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const degVal = document.getElementById('qibla-degree-val');
        const distVal = document.getElementById('kaaba-dist-val');
        APP_STATE.qiblaAngle = calculateQiblaBearing(pos.coords.latitude, pos.coords.longitude);
        const dist = calculateGreatCircleDistance(pos.coords.latitude, pos.coords.longitude, 21.4225, 39.8262);
        if (degVal) degVal.textContent = `${Math.round(APP_STATE.qiblaAngle)}° Güneydoğu`;
        if (distVal) distVal.textContent = `${dist.toLocaleString('tr-TR')} km`;
        updateQiblaUI(0);
      },
      (err) => console.warn('Compass geo error:', err),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  const btn = document.getElementById('enable-compass-btn');
  const status = document.getElementById('compass-status-msg');

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (isAutoStart) {
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
      if (btn) btn.innerHTML = "✅ SENSÖR AKTİF (TELEFONU ÇEVİRİN)";
      if (status) status.innerHTML = "✅ <b>Pusula sensörü aktif!</b> Telefonunuzu düz tutarak çevirin.";
    } else {
      DeviceOrientationEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientationEvent, true);
          if (btn) btn.innerHTML = "✅ SENSÖR AKTİF (TELEFONU ÇEVİRİN)";
          if (status) status.innerHTML = "✅ <b>Pusula sensörü aktif!</b> Telefonunuzu düz tutarak çevirin.";
        } else {
          if (btn) btn.innerHTML = "⚡ SENSÖR İZNİ VER & BAŞLAT";
          if (status) status.innerHTML = "⚠️ Sensör izni reddedildi. İzin vermelisiniz.";
          localStorage.removeItem('qibla_permission_granted'); // Reset if denied
        }
      })
      .catch(err => {
        console.warn('Compass permission error:', err);
        // iOS requires user interaction, if it fails, reset
        localStorage.removeItem('qibla_permission_granted');
        if (btn) btn.innerHTML = "⚡ SENSÖR İZNİ VER & BAŞLAT";
      });
    }
  } else {
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientationEvent, true);
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientationEvent, true);
    }
    if (btn) btn.innerHTML = "✅ CANLI SENSÖR AKTİF";
    if (status) status.innerHTML = "✅ <b>Pusula sensörü aktif!</b> Telefonunuzu çevirin veya parmağınızla yönü ayarlayın.";
  }
}

function handleManualCompass(val) {
  const heading = parseFloat(val);
  smoothHeading = heading;
  updateQiblaUI(heading);
}

function handleOrientationEvent(e) {
  if (isDraggingCompass) return; // Don't override while active touch swipe

  let compassHeading = null;

  // iOS Safari
  if (e.webkitCompassHeading != null) {
    compassHeading = e.webkitCompassHeading;
  }
  // Android absolute orientation
  else if (e.alpha != null) {
    if (e.absolute === true || e.type === 'deviceorientationabsolute') {
      compassHeading = (360 - e.alpha) % 360;
    } else {
      compassHeading = (360 - e.alpha) % 360;
    }
  }

  if (compassHeading == null || isNaN(compassHeading)) return;

  if (smoothHeading === null) {
    smoothHeading = compassHeading;
  } else {
    let normalizedSmooth = ((smoothHeading % 360) + 360) % 360;
    let diff = compassHeading - normalizedSmooth;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    // Accumulate the continuous heading to prevent CSS rotate from spinning backwards
    smoothHeading += diff * 0.7;
  }

  const slider = document.getElementById('manual-compass-slider');
  if (slider) slider.value = Math.round(smoothHeading);

  updateQiblaUI(smoothHeading);
}

function updateQiblaUI(heading) {
  const dial = document.getElementById('compass-dial');
  const needle = document.getElementById('compass-needle');
  const headVal = document.getElementById('compass-heading-val');

  if (headVal) headVal.textContent = `${Math.round(heading)}°`;

  // Rotate dial by -heading so North (K) points to magnetic North
  if (dial) {
    dial.style.transform = `rotate(${-heading}deg)`;
  }

  // Rotate gold needle to point relative to fixed 12 o'clock Kâbe target
  // Needle points straight UP (0°) into 🕋 Kâbe target when heading == qiblaAngle
  const relativeNeedleAngle = APP_STATE.qiblaAngle - heading;

  if (needle) {
    needle.style.transform = `translate(-50%, -50%) rotate(${relativeNeedleAngle}deg)`;
  }

  updateQiblaDirectionPill(APP_STATE.qiblaAngle, heading);
}

function updateQiblaDirectionPill(qiblaAngle, heading) {
  const guidePill = document.getElementById('qibla-direction-pill');
  const statusMsg = document.getElementById('compass-status-msg');

  let diff = (qiblaAngle - heading + 360) % 360;
  if (diff > 180) diff -= 360;

  const absDiff = Math.abs(Math.round(diff));

  if (absDiff <= 5) {
    if (guidePill) {
      guidePill.className = 'qibla-pill aligned';
      guidePill.innerHTML = `✨ 🕋 TAM KIBLE YÖNÜNDESİNİZ! ✨`;
    }
    if (statusMsg && !isDraggingCompass) {
      statusMsg.innerHTML = `🎯 <b>HARİKA!</b> Altın ibre şu an tam <b>HEDEF KÂBE</b> simgesiyle çakıştı.`;
      statusMsg.style.color = "#5ce3c7";
    }

    const now = Date.now();
    if (now - lastVibrateTime > 1500 && navigator.vibrate) {
      navigator.vibrate([150, 80, 150]);
      lastVibrateTime = now;
    }
  } else if (diff > 0) {
    if (guidePill) {
      guidePill.className = 'qibla-pill turn-right';
      guidePill.innerHTML = `➡️ Sağa Dön (${absDiff}°)`;
    }
  } else {
    if (guidePill) {
      guidePill.className = 'qibla-pill turn-left';
      guidePill.innerHTML = `⬅️ Sola Dön (${absDiff}°)`;
    }
  }
}


// Quran Section Engine - Full 114 Surahs
function initQuranSection() {
  const searchInput = document.getElementById('surah-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterSurahList(e.target.value);
    });
  }

  // Load all 114 Surahs list
  APP_STATE.surahList = typeof ALL_114_SURAHS !== 'undefined' ? ALL_114_SURAHS : [];
  renderSurahListItems(APP_STATE.surahList);

  document.getElementById('font-decrease')?.addEventListener('click', () => adjustQuranFontSize(-2));
  document.getElementById('font-increase')?.addEventListener('click', () => adjustQuranFontSize(2));

  document.getElementById('back-to-surahs')?.addEventListener('click', () => {
    document.getElementById('surah-list-view').style.display = 'block';
    document.getElementById('surah-detail-view').style.display = 'none';
    
    // Pause audio when returning to list
    const audioPlayer = document.getElementById('surah-audio-player');
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
  });
}

function renderSurahListItems(list) {
  const container = document.getElementById('surah-list-wrap');
  if (!container) return;

  container.innerHTML = '';
  list.forEach(s => {
    const id = s.id || s.number;
    const nameTr = s.name || '';
    const nameAr = s.name_original || s.name_arabic || '';
    const verseCnt = s.verse_count || s.verses_count || '';
    const place = s.revelation_place || 'Mekke';

    const card = document.createElement('div');
    card.className = 'surah-card';
    card.onclick = () => loadSurahDetail(id, s);
    card.innerHTML = `
      <div class="surah-badge-num">${id}</div>
      <div class="surah-info-col">
        <div class="surah-title-tr">${nameTr} Suresi</div>
        <div class="surah-sub-info">${verseCnt} Ayet • ${place}</div>
      </div>
      <div class="surah-title-ar">${nameAr}</div>
    `;
    container.appendChild(card);
  });
}

function filterSurahList(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderSurahListItems(APP_STATE.surahList);
    return;
  }
  const filtered = APP_STATE.surahList.filter(s => {
    const name = (s.name || '').toLowerCase();
    const idStr = String(s.id || s.number);
    return name.includes(q) || idStr === q;
  });
  renderSurahListItems(filtered);
}

// Load Full Verses of Any Surah (Al Quran Cloud API + Açık Kuran API + Fallbacks)
async function loadSurahDetail(id, localSurahObj) {
  document.getElementById('surah-list-view').style.display = 'none';
  document.getElementById('surah-detail-view').style.display = 'block';

  // Setup Audio Player
  const audioPlayer = document.getElementById('surah-audio-player');
  const qariSelect = document.getElementById('qari-select');
  if (audioPlayer && qariSelect) {
    const paddedId = String(id).padStart(3, '0');
    
    const setAudioSource = () => {
      const option = qariSelect.options[qariSelect.selectedIndex];
      const server = option.getAttribute('data-server');
      const qari = option.value;
      audioPlayer.src = `https://${server}.mp3quran.net/${qari}/${paddedId}.mp3`;
      audioPlayer.load();
    };

    setAudioSource();

    qariSelect.onchange = () => {
      const wasPlaying = !audioPlayer.paused;
      const currentTime = audioPlayer.currentTime;
      setAudioSource();
      
      if (wasPlaying) {
        audioPlayer.oncanplay = () => {
          audioPlayer.currentTime = currentTime;
          audioPlayer.play();
          audioPlayer.oncanplay = null;
        };
      }
    };
  }

  const headerCard = document.getElementById('surah-header-card');
  const ayahWrap = document.getElementById('ayah-list-wrap');

  if (headerCard && localSurahObj) {
    headerCard.innerHTML = `
      <div class="detail-ar-name">${localSurahObj.name_original || ''}</div>
      <div class="detail-tr-name">${localSurahObj.name} Suresi</div>
      <div class="detail-meta">${localSurahObj.verse_count} Ayet • ${localSurahObj.revelation_place}</div>
    `;
  }

  if (ayahWrap) ayahWrap.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-sub);">Ayetler yükleniyor...</div>';

  let verses = null;

  // Primary API: Al Quran Cloud (Fastest global CDN with Turkish Transliteration + Diyanet translation)
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${id}/editions/quran-uthmani,tr.transliteration,tr.diyanet`);
    const json = await res.json();

    if (json && json.data && json.data.length >= 3) {
      const arAyahs = json.data[0].ayahs;
      const okAyahs = json.data[1].ayahs;
      const trAyahs = json.data[2].ayahs;

      verses = arAyahs.map((a, idx) => ({
        verse_number: a.numberInSurah,
        verse: a.text,
        okunusu: okAyahs[idx] ? okAyahs[idx].text : '',
        translation: trAyahs[idx] ? trAyahs[idx].text : ''
      }));
    } else if (json && json.data && json.data.length >= 2) {
      const arAyahs = json.data[0].ayahs;
      const trAyahs = json.data[1].ayahs;

      verses = arAyahs.map((a, idx) => ({
        verse_number: a.numberInSurah,
        verse: a.text,
        okunusu: '',
        translation: trAyahs[idx] ? trAyahs[idx].text : ''
      }));
    }
  } catch (e) {
    console.warn('Al Quran Cloud API failed, trying Açık Kuran API:', e);
  }

  // Backup API: Açık Kuran API
  if (!verses) {
    try {
      const res = await fetch(`https://api.acikkuran.com/surah/${id}`);
      const json = await res.json();
      if (json.data && json.data.verses) {
        verses = json.data.verses.map(v => ({
          verse_number: v.verse_number,
          verse: v.verse,
          okunusu: v.transliteration?.text || '',
          translation: v.translation?.text || ''
        }));
      }
    } catch (e) {
      console.warn('Açık Kuran API failed:', e);
    }
  }

  if (ayahWrap && verses && verses.length > 0) {
    ayahWrap.innerHTML = '';

    // Bismillah header for all surahs except Fatiha (1) and Tevbe (9)
    if (id !== 1 && id !== 9) {
      const bism = document.createElement('div');
      bism.className = 'bismillah-header';
      bism.textContent = "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ";
      ayahWrap.appendChild(bism);
    }

    verses.forEach(v => {
      const card = document.createElement('div');
      card.className = 'ayah-card';
      card.innerHTML = `
        <div class="ayah-ar-text">${v.verse}</div>
        ${v.okunusu ? `<div class="ayah-okunusu-text">🗣️ <b>Okunuşu:</b> ${v.okunusu}</div>` : ''}
        <div class="ayah-tr-text"><span class="verse-num-badge">${v.verse_number}</span>📖 <b>Anlamı:</b> ${v.translation}</div>
      `;
      ayahWrap.appendChild(card);
    });
  } else if (ayahWrap) {
    ayahWrap.innerHTML = `
      <div style="text-align:center; padding: 40px; color: var(--text-sub);">
        <p>Ayetler yüklenirken internet bağlantısı kurulamadı.</p>
        <button class="gold-primary-btn" style="margin-top: 12px;" onclick="loadSurahDetail(${id}, localSurahObj)">Tekrar Deneyin</button>
      </div>
    `;
  }
}

function adjustQuranFontSize(delta) {
  APP_STATE.fontSize = Math.max(14, Math.min(36, APP_STATE.fontSize + delta));
  document.documentElement.style.setProperty('--quran-font-size', APP_STATE.fontSize + 'px');

  const valText = document.getElementById('font-size-val');
  if (valText) valText.textContent = APP_STATE.fontSize + 'px';

  const slider = document.getElementById('font-size-slider');
  if (slider) slider.value = APP_STATE.fontSize;

  saveSettings();
}

// Prayer Guide Section
function initPrayerGuideSection() {
  const pillBar = document.getElementById('prayer-pill-bar');
  if (!pillBar || typeof PRAYER_GUIDE_DATA === 'undefined') return;

  pillBar.innerHTML = '';
  const keys = Object.keys(PRAYER_GUIDE_DATA);

  keys.forEach((key, idx) => {
    const item = PRAYER_GUIDE_DATA[key];
    const btn = document.createElement('button');
    btn.className = `prayer-pill-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = item.name;
    btn.onclick = () => {
      document.querySelectorAll('.prayer-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPrayerGuideDetails(key);
    };
    pillBar.appendChild(btn);
  });

  renderPrayerGuideDetails(keys[0]);
}

let currentGuideKey = 'sabah';
let currentGuidePartIdx = 0;
let currentGuideViewMode = 'steps';

function switchGuideViewMode(mode) {
  currentGuideViewMode = mode;

  document.querySelectorAll('.guide-switch-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`guide-tab-${mode}`);
  if (activeBtn) activeBtn.classList.add('active');

  const stepsWrap = document.getElementById('prayer-steps-wrap');
  const duasWrap = document.getElementById('duas-wrap');

  if (mode === 'steps') {
    if (stepsWrap) stepsWrap.style.display = 'block';
    if (duasWrap) duasWrap.style.display = 'none';
  } else if (mode === 'duas') {
    if (stepsWrap) stepsWrap.style.display = 'none';
    if (duasWrap) duasWrap.style.display = 'block';
  } else {
    if (stepsWrap) stepsWrap.style.display = 'block';
    if (duasWrap) duasWrap.style.display = 'block';
  }
}

function switchPrayerPart(key, partIdx) {
  renderPrayerGuideDetails(key, partIdx);
}

function renderPrayerGuideDetails(key, partIdx = 0) {
  const guide = PRAYER_GUIDE_DATA[key];
  if (!guide) return;

  currentGuideKey = key;
  currentGuidePartIdx = partIdx;

  const summaryBox = document.getElementById('rakat-summary-box');
  if (summaryBox) {
    let tagsHtml = guide.parts.map((p, i) => {
      const typeCls = p.type === 'farz' ? 'farz' : p.type === 'vitir' ? 'vitir' : 'sunnet';
      const isSelected = i === partIdx ? 'active-part-btn' : '';
      return `<button class="tag-badge-btn ${typeCls} ${isSelected}" onclick="switchPrayerPart('${key}', ${i})">👉 ${p.description}</button>`;
    }).join('');

    summaryBox.innerHTML = `
      <div class="summary-heading">🕌 ${guide.name} — Toplam ${guide.totalRakat} Rekât</div>
      <div class="rakat-sub-hint">👇 Detaylı kılınışını görmek istediğiniz bölüme tıklayın:</div>
      <div class="rakat-tags-row">${tagsHtml}</div>
    `;
  }

  const activePart = guide.parts[partIdx] || guide.parts[0];
  const stepsWrap = document.getElementById('prayer-steps-wrap');
  if (stepsWrap) {
    const stepsToRender = (activePart && activePart.steps) ? activePart.steps : (guide.steps || []);
    const partTitle = activePart ? activePart.description : guide.name;

    stepsWrap.innerHTML = `
      <div class="active-part-header-banner">
        <span class="banner-badge">📍 Nasıl Kılınır?</span>
        <h3>${partTitle} Kılınış Adımları</h3>
      </div>
      ${stepsToRender.map(s => `
        <div class="step-card">
          <div class="step-circle-num">${s.step}</div>
          <div class="step-body">
            <h4>${s.title}</h4>
            <p>${s.description}</p>
            ${s.arabicText ? `
              <div class="step-dua-block">
                <div class="step-dua-ar">${s.arabicText}</div>
                ${s.okunusuText ? `<div class="step-dua-okunusu">🗣️ <b>Okunuşu:</b> ${s.okunusuText}</div>` : ''}
                ${s.turkishMeaning ? `<div class="step-dua-tr">📖 <b>Anlamı:</b> ${s.turkishMeaning}</div>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    `;
  }

  const duasWrap = document.getElementById('duas-wrap');
  if (duasWrap && typeof PRAYER_DUAS !== 'undefined') {
    let listKeys = ['subhaneke', 'fatiha', 'ettehiyyatu', 'allahummeSalli', 'allahummeBarik', 'rabbenaDuasi'];
    if (key === 'yatsi' || (activePart && activePart.type === 'vitir')) listKeys.push('kunut');

    let duasHtml = listKeys.map(k => {
      const d = PRAYER_DUAS[k];
      if (!d) return '';
      return `
        <div class="dua-full-card">
          <div class="dua-card-title">${d.title}</div>
          <div class="dua-ar-text">${d.arabic}</div>
          ${d.okunusu ? `<div class="dua-okunusu-text">🗣️ <b>Okunuşu:</b> ${d.okunusu}</div>` : ''}
          <div class="dua-tr-text">📖 <b>Anlamı:</b> ${d.turkish}</div>
        </div>
      `;
    }).join('');

    duasWrap.innerHTML = `
      <div class="section-divider-block">
        <div class="divider-line"></div>
        <div class="section-sub-title">📿 Namazda Okunan Temel Dualar ve Sureler</div>
        <div class="divider-line"></div>
      </div>
      ${duasHtml}
    `;
  }

  switchGuideViewMode(currentGuideViewMode);
}

// Settings Controls
function setupSettingsListeners() {
  document.getElementById('city-select')?.addEventListener('change', (e) => {
    const cityName = e.target.value;
    APP_STATE.currentCity = cityName;

    populateDistrictOptions(cityName);

    const firstDistrict = document.getElementById('district-select')?.value || 'Merkez';
    APP_STATE.currentDistrict = firstDistrict;

    const coords = getSelectedCoordinates(cityName, firstDistrict);
    if (coords) {
      APP_STATE.userLocation = coords;
      fetchPrayerTimes(coords.lat, coords.lng);
      if (APP_STATE.currentPage === 'qibla') initQiblaCompass();
    }

    updateLocationHeaderLabel();
    saveSettings();
  });

  document.getElementById('district-select')?.addEventListener('change', (e) => {
    const distName = e.target.value;
    APP_STATE.currentDistrict = distName;

    const coords = getSelectedCoordinates(APP_STATE.currentCity, distName);
    if (coords) {
      APP_STATE.userLocation = coords;
      fetchPrayerTimes(coords.lat, coords.lng);
      if (APP_STATE.currentPage === 'qibla') initQiblaCompass();
    }

    updateLocationHeaderLabel();
    saveSettings();
  });

  document.getElementById('theme-toggle')?.addEventListener('change', (e) => {
    APP_STATE.isDarkTheme = e.target.checked;
    applyStateSettings();
    saveSettings();
  });

  document.getElementById('font-size-slider')?.addEventListener('input', (e) => {
    const size = parseInt(e.target.value);
    APP_STATE.fontSize = size;
    applyStateSettings();
    saveSettings();
  });

  document.getElementById('notify-toggle')?.addEventListener('change', (e) => {
    APP_STATE.notifyEnabled = e.target.checked;
    saveSettings();
    if (APP_STATE.notifyEnabled) {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers['push-permission-request']) {
        window.webkit.messageHandlers['push-permission-request'].postMessage('');
      } else if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
  });

  document.getElementById('notify-time')?.addEventListener('change', (e) => {
    APP_STATE.notifyOffset = parseInt(e.target.value);
    saveSettings();
  });

  document.getElementById('notify-sound')?.addEventListener('change', (e) => {
    APP_STATE.notifySound = e.target.value;
    saveSettings();
  });

  const syncQari = (e) => {
    APP_STATE.qari = e.target.value;
    applyStateSettings();
    saveSettings();
    const surahQariSelect = document.getElementById('qari-select');
    if (surahQariSelect && typeof surahQariSelect.onchange === 'function') {
      surahQariSelect.onchange({ target: surahQariSelect });
    }
  };

  document.getElementById('settings-qari-select')?.addEventListener('change', syncQari);
  document.getElementById('qari-select')?.addEventListener('change', syncQari);

  document.getElementById('auto-gps-btn')?.addEventListener('click', requestGPSLocation);
}

function requestGPSLocation() {
  const statusMsg = document.getElementById('location-status-msg');
  if (statusMsg) {
    statusMsg.textContent = "📡 GPS Konumunuz taranıyor...";
    statusMsg.style.color = "var(--gold-light)";
  }

  if (!navigator.geolocation) {
    if (statusMsg) statusMsg.textContent = "❌ Tarayıcınız GPS desteği vermiyor.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      APP_STATE.userLocation = { lat, lng };

      if (typeof TURKEY_LOCATIONS !== 'undefined') {
        let minDist = Infinity;
        let matchCity = "Yalova";
        let matchDistrict = "Çınarcık";

        TURKEY_LOCATIONS.forEach(p => {
          const dC = calculateGreatCircleDistance(lat, lng, p.lat, p.lng);
          if (dC < minDist) {
            minDist = dC; matchCity = p.il; matchDistrict = "Merkez";
          }
          if (p.ilceler) {
            p.ilceler.forEach(d => {
              const dD = calculateGreatCircleDistance(lat, lng, d.lat, d.lng);
              if (dD < minDist) {
                minDist = dD; matchCity = p.il; matchDistrict = d.name;
              }
            });
          }
        });

        APP_STATE.currentCity = matchCity;
        APP_STATE.currentDistrict = matchDistrict;

        const cSelect = document.getElementById('city-select');
        if (cSelect) cSelect.value = matchCity;
        populateDistrictOptions(matchCity);

        const dSelect = document.getElementById('district-select');
        if (dSelect) dSelect.value = matchDistrict;
      }

      updateLocationHeaderLabel();
      fetchPrayerTimes(lat, lng);
      if (APP_STATE.currentPage === 'qibla') initQiblaCompass();

      if (statusMsg) {
        statusMsg.textContent = `✅ GPS Konumu Alındı: ${APP_STATE.currentCity}, ${APP_STATE.currentDistrict}`;
        statusMsg.style.color = "#4cd964";
      }
      saveSettings();
    },
    (err) => {
      console.warn('GPS location permission denied:', err);
      if (statusMsg) {
        statusMsg.textContent = "⚠️ GPS izni alınamadı. Şehir listenizden manuel seçebilirsiniz.";
      }
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

// --- NOTIFICATION LOGIC ---
let notifiedPrayers = JSON.parse(localStorage.getItem('namaz_vakti_notified') || '{}');
let activeAudioObj = null;

function checkPrayerNotification(nextPrayer, nextTimeDate, diffMs) {
  if (!APP_STATE.notifyEnabled) return;

  const targetMs = APP_STATE.notifyOffset * 60 * 1000;
  const dateStr = nextTimeDate.toISOString().split('T')[0];
  const prayerKey = `${dateStr}_${nextPrayer.id}_${APP_STATE.notifyOffset}`;

  // 1.5 seconds window to trigger (to catch it reliably during the 1-second interval)
  if (diffMs <= targetMs && diffMs > targetMs - 1500 && !notifiedPrayers[prayerKey]) {
    notifiedPrayers[prayerKey] = true;
    localStorage.setItem('namaz_vakti_notified', JSON.stringify(notifiedPrayers));
    triggerNotification(nextPrayer, APP_STATE.notifyOffset);
  }
}

function triggerNotification(prayer, offset) {
  const title = "Huzur Vakti Namaz Hatırlatıcısı";
  const msg = offset === 0 
    ? `${prayer.name} vakti girdi!`
    : `${prayer.name} vaktine ${offset} dakika kaldı.`;

  // 1. Browser API Notification
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body: msg, icon: 'icon.png' });
    } catch (e) { console.warn("Notification error:", e); }
  }

  // 2. Play Sound
  if (APP_STATE.notifySound !== 'silent') {
    if (activeAudioObj) {
      activeAudioObj.pause();
      activeAudioObj.currentTime = 0;
    }
    
    let audioUrl = '';
    if (APP_STATE.notifySound === 'beep') {
      audioUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
    } else if (APP_STATE.notifySound === 'ezan') {
      // Using a short beautiful recitation (Fatiha) as alert since direct adhan APIs often block CORS
      audioUrl = 'https://server8.mp3quran.net/afs/001.mp3'; 
    }

    if (audioUrl) {
      activeAudioObj = new Audio(audioUrl);
      activeAudioObj.play().catch(e => console.warn('Audio play blocked by browser:', e));
    }
  }
}

// Notification Flow
window.acceptNotificationPermissionFlow = function() {
  const notifyModal = document.getElementById('notify-permission-modal');
  if (notifyModal) notifyModal.style.display = 'none';
  
  APP_STATE.notifyEnabled = true;
  saveSettings();
  applyStateSettings();
  
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers['push-permission-request']) {
    window.webkit.messageHandlers['push-permission-request'].postMessage('');
  } else if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  }
};
