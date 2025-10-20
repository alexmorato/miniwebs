const canvas = document.getElementById('flagCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext('webgl');

if (!gl) {
    console.error('WebGL no está disponible en tu navegador.');
}

// Vertex Shader
const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    uniform float u_time;
    varying vec2 v_texCoord;
    void main() {
        // Aplicar un efecto de onda a la coordenada Y
        float wave = sin(u_time + a_position.x * 5.0) * 0.1;
        gl_Position = vec4(a_position.x, a_position.y + wave, a_position.z, 1.0);
        v_texCoord = a_texCoord; // Pasar las coordenadas de textura al fragment shader
    }
`;

// Fragment Shader
const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord); // Usar la textura
    }
`;

// Función para compilar shaders
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error al compilar el shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

// Compilar Shaders
const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

if (!vertexShader || !fragmentShader) {
    console.error('Error al compilar los shaders.');
}

// Crear y enlazar el programa
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Error al enlazar el programa:', gl.getProgramInfoLog(program));
}

gl.useProgram(program);

// Configurar el buffer de vértices
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// Crear una malla de vértices para la bandera
const segments = 100; // Número de subdivisiones a lo largo del eje X
const positions = [];
const texCoords = [];
for (let i = 0; i <= segments; i++) {
    const x = -0.5 + (i / segments) * 1.0; // Coordenada X entre -0.5 y 0.5
    const u = i / segments; // Coordenada U de textura entre 0 y 1
    positions.push(x, -0.5); // Vértice inferior
    positions.push(x, 0.5);  // Vértice superior
    texCoords.push(u, 0.0);  // Coordenada de textura inferior
    texCoords.push(u, 1.0);  // Coordenada de textura superior
}
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

// Configurar el buffer de coordenadas de textura
const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);

// Habilitar y configurar el atributo de posición
const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(positionAttributeLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// Habilitar y configurar el atributo de coordenadas de textura
const texCoordAttributeLocation = gl.getAttribLocation(program, 'a_texCoord');
gl.enableVertexAttribArray(texCoordAttributeLocation);
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// Obtener la ubicación de la variable uniforme de tiempo
const timeUniformLocation = gl.getUniformLocation(program, 'u_time');

// Crear y cargar la textura
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// Cargar una imagen como textura
const image = new Image();
image.src = './texturaroja.jpg'; // Cambia 'texture.jpg' por la ruta de tu imagen
image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Configurar la textura
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
};

// Variable para controlar la visibilidad del rectángulo
let isVisible = false;

// Evento de clic para alternar la visibilidad
canvas.addEventListener('click', () => {
    isVisible = !isVisible; // Alternar visibilidad
});

// Función de renderizado
let time = 0;
function render() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (isVisible) {
        gl.uniform1f(timeUniformLocation, time);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, positions.length / 2);
    }

    time += 0.13; // Incrementar el tiempo para animar la bandera

    requestAnimationFrame(render);
}

// Iniciar la animación
render();