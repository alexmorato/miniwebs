(function () {
  const LS_KEYS = {
    showFontControls: 'rayitas.showFontControls',
    fontSizeRem: 'rayitas.fontSizeRem'
  };

  function setValue(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getValue(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function setBool(key, value) {
    setValue(key, Boolean(value));
  }

  function getBool(key, fallback) {
    return Boolean(getValue(key, fallback));
  }

  function setNumber(key, value) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      setValue(key, parsed);
    }
  }

  function getNumber(key, fallback) {
    const value = Number(getValue(key, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  window.LS_KEYS = LS_KEYS;
  window.LS = {
    setValue,
    getValue,
    setBool,
    getBool,
    setNumber,
    getNumber
  };
})();
