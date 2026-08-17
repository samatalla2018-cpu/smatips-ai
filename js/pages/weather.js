// صفحة الطقس — بيانات حقيقية عبر Open-Meteo (طقس) + Nominatim (بحث مدن يدعم العربية)، بدون أي مفتاح API

const WEATHER_CODE_TEXT = {
  0: 'صافٍ', 1: 'صافٍ غالبًا', 2: 'غائم جزئيًا', 3: 'غائم',
  45: 'ضباب', 48: 'ضباب متجمد',
  51: 'رذاذ خفيف', 53: 'رذاذ', 55: 'رذاذ كثيف',
  56: 'رذاذ متجمد', 57: 'رذاذ متجمد كثيف',
  61: 'مطر خفيف', 63: 'مطر', 65: 'مطر غزير',
  66: 'مطر متجمد', 67: 'مطر متجمد غزير',
  71: 'ثلج خفيف', 73: 'ثلج', 75: 'ثلج غزير', 77: 'حبيبات ثلج',
  80: 'زخات مطر خفيفة', 81: 'زخات مطر', 82: 'زخات مطر غزيرة',
  85: 'زخات ثلج خفيفة', 86: 'زخات ثلج غزيرة',
  95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع برد', 99: 'عاصفة رعدية شديدة مع برد',
};

function weatherCodeText(code) {
  return WEATHER_CODE_TEXT[code] ?? 'غير معروف';
}

function weatherIconFor(code, isDay) {
  const day = isDay !== 0;
  if (code === 0) return day ? 'sun' : 'moon';
  if (code === 1 || code === 2) return day ? 'cloudSun' : 'cloudMoon';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'cloudFog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'cloudRain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'cloudSnow';
  if ([95, 96, 99].includes(code)) return 'cloudStorm';
  return 'cloud';
}

async function fetchWeather(lat, lon, startDate, endDate) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
  });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (!startDate) params.set('forecast_days', '7');
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.reason || 'forecast request failed');
    err.outOfRange = /out of allowed range/i.test(body.reason || '');
    throw err;
  }
  return res.json();
}

function forecastDayHtml(dateStr, code, tMax, tMin) {
  return `
    <div class="card" style="text-align:center; padding:12px 8px;">
      <div class="text-sm font-bold">${formatDateAr(dateStr, { year: false })}</div>
      <div style="margin:6px 0; color:var(--info);">${icon(weatherIconFor(code, 1), 28)}</div>
      <div class="text-sm text-muted" style="min-height:34px;">${weatherCodeText(code)}</div>
      <div class="mt-1" style="font-weight:800;">${Math.round(tMax)}° <span class="text-muted" style="font-weight:600;">/ ${Math.round(tMin)}°</span></div>
    </div>`;
}

function weatherHeroHtml(place, cur, todayMax, todayMin) {
  const iconName = weatherIconFor(cur.weather_code, cur.is_day);
  return `
    <div class="card weather-hero">
      <div class="weather-hero-top">
        <div>
          <div class="weather-city">${escapeHtml(place.name)}</div>
          <div class="text-sm text-muted">${escapeHtml(place.country || '')}</div>
        </div>
        <div class="weather-icon-lg" style="color:var(--info);">${icon(iconName, 56)}</div>
      </div>
      <div class="weather-temp-row">
        <div class="weather-temp-big">${Math.round(cur.temperature_2m)}°</div>
        <div>
          <div class="font-bold">${weatherCodeText(cur.weather_code)}</div>
          <div class="text-sm text-muted">أعلى ${Math.round(todayMax)}° · أقل ${Math.round(todayMin)}°</div>
        </div>
      </div>
      <div class="weather-stats-grid">
        <div class="weather-stat">${icon('sparkle', 16)}<span>المحسوسة</span><b>${Math.round(cur.apparent_temperature)}°</b></div>
        <div class="weather-stat">${icon('droplet', 16)}<span>الرطوبة</span><b>${Math.round(cur.relative_humidity_2m)}%</b></div>
        <div class="weather-stat">${icon('wind', 16)}<span>الرياح</span><b>${Math.round(cur.wind_speed_10m)} كم/س</b></div>
        <div class="weather-stat">${icon('calendar', 16)}<span>الوقت</span><b>${cur.is_day ? 'نهارًا' : 'ليلًا'}</b></div>
      </div>
    </div>`;
}

async function performWeatherSearch(container, query, statusEl, tripDates) {
  if (!query || !query.trim()) return;
  statusEl.innerHTML = `<div class="flex items-center gap-2 text-sm text-muted" style="padding:20px 0;"><span class="spinner"></span><span>جارٍ البحث عن "${escapeHtml(query)}" وجلب بيانات الطقس...</span></div>`;
  try {
    const geo = await geocodeCity(query);
    if (!geo) {
      statusEl.innerHTML = emptyState({
        iconName: 'cloud',
        title: `لم يتم العثور على "${query}"`,
        desc: 'تأكد من كتابة اسم المدينة بشكل صحيح (بالعربية أو الإنجليزية) وحاول مجددًا.',
      });
      return;
    }

    let data, note = '';
    try {
      data = await fetchWeather(geo.lat, geo.lon, tripDates?.startDate, tripDates?.endDate);
    } catch (err) {
      if (err.outOfRange) {
        data = await fetchWeather(geo.lat, geo.lon, null, null);
        note = `<div class="card mt-2" style="border-style:dashed; margin-bottom:12px;"><div class="text-sm text-muted" style="font-weight:700;">${icon('info', 14)} تواريخ رحلتك بعيدة حاليًا عن نافذة التوقعات (تصبح متاحة عادة قبل السفر بـ16 يومًا). المعروض أدناه توقعات الأيام القادمة كمرجع.</div></div>`;
      } else {
        throw err;
      }
    }

    const days = data.daily.time;
    const forecastCards = days.map((d, i) => forecastDayHtml(d, data.daily.weather_code[i], data.daily.temperature_2m_max[i], data.daily.temperature_2m_min[i])).join('');

    statusEl.innerHTML = `
      ${weatherHeroHtml(geo, data.current, data.daily.temperature_2m_max[0], data.daily.temperature_2m_min[0])}
      ${note}
      <div class="section-title-row"><h2>توقعات الأيام القادمة</h2></div>
      <div class="grid grid-4">${forecastCards}</div>
    `;
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = emptyState({
      iconName: 'cloud',
      title: 'تعذّر جلب بيانات الطقس',
      desc: 'تأكد من اتصالك بالإنترنت وحاول مجددًا.',
    });
  }
}

function renderWeather(container) {
  const trip = store.getTrip();
  const tripDest = trip.city || trip.country || '';

  container.innerHTML = `
    ${pageHeader({ title: 'الطقس', desc: 'ابحث عن طقس أي مدينة في العالم، أو اعرض طقس وجهة رحلتك تلقائيًا', iconName: 'cloud' })}

    <form id="weather-search-form" class="flex gap-2" style="align-items:flex-end;">
      <div class="field" style="flex:1;">
        <label>ابحث عن مدينة</label>
        <input type="text" id="weather-city-input" placeholder="مثال: جدة، دبي، إسطنبول، لندن..." value="${escapeHtml(tripDest)}" autocomplete="off" />
      </div>
      <button type="submit" class="btn btn-primary" style="height:44px;">${icon('search', 16)}<span>بحث</span></button>
    </form>

    <div class="mt-3" id="weather-status"></div>
  `;

  const statusEl = qs('#weather-status');
  const input = qs('#weather-city-input');
  const form = qs('#weather-search-form');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    performWeatherSearch(container, input.value, statusEl, null);
  });

  if (tripDest) {
    performWeatherSearch(container, tripDest, statusEl, { startDate: trip.startDate, endDate: trip.endDate });
  } else {
    statusEl.innerHTML = emptyState({
      iconName: 'cloud',
      title: 'ابحث عن مدينة لعرض طقسها',
      desc: 'اكتب اسم أي مدينة في العالم في مربع البحث أعلاه، أو أضف مدينة وجهتك في بيانات الرحلة لعرضها هنا تلقائيًا.',
    });
  }
}

registerRoute('/weather', renderWeather);
