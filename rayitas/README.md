# Rayitas

Miniapp web para mostrar frases motivacionales por nina, con panel de administracion, modos de avance y persistencia en `localStorage`.

## Archivos principales

- `index.html`: pantalla principal donde se muestran las frases.
- `admin.html`: panel de configuracion y seguimiento.
- `ls.js`: claves y helpers comunes para `localStorage`.
- `frases_lara.json`: frases agrupadas por nombre de nina.
- `preguntas.json`: preguntas de validacion agrupadas por nombre de nina.

## Funcionalidades implementadas

### 1. Carga de frases desde JSON

- La aplicacion carga las frases desde `frases_lara.json`.
- El JSON usa estructura por nina:

```json
{
  "ninas": {
    "Lara": ["frase 1", "frase 2"],
    "Naia": ["frase 1", "frase 2"]
  }
}
```

- La nina activa se selecciona desde `admin.html`.

### 2. Seleccion aleatoria inicial

- Al iniciar `index.html`, se elige una frase inicial.
- Si existe una posicion guardada en progreso para la nina activa, la app retoma esa posicion cuando corresponde.

### 3. Navegacion entre frases

- Modo `Navegacion libre`:
  - Boton anterior.
  - Boton siguiente.
  - Contador visual de frase actual.
  - Soporte de gesto swipe en movil o tablet.

### 4. Popup inicial de pantalla completa

- Al entrar en `index.html` aparece un popup preguntando si se quiere usar pantalla completa.
- Si el usuario acepta, se solicita `fullscreen`.
- Tambien se intenta activar `Wake Lock API` para evitar que la pantalla se apague mientras se usa la app.

### 5. Control del tamano de letra

- Botones `A-` y `A+` para reducir o aumentar la letra.
- El tamano se guarda en `localStorage`.
- El valor guardado se muestra en `admin.html`.

### 6. Mostrar u ocultar los botones de tamano

- Desde `admin.html` se puede activar o desactivar la opcion:
  - `Mostrar botones A+ / A- en index`
- `index.html` lee esa preferencia y muestra u oculta los botones.

### 7. Forzar frase en mayusculas

- Desde `admin.html` se puede activar:
  - `Forzar frase en mayusculas`
- Si esta activa, la frase se muestra visualmente en mayusculas en `index.html`.
- El texto original del JSON no se modifica.

### 8. Modo de control configurable

Desde `admin.html` se puede elegir entre dos modos:

- `Navegacion libre`
- `Boton Hecho`

#### Modo Navegacion libre

- Usa flechas y contador.
- Permite avanzar y retroceder manualmente.

#### Modo Boton Hecho

- Oculta flechas, contador y swipe.
- Muestra un boton `Hecho`.
- El boton muestra progreso de sesion con formato `Hecho X/N` cuando la sesion esta limitada por numero de frases.

### 9. Validacion por preguntas antes de avanzar

En modo `Boton Hecho`:

- Al pulsar `Hecho` aparece un popup con preguntas en forma de botones.
- Las preguntas se cargan desde `preguntas.json`.
- Cada pregunta tiene:

```json
{ "texto": "Hablar con respeto", "tipo": "positivo" }
```

- Reglas de validacion:
  - Todas las preguntas `positivo` deben marcarse.
  - Ninguna pregunta `negativo` debe marcarse.

- Si se marca una negativa, aparece un mensaje:
  - `Seguro que vas a hacer: ...`

- Si falta una positiva, aparece un mensaje:
  - `Seguro que no vas a hacer: ...`

- Solo si todo es correcto se pasa a la siguiente frase.

### 10. Frases realizadas y progreso persistente

- La app guarda en `localStorage`:
  - frases completadas por nina
  - posicion actual por nina

- Una frase se marca como realizada cuando:
  - el modo es `Boton Hecho`
  - y la validacion de preguntas se supera correctamente

- En `admin.html` se muestra:
  - resumen `X de Y frases realizadas`
  - lista de frases completadas de la nina activa

- Tambien existe un boton:
  - `Resetear progreso`

Este boton borra todo el progreso guardado y permite empezar de nuevo.

### 11. Sesiones limitadas por numero de frases

Desde `admin.html` se puede configurar:

- `Cuantas frases por sesion`

Funcionamiento:

- El enlace `Ir a frases` abre `index.html?count=N`.
- `index.html` prepara una sesion de `N` frases.
- Si hay frases pendientes, la sesion prioriza las no completadas.
- Si no quedan pendientes, usa frases del conjunto completo.
- El contador visual y el boton `Hecho X/N` reflejan el progreso de esa sesion.

### 12. Popup final de felicitacion

- Cuando se completan correctamente todas las frases de la sesion actual, aparece un popup final:
  - `Has completado todas las frases de esta sesion.`

## Configuracion disponible en admin

`admin.html` permite configurar todo esto:

- Mostrar u ocultar botones `A+ / A-`
- Forzar frase en mayusculas
- Ver tamano de letra guardado
- Ver numero de ninas en el JSON
- Elegir nina activa
- Elegir modo de control
- Elegir cuantas frases usar en una sesion
- Ver frases realizadas
- Resetear progreso
- Ir a la pantalla de frases con el tamano de sesion configurado

## Claves de localStorage

Estas claves estan centralizadas en `ls.js`:

- `rayitas.showFontControls`
- `rayitas.forcePhraseUppercase`
- `rayitas.fontSizeRem`
- `rayitas.activeGirlName`
- `rayitas.controlMode`
- `rayitas.phraseProgress`
- `rayitas.sessionPhraseCount`

### Estructura de `rayitas.phraseProgress`

```json
{
  "Lara": {
    "completedIndexes": [0, 1, 4],
    "currentIndex": 4
  },
  "Naia": {
    "completedIndexes": [2],
    "currentIndex": 2
  }
}
```

## Flujo recomendado de uso

1. Abrir `admin.html`.
2. Elegir la nina activa.
3. Configurar modo de control.
4. Configurar numero de frases por sesion.
5. Ajustar si se quieren mostrar botones de tamano.
6. Ajustar si se quiere forzar mayusculas.
7. Pulsar `Guardar`.
8. Pulsar `Ir a frases`.
9. Completar la sesion en `index.html`.
10. Volver a `admin.html` para revisar progreso o resetearlo.

## Limitaciones actuales

- La seleccion del lote de sesion no es aleatoria: toma primero frases pendientes y luego las primeras disponibles.
- Las frases solo se marcan como realizadas automaticamente en modo `Boton Hecho`.
- `Wake Lock API` depende del navegador y puede no estar disponible en todos los dispositivos.
- El modo de preguntas usa el mismo bloque de preguntas para cualquier frase de una misma nina.

## Apertura local

Para usar correctamente la carga de JSON, conviene abrir la carpeta con un servidor local simple en vez de abrir el HTML directamente con `file://`.

Ejemplo con Python:

```bash
cd /home/epiblas/Documentos/github_ssh/miniwebs/rayitas
python3 -m http.server 8000
```

Luego abrir en el navegador:

- `http://localhost:8000/admin.html`
- `http://localhost:8000/index.html`
