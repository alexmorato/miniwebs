(() => {
  "use strict";
  const D = Dictat;
  const el = id => document.getElementById(id);
  let dirty = false;
  let preferredVoice = "";
  const speaker = D.createSpeaker({
    onBusy(value) { el("stop").disabled = !value; },
    onError(error) { D.message(el("error"), error.message); }
  });
  function report(error) { D.message(el("error"), error.message); }
  function changed() {
    dirty = true;
    D.message(el("notice"), "");
    el("save-status").textContent = "Tienes cambios sin guardar.";
    count();
  }
  function count() { el("fragment-count").textContent = D.parseLines(el("fragments").value).length; }
  function settings() {
    return { idioma: el("language").value, voz: preferredVoice, velocidad: Number(el("rate").value), pausa: Number(el("pause").value) };
  }
  function readEditor() {
    return D.validate({ titulo: el("title").value, ...settings(), texto: el("source").value, fragmentos: D.parseLines(el("fragments").value) });
  }
  function refreshVoices() {
    const selected = preferredVoice;
    el("voice").replaceChildren(new Option("Automática para este idioma", ""));
    const voices = D.matchingVoices(el("language").value);
    for (const voice of voices) el("voice").add(new Option(`${voice.name} (${voice.lang})`, voice.voiceURI));
    if (selected && !voices.some(voice => voice.voiceURI === selected)) {
      const missing = new Option("Voz guardada no disponible (se usará otra)", selected);
      el("voice").add(missing);
    }
    el("voice").value = selected;
    el("voice-warning").textContent = D.voiceWarning(settings()) || "Escucha una prueba: las voces dependen del navegador y del dispositivo; algunas necesitan conexión.";
    el("test-voice").disabled = !D.supported();
    el("preview").disabled = !D.supported();
  }
  function fill(data) {
    speaker.stop();
    el("title").value = data.titulo;
    el("language").value = data.idioma;
    el("rate").value = data.velocidad;
    el("rate-value").textContent = `${data.velocidad}×`;
    el("pause").value = data.pausa;
    el("source").value = data.texto;
    el("fragments").value = D.toLines(data.fragmentos);
    el("source").lang = data.idioma;
    el("fragments").lang = data.idioma;
    preferredVoice = data.voz;
    refreshVoices();
    count();
  }
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { throw new Error("El JSON no es válido. Revisa las comillas, las comas y los corchetes."); }
    const data = D.validate(parsed);
    if (dirty && !confirm("Importar sustituirá los cambios del editor que no has guardado. ¿Continuar?")) return;
    fill(data);
    changed();
    D.message(el("error"), "");
    D.message(el("notice"), "JSON cargado en el editor. Revisa los fragmentos y pulsa Guardar para aplicarlo.");
  }
  el("editor").addEventListener("input", () => {
    speaker.stop();
    changed();
    el("rate-value").textContent = `${Number(el("rate").value)}×`;
  });
  el("language").addEventListener("change", () => {
    preferredVoice = "";
    el("source").lang = el("language").value;
    el("fragments").lang = el("language").value;
    refreshVoices();
  });
  el("voice").addEventListener("change", () => {
    preferredVoice = el("voice").value;
    refreshVoices();
  });
  el("split").addEventListener("click", () => {
    if (!el("source").value.trim()) { report(new Error("Pega primero el texto original que quieres dividir.")); return; }
    if (el("fragments").value.trim() && !confirm("Se sustituirán los fragmentos actuales por una nueva división. ¿Continuar?")) return;
    speaker.stop();
    el("fragments").value = D.toLines(D.splitText(el("source").value, Number(el("chunk-size").value)));
    changed();
    D.message(el("error"), "");
  });
  el("editor").addEventListener("submit", event => {
    event.preventDefault();
    try {
      D.save(readEditor());
      dirty = false;
      D.message(el("error"), "");
      D.message(el("notice"), "Dictado guardado. Ya puedes abrir la pantalla infantil.");
      el("save-status").textContent = "Guardado en este navegador.";
    } catch (error) { report(error); }
  });
  el("test-voice").addEventListener("click", () => {
    D.message(el("error"), "");
    const config = { ...settings(), fragmentos: [el("language").value === "ca-ES" ? "Hola, escrivim a poc a poc." : "Hola, escribimos poco a poco."] };
    speaker.play(config, 0, 0);
  });
  el("preview").addEventListener("click", () => {
    try {
      const config = readEditor();
      D.message(el("error"), "");
      speaker.play(config, 0, config.fragmentos.length - 1);
    } catch (error) { report(error); }
  });
  el("stop").addEventListener("click", () => speaker.stop());
  el("import-json").addEventListener("click", () => {
    try { importJSON(el("json").value); }
    catch (error) { report(error); }
  });
  el("import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("El archivo supera 2 MB. Importa un dictado más pequeño.");
      importJSON(await file.text());
    } catch (error) { report(error); }
    finally { event.target.value = ""; }
  });
  el("export").addEventListener("click", () => {
    try {
      const data = readEditor();
      const json = JSON.stringify(data, null, 2);
      el("json").value = json;
      const url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "dictado.json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      D.message(el("error"), "");
      D.message(el("notice"), "JSON preparado para descargar. Exportar no guarda los cambios en la pantalla infantil.");
    } catch (error) { report(error); }
  });
  if (D.supported()) speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  window.addEventListener("pagehide", () => speaker.stop());
  window.addEventListener("beforeunload", event => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  window.addEventListener("storage", event => {
    if (event.key === D.STORAGE_KEY || event.key === null) {
      D.message(el("notice"), "El dictado guardado ha cambiado en otra pestaña. Este editor no se ha sustituido. Recarga para cargarlo o guarda para reemplazarlo.");
    }
  });
  try {
    const saved = D.load();
    fill(saved || D.validate(D.sample));
    if (!saved) {
      dirty = true;
      el("save-status").textContent = "Ejemplo cargado. Revísalo y guarda tu primer dictado.";
    }
  } catch (error) { report(error); refreshVoices(); count(); }
})();
