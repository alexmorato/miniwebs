const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

function runtime(saved = null) {
  const timers = new Map();
  const pending = [];
  const spoken = [];
  const storage = new Map(saved ? [["mi-dictado-v1", JSON.stringify(saved)]] : []);
  let nextTimer = 0;
  const voices = [
    { voiceURI: "catalan", lang: "ca-ES", name: "Català" },
    { voiceURI: "spanish", lang: "es-ES", name: "Castellano" }
  ];
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: {
      getVoices: () => voices,
      speak(utterance) { spoken.push(utterance); pending.push(utterance); },
      cancel() { pending.length = 0; },
      addEventListener() {}
    }
  });
  vm.runInContext(readFileSync(join(__dirname, "dictat.js"), "utf8"), context);
  function tick() {
    const first = timers.entries().next().value;
    if (first) { timers.delete(first[0]); first[1](); return true; }
    return false;
  }
  function finish() {
    let remaining = 10000;
    while ((pending.length || timers.size) && remaining-- > 0) {
      if (pending.length) pending.shift().onend();
      else tick();
    }
    assert.ok(remaining > 0, "Speech queue must terminate");
  }
  return { D: context.Dictat, context, timers, pending, spoken, storage, voices, tick, finish };
}

function config(overrides = {}) {
  return {
    titulo: "Dictado", idioma: "ca-ES", velocidad: 0.85, pausa: 2000, voz: "",
    fragmentos: ["Els menuts", "van sortir,", "i van tornar."], ...overrides
  };
}

const textOf = parts => Array.from(parts, part => part.text);

test("Splits text without losing words and preserves paragraph boundaries", () => {
  const { D } = runtime();
  const chunks = D.splitText("Els menuts van sortir, i van tornar.\n\nDesprés van jugar.", 3);
  assert.deepEqual(Array.from(chunks), ["Els menuts van", "sortir,", "i van tornar.\n\n", "Després van jugar."]);
  assert.deepEqual(Array.from(D.parseLines(D.toLines(chunks))), Array.from(chunks));
  assert.equal(D.parseLines("\n  Els menuts \n\n\n van sortir. \n").length, 2);
});

test("Text-only JSON receives usable defaults and editable fragments", () => {
  const { D } = runtime();
  const data = D.validate({ titulo: " Mi dictado ", idioma: "es-ES", texto: "Una mañana de otoño, salimos a pasear." });
  assert.equal(data.titulo, "Mi dictado");
  assert.equal(data.velocidad, 0.85);
  assert.equal(data.pausa, 2000);
  assert.deepEqual(Array.from(data.fragmentos), ["Una mañana de otoño,", "salimos a pasear."]);
});

test("Rejects invalid imported data instead of silently substituting defaults", () => {
  const { D } = runtime();
  for (const data of [
    null, [], {}, config({ idioma: "en-US" }), config({ velocidad: "0.85" }),
    config({ velocidad: NaN }), config({ velocidad: 0.49 }), config({ velocidad: 1.21 }),
    config({ pausa: 0 }), config({ voz: 4 }), config({ texto: 4 }),
    config({ fragmentos: [] }), config({ fragmentos: ["  "] }), config({ fragmentos: [4] }),
    config({ fragmentos: ["Dos\nlíneas"] })
  ]) assert.throws(() => D.validate(data));
});

test("Storage round trip preserves paragraphs and reports corrupt/unavailable storage", () => {
  const { D, storage, context } = runtime();
  D.save(config({ fragmentos: ["Hola.\n\n", "Adéu."] }));
  assert.equal(D.load().fragmentos[0], "Hola.\n\n");
  storage.set(D.STORAGE_KEY, "{broken");
  assert.throws(() => D.load(), /JSON válido/);
  context.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
  assert.throws(() => D.save(config()), /No se pudo guardar/);
  context.localStorage.getItem = () => { throw new Error("Access denied"); };
  assert.throws(() => D.load(), /guardado local/);
});

test("Speaks Catalan commas and distinguishes sentence, paragraph and final periods", () => {
  const { D } = runtime();
  assert.deepEqual(textOf(D.speechParts("Hola, món.", "ca-ES", false)), ["Hola", "coma", "món", "punt i seguit"]);
  assert.deepEqual(textOf(D.speechParts("Hola.\n\n", "ca-ES", false)), ["Hola", "punt i a part"]);
  assert.deepEqual(textOf(D.speechParts("Hola. Adéu.", "ca-ES", true)), ["Hola", "punt i seguit", "Adéu", "punt final"]);
});

test("Speaks Spanish punctuation without spelling apostrophes or decimal separators", () => {
  const { D } = runtime();
  assert.deepEqual(textOf(D.speechParts("Hola,\n\n", "es-ES", false)), ["Hola", "coma"]);
  assert.deepEqual(textOf(D.speechParts("Fin.\n\n", "es-ES", false)), ["Fin", "punto y aparte"]);
  assert.deepEqual(textOf(D.speechParts("L'escola té 3,5 metres i 2.5 punts...", "ca-ES", true)),
    ["L'escola té 3,5 metres i 2.5 punts", "punts suspensius"]);
  assert.deepEqual(textOf(D.speechParts("¿Vienes? ¡Sí!", "es-ES", true)),
    ["abre interrogación", "Vienes", "cierre de interrogación", "abre exclamación", "Sí", "cierre de exclamación"]);
});

test("Speech queue keeps a single voice, announces punctuation and completes once", () => {
  const r = runtime();
  const busy = [];
  const fragments = [];
  let done = 0;
  const speaker = r.D.createSpeaker({ onBusy: value => busy.push(value), onError: error => assert.fail(error.message) });
  speaker.play(config(), 0, 2, { onFragment: index => fragments.push(index), onDone: () => done++ });
  r.finish();
  assert.deepEqual(r.spoken.map(item => item.text), ["Els menuts", "van sortir", "coma", "i van tornar", "punt final"]);
  assert.deepEqual(fragments, [0, 1, 2]);
  assert.deepEqual(busy, [true, false]);
  assert.equal(done, 1);
  assert.ok(r.spoken.every(item => item.voice.voiceURI === "catalan" && item.rate === 0.85 && item.lang === "ca-ES"));
});

test("Quotes spanning fragments have an opening and a closing announcement", () => {
  const r = runtime();
  r.D.createSpeaker().play(config({ fragmentos: ['Va dir: "Hola', 'a tothom".'] }), 0, 1);
  r.finish();
  assert.deepEqual(r.spoken.map(item => item.text),
    ["Va dir", "dos punts", "obre cometes", "Hola", "a tothom", "tanca cometes", "punt final"]);
});

test("Stop cancels pending speech, ignores stale events and allows a clean repeat", () => {
  const r = runtime();
  let done = 0;
  const speaker = r.D.createSpeaker();
  speaker.play(config(), 1, 2, { onDone: () => done++ });
  r.tick();
  const stale = r.pending[0];
  speaker.stop();
  stale.onend();
  stale.onerror({ error: "canceled" });
  r.finish();
  assert.deepEqual(r.spoken.map(item => item.text), ["van sortir"]);
  assert.equal(done, 0);
  speaker.play(config(), 1, 1);
  r.finish();
  assert.deepEqual(r.spoken.slice(1).map(item => item.text), ["van sortir", "coma"]);
});

test("Speech errors and unavailable voices are explicitly surfaced", () => {
  const r = runtime();
  const errors = [];
  const speaker = r.D.createSpeaker({ onError: error => errors.push(error.message) });
  speaker.play(config(), 0, 0);
  r.tick();
  r.pending.shift().onerror({ error: "network" });
  assert.equal(speaker.busy, false);
  assert.match(errors[0], /network/);
  assert.match(r.D.voiceWarning(config({ voz: "missing" })), /no está disponible/);
  r.voices.length = 0;
  assert.match(r.D.voiceWarning(config()), /No se ha detectado/);
});

function player(saved = config()) {
  const r = runtime(saved);
  const elements = new Map();
  const listeners = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: "", disabled: false, hidden: false,
      addEventListener(event, callback) { this[event] = callback; }
    });
    return elements.get(id);
  };
  r.context.document = { getElementById: el };
  r.context.window = { addEventListener: (event, callback) => listeners.set(event, callback) };
  r.context.confirm = () => true;
  vm.runInContext(readFileSync(join(__dirname, "player.js"), "utf8"), r.context);
  return { ...r, el, listeners };
}

test("Player advances manually; repeating and reviewing never advance the current position", () => {
  const r = player();
  assert.equal(r.el("repeat").disabled, true);
  r.el("next").click();
  assert.equal(r.el("next").disabled, true);
  r.finish();
  assert.equal(r.el("progress").value, 1);
  r.el("repeat").click();
  r.finish();
  assert.equal(r.el("progress").value, 1);
  r.el("next").click();
  r.finish();
  assert.equal(r.el("progress").value, 2);
  const before = r.spoken.length;
  r.el("review").click();
  r.finish();
  assert.deepEqual(r.spoken.slice(before).map(item => item.text), ["Els menuts", "van sortir", "coma"]);
  assert.equal(r.el("progress").value, 2);
  assert.equal(r.el("next").disabled, false);
  r.el("next").click();
  r.finish();
  assert.equal(r.el("next").disabled, true);
  assert.equal(r.el("repeat").disabled, false);
  assert.match(r.el("playback-status").textContent, /final/);
});

test("Stopping a review preserves position; restart requires confirmation", () => {
  const r = player();
  r.el("next").click(); r.finish();
  r.el("next").click(); r.finish();
  r.el("review").click(); r.tick();
  r.el("stop").click();
  r.finish();
  assert.equal(r.el("progress").value, 2);
  r.context.confirm = () => false;
  r.el("restart").click();
  assert.equal(r.el("progress").value, 2);
  r.context.confirm = () => true;
  r.el("restart").click();
  assert.equal(r.el("progress").value, 0);
});

test("Previous reads the preceding fragment, updates progress and allows advancing again", () => {
  const r = player();
  assert.equal(r.el("previous").disabled, true);
  r.el("next").click(); r.finish();
  assert.equal(r.el("previous").disabled, true);
  r.el("next").click(); r.finish();
  r.el("next").click();
  assert.equal(r.el("previous").disabled, true);
  r.finish();
  assert.equal(r.el("previous").disabled, false);
  assert.equal(r.el("next").disabled, true);
  const before = r.spoken.length;
  r.el("previous").click();
  r.finish();
  assert.deepEqual(r.spoken.slice(before).map(item => item.text), ["van sortir", "coma"]);
  assert.equal(r.el("progress").value, 2);
  assert.equal(r.el("next").disabled, false);
  r.el("next").click(); r.finish();
  assert.equal(r.el("progress").value, 3);
  r.el("previous").click(); r.finish();
  r.el("previous").click(); r.finish();
  assert.equal(r.el("progress").value, 1);
  assert.equal(r.el("previous").disabled, true);
});

test("Player stays disabled without a saved dictation or speech support", () => {
  const empty = player(null);
  assert.equal(empty.el("next").disabled, true);
  assert.equal(empty.el("previous").disabled, true);
  assert.match(empty.el("notice").textContent, /Administración/);
  const r = runtime(config());
  delete r.context.speechSynthesis;
  assert.equal(r.D.supported(), false);
  assert.match(r.D.voiceWarning(config()), /no dispone/);
});

test("An externally saved dictation resets player state without exposing its text", () => {
  const r = player();
  r.el("next").click(); r.finish();
  r.D.save(config({ titulo: "Nuevo", fragmentos: ["Contenido secreto."] }));
  r.listeners.get("storage")({ key: r.D.STORAGE_KEY });
  assert.equal(r.el("progress").value, 0);
  assert.equal(r.el("dictation-title").textContent, "Nuevo");
  assert.doesNotMatch(r.el("playback-status").textContent, /Contenido secreto/);
});
