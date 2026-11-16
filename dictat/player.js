(() => {
  "use strict";
  const D = Dictat;
  const el = id => document.getElementById(id);
  let config = null;
  let current = -1;
  let busy = false;
  const speaker = D.createSpeaker({
    onBusy(value) { busy = value; render(); },
    onError(error) {
      D.message(el("error"), error.message);
      el("playback-status").textContent = "No se ha podido terminar la lectura. Puedes repetirla.";
    }
  });

  function render() {
    const ready = config && D.supported();
    const started = current >= 0;
    const finished = config && current === config.fragmentos.length - 1;
    el("next").disabled = !ready || busy || finished;
    el("next-label").textContent = finished ? "¡Último fragmento!" : started ? "Siguiente" : "Empezar";
    el("previous").disabled = !ready || current <= 0 || busy;
    el("repeat").disabled = !ready || !started || busy;
    el("review").disabled = !ready || !started || busy;
    el("stop").disabled = !busy;
    el("restart").disabled = !started || busy;
    el("progress").max = config ? config.fragmentos.length : 1;
    el("progress").value = current + 1;
    el("progress-label").textContent = started ? `Fragmento ${current + 1} de ${config.fragmentos.length}` : "Sin empezar";
  }

  function refreshWarning() {
    D.message(el("notice"), config ? D.voiceWarning(config) : "Todavía no hay un dictado guardado. Un adulto puede prepararlo en Administración.");
  }

  function load() {
    speaker.stop();
    config = null;
    current = -1;
    D.message(el("error"), "");
    try { config = D.load(); }
    catch (error) { D.message(el("error"), error.message); }
    el("dictation-title").textContent = config ? config.titulo : "Prepara tu lápiz";
    el("language-label").textContent = config ? (config.idioma === "ca-ES" ? "Català" : "Castellano") : "";
    el("intro").textContent = "Escucha con calma. Tú decides cuándo seguir.";
    el("playback-status").textContent = "Aquí no se muestra el texto. ¡El reto es escucharlo!";
    refreshWarning();
    render();
  }

  function play(from, to, review = false) {
    D.message(el("error"), "");
    speaker.play(config, from, to, {
      onFragment(index) {
        if (!review) current = index;
        el("playback-status").textContent = review ? `Repasando el fragmento ${index + 1}…` : "Escucha y escribe con calma…";
        render();
      },
      onDone() {
        el("playback-status").textContent = review ? "Repaso terminado. Sigues donde estabas."
          : current === config.fragmentos.length - 1 ? "¡Has llegado al final! Puedes repetir o repasar todo el dictado."
          : "Cuando estés lista, pulsa Siguiente.";
      }
    });
  }

  el("next").addEventListener("click", () => play(current + 1, current + 1));
  el("previous").addEventListener("click", () => play(current - 1, current - 1));
  el("repeat").addEventListener("click", () => play(current, current));
  el("review").addEventListener("click", () => play(0, current, true));
  el("stop").addEventListener("click", () => {
    speaker.stop();
    el("playback-status").textContent = "Voz parada. No has perdido tu sitio; pulsa Repetir para escucharlo entero.";
  });
  el("restart").addEventListener("click", () => {
    if (!confirm("¿Quieres volver al principio del dictado?")) return;
    current = -1;
    el("playback-status").textContent = "Todo listo. Pulsa Empezar cuando quieras.";
    render();
  });
  if (D.supported()) speechSynthesis.addEventListener("voiceschanged", refreshWarning);
  window.addEventListener("storage", event => {
    if (event.key === D.STORAGE_KEY || event.key === null) load();
  });
  window.addEventListener("pagehide", () => speaker.stop());
  load();
})();
