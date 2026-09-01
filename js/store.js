// طبقة تخزين البيانات — تحفظ كل شيء في localStorage حتى لا تضيع البيانات عند التحديث
const STORAGE_KEY = 'smatrips.v1';

function defaultData() {
  return {
    trip: {
      id: '',
      title: '',
      country: '',
      city: '',
      startDate: '',
      endDate: '',
      tripType: '',
      budget: '',
      currency: 'USD',
      travelers: 1,
      homeCountryPlug: '',
      destPlug: '',
      notes: '',
    },
    days: [],       // { id, date, title, notes }
    activities: [],  // { id, dayId, time, title, type, placeId, cost, notes }
    tasks: [],       // { id, title, done, dueDate, category, priority }
    packing: [],     // { id, name, category, qty, packed }
    places: [],      // { id, name, type, city, country, mapsUrl, budget, tripType, rating, notes, day }
    links: [],       // { id, title, url, category, notes }
    services: [],    // { id, title, url, category, description }
    settings: {
      themeColorSet: 'default',
    },
  };
}

function migrate(data) {
  const base = defaultData();
  const merged = { ...base, ...data };
  for (const key of Object.keys(base)) {
    if (merged[key] === undefined || merged[key] === null) merged[key] = base[key];
  }
  merged.trip = { ...base.trip, ...(data.trip || {}) };
  merged.settings = { ...base.settings, ...(data.settings || {}) };
  return merged;
}

class Store {
  constructor() {
    this._data = this._load();
    this._subscribers = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('تعذّرت قراءة البيانات المحفوظة، سيتم البدء ببيانات جديدة.', e);
      return defaultData();
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error('تعذّر حفظ البيانات', e);
      if (typeof toast === 'function') toast('تعذّر حفظ البيانات في هذا المتصفح', 'error');
    }
    this._emit();
  }

  _emit() {
    this._subscribers.forEach((fn) => fn(this._data));
  }

  subscribe(fn) {
    this._subscribers.push(fn);
    return () => { this._subscribers = this._subscribers.filter((f) => f !== fn); };
  }

  get data() { return this._data; }

  // ---- الرحلة ----
  getTrip() { return this._data.trip; }
  updateTrip(patch) {
    this._data.trip = { ...this._data.trip, ...patch };
    this._save();
  }

  // ---- الإعدادات ----
  getSettings() { return this._data.settings; }
  updateSettings(patch) {
    this._data.settings = { ...this._data.settings, ...patch };
    this._save();
  }

  // ---- عام: مجموعات قابلة لإعادة الاستخدام ----
  list(collection) { return this._data[collection] || []; }

  add(collection, item) {
    const record = { id: uid(), ...item };
    this._data[collection].push(record);
    this._save();
    return record;
  }

  update(collection, id, patch) {
    const idx = this._data[collection].findIndex((x) => x.id === id);
    if (idx === -1) return null;
    this._data[collection][idx] = { ...this._data[collection][idx], ...patch };
    this._save();
    return this._data[collection][idx];
  }

  remove(collection, id) {
    this._data[collection] = this._data[collection].filter((x) => x.id !== id);
    this._save();
  }

  get(collection, id) {
    return this._data[collection].find((x) => x.id === id) || null;
  }

  exportJSON() {
    return JSON.stringify(this._data, null, 2);
  }

  importJSON(json) {
    const parsed = JSON.parse(json);
    this._data = migrate(parsed);
    this._save();
  }

  resetAll() {
    this._data = defaultData();
    this._save();
  }
}

window.store = new Store();
