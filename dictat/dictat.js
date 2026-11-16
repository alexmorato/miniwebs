/* Shared data format and speech sequencing for both pages. */
(() => {
  "use strict";
  const STORAGE_KEY = "mi-dictado-v1";
  const pauses = [1000, 2000, 3000, 5000];
  const sample = {
    titulo: "El pati de l'escola",
    idioma: "ca-ES",
    velocidad: 0.85,
    voz: "",
    pausa: 2000,
    texto: "Els menuts van treure la brossa del sorral amb galledes i rasclets. Els mitjans van netejar les portes i finestres de la paret que donava al pati perquè estaven molt brutes, i els grans vam pintar les línies de la pista esportiva. Els mestres ajudaven on feia falta. Tots plegats vam deixar el pati net com un patena."
  };

  function splitText(text, size = 4) {
    const result = [];
    for (const paragraph of text.trim().split(/\n\s*\n/)) {
      const words = paragraph.match(/\S+/g) || [];
      let chunk = [];
      for (const word of words) {
        chunk.push(word);
        if (chunk.length >= size || /[.,;:!?…]["»”)]*$/.test(word)) {
          result.push(chunk.join(" "));
          chunk = [];
        }
      }
      if (chunk.length) result.push(chunk.join(" "));
      if (words.length) result[result.length - 1] += "\n\n";
    }
    if (result.length) result[result.length - 1] = result[result.length - 1].trim();
    return result;
  }

  function parseLines(text) {
    const result = [];
    for (const line of text.replace(/\r/g, "").split("\n")) {
      if (line.trim()) result.push(line.trim());
      else if (result.length) result[result.length - 1] = result[result.length - 1].trimEnd() + "\n\n";
    }
    if (result.length) result[result.length - 1] = result[result.length - 1].trimEnd();
    return result;
  }

  function toLines(fragments) {
    return fragments.map(fragment => fragment.trimEnd() + (/\n\s*\n\s*$/.test(fragment) ? "\n" : "")).join("\n");
  }

  function validate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("El JSON debe contener un objeto de dictado.");
    if (typeof data.titulo !== "string" || !data.titulo.trim() || data.titulo.length > 160) throw new Error("Indica un título de entre 1 y 160 caracteres.");
    if (!["ca-ES", "es-ES"].includes(data.idioma)) throw new Error("El idioma debe ser «ca-ES» o «es-ES».");
    const velocidad = data.velocidad === undefined ? 0.85 : data.velocidad;
    if (typeof velocidad !== "number" || !Number.isFinite(velocidad) || velocidad < 0.5 || velocidad > 1.2) throw new Error("La velocidad debe ser un número entre 0.5 y 1.2.");
    const pausa = data.pausa === undefined ? 2000 : data.pausa;
    if (!pauses.includes(pausa)) throw new Error("La pausa debe ser 1000, 2000, 3000 o 5000 milisegundos.");
    if (data.voz !== undefined && typeof data.voz !== "string") throw new Error("El campo «voz» debe ser un identificador de texto.");
    if (data.texto !== undefined && typeof data.texto !== "string") throw new Error("El campo «texto» debe ser texto.");
    const fragments = data.fragmentos === undefined && typeof data.texto === "string" ? splitText(data.texto) : data.fragmentos;
    if (!Array.isArray(fragments) || !fragments.length || fragments.length > 1000 ||
      fragments.some(fragment => typeof fragment !== "string" || !fragment.trim() || fragment.length > 2000)) {
      throw new Error("Indica de 1 a 1000 fragmentos de texto, no vacíos y de hasta 2000 caracteres cada uno.");
    }
    if (fragments.some(fragment => /[\r\n]/.test(fragment.trim()))) {
      throw new Error("Cada fragmento debe ocupar una sola línea. Para indicar un cambio de párrafo, añade «\\n\\n» al final del fragmento.");
    }
    return {
      titulo: data.titulo.trim(), idioma: data.idioma, velocidad, voz: data.voz || "", pausa,
      texto: data.texto === undefined ? fragments.join(" ") : data.texto,
      fragmentos: fragments.map(fragment => fragment.replace(/\r/g, ""))
    };
  }

  function load() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); }
    catch (error) { throw new Error(`No se puede acceder al guardado local. Revisa los permisos del navegador. ${error.message}`); }
    if (raw === null) return null;
    let data;
    try { data = JSON.parse(raw); }
    catch { throw new Error("El dictado guardado no es un JSON válido. Impórtalo de nuevo desde Administración."); }
    return validate(data);
  }

  function save(data) {
    const valid = validate(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(valid)); }
    catch (error) { throw new Error(`No se pudo guardar. Revisa el espacio y los permisos del navegador. ${error.message}`); }
    return valid;
  }

  function speechParts(fragment, language, isLast, quoteOpen = false) {
    const ca = language === "ca-ES";
    const names = ca ? {
      ",": "coma", ";": "punt i coma", ":": "dos punts", "?": "signe d'interrogació",
      "!": "signe d'exclamació", "…": "punts suspensius", "...": "punts suspensius",
      "«": "obre cometes", "»": "tanca cometes", "“": "obre cometes", "”": "tanca cometes",
      "(": "obre parèntesi", ")": "tanca parèntesi", "¿": "obre interrogació", "¡": "obre exclamació"
    } : {
      ",": "coma", ";": "punto y coma", ":": "dos puntos", "?": "cierre de interrogación",
      "!": "cierre de exclamación", "…": "puntos suspensivos", "...": "puntos suspensivos",
      "«": "abre comillas", "»": "cierra comillas", "“": "abre comillas", "”": "cierra comillas",
      "(": "abre paréntesis", ")": "cierra paréntesis", "¿": "abre interrogación", "¡": "abre exclamación"
    };
    const parts = [];
    const punctuation = /\.\.\.|[.,;:!?…«»“”"()¿¡]/g;
    let offset = 0;
    for (const match of fragment.matchAll(punctuation)) {
      const sign = match[0];
      const index = match.index;
      if ((sign === "." || sign === ",") && /\d/.test(fragment[index - 1] || "") && /\d/.test(fragment[index + 1] || "")) continue;
      const text = fragment.slice(offset, index).trim();
      if (text) parts.push({ text, pause: 0 });
      let name = names[sign];
      if (sign === ".") {
        const remaining = fragment.slice(index + 1);
        const end = !remaining.replace(/["»”)\s]/g, "");
        const paragraph = end && /\n\s*\n/.test(remaining);
        name = ca ? (end && isLast ? "punt final" : paragraph ? "punt i a part" : "punt i seguit")
          : (end && isLast ? "punto final" : paragraph ? "punto y aparte" : "punto y seguido");
      } else if (sign === '"') {
        name = ca ? (quoteOpen ? "tanca cometes" : "obre cometes") : (quoteOpen ? "cierra comillas" : "abre comillas");
        quoteOpen = !quoteOpen;
      }
      parts.push({ text: name, pause: 380 });
      offset = index + sign.length;
    }
    const tail = fragment.slice(offset).trim();
    if (tail) parts.push({ text: tail, pause: 0 });
    return parts;
  }

  const supported = () => "speechSynthesis" in globalThis && "SpeechSynthesisUtterance" in globalThis;
  const getVoices = () => supported() ? speechSynthesis.getVoices() : [];
  const matchingVoices = language => getVoices().filter(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === language.slice(0, 2));
  function voiceWarning(config) {
    if (!supported()) return "Este navegador no dispone de lectura de voz. Prueba con una versión actual de Chrome, Edge o Safari.";
    const voices = matchingVoices(config.idioma);
    if (!voices.length) return "No se ha detectado una voz para este idioma. Instala una voz catalana o castellana en el dispositivo y vuelve a abrir la página. La voz automática puede pronunciarlo mal.";
    if (config.voz && !voices.some(voice => voice.voiceURI === config.voz)) return "La voz guardada no está disponible en este dispositivo. Se usará otra del mismo idioma; puedes elegirla en Administración.";
    return "";
  }

  function createSpeaker({ onBusy = () => {}, onError = () => {} } = {}) {
    let generation = 0;
    let timer;
    let activeUtterance;
    let busy = false;
    function stop() {
      generation++;
      clearTimeout(timer);
      if (supported()) speechSynthesis.cancel();
      activeUtterance = null;
      if (busy) { busy = false; onBusy(false); }
    }
    function play(config, from, to, { onFragment = () => {}, onDone = () => {} } = {}) {
      stop();
      if (!supported()) { onError(new Error(voiceWarning(config))); return; }
      const run = generation;
      busy = true;
      onBusy(true);
      const voices = matchingVoices(config.idioma);
      const voice = voices.find(item => item.voiceURI === config.voz) ||
        voices.find(item => item.lang.toLowerCase() === config.idioma.toLowerCase()) || voices[0];
      const tasks = [];
      let quoteOpen = (config.fragmentos.slice(0, from).join("").match(/"/g) || []).length % 2 === 1;
      for (let index = from; index <= to; index++) {
        const fragment = config.fragmentos[index];
        const parts = speechParts(fragment, config.idioma, index === config.fragmentos.length - 1, quoteOpen);
        if ((fragment.match(/"/g) || []).length % 2) quoteOpen = !quoteOpen;
        tasks.push({ index, parts });
      }
      function fail(error) {
        if (run !== generation) return;
        stop();
        onError(error);
      }
      function fragmentAt(taskIndex) {
        if (run !== generation) return;
        if (taskIndex === tasks.length) {
          busy = false;
          activeUtterance = null;
          onBusy(false);
          onDone();
          return;
        }
        const task = tasks[taskIndex];
        onFragment(task.index);
        function partAt(partIndex) {
          if (run !== generation) return;
          if (partIndex === task.parts.length) {
            timer = setTimeout(() => fragmentAt(taskIndex + 1), taskIndex < tasks.length - 1 ? config.pausa : 0);
            return;
          }
          const part = task.parts[partIndex];
          timer = setTimeout(() => {
            if (run !== generation) return;
            const utterance = new SpeechSynthesisUtterance(part.text);
            activeUtterance = utterance;
            utterance.lang = config.idioma;
            utterance.rate = config.velocidad;
            if (voice) utterance.voice = voice;
            utterance.onend = () => partAt(partIndex + 1);
            utterance.onerror = event => fail(new Error(`La lectura se ha detenido (${event.error}). Comprueba la voz y pulsa Repetir para intentarlo de nuevo.`));
            try { speechSynthesis.speak(utterance); }
            catch (error) { fail(new Error(`No se pudo iniciar la voz: ${error.message}`)); }
          }, part.pause);
        }
        partAt(0);
      }
      fragmentAt(0);
    }
    return { play, stop, get busy() { return busy; }, get utterance() { return activeUtterance; } };
  }

  function message(element, text) {
    element.textContent = text;
    element.hidden = !text;
  }

  globalThis.Dictat = { STORAGE_KEY, sample, splitText, parseLines, toLines, validate, load, save, speechParts,
    supported, matchingVoices, voiceWarning, createSpeaker, message };
})();
