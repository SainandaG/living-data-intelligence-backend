// Vertex Shader
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}

// Fragment Shader
uniform float time;
uniform vec3 color;
uniform float speed;
varying vec2 vUv;

void main() {
    float dash = sin(vUv.x * 20.0 - time * speed) * 0.5 + 0.5;
    gl_FragColor = vec4(color, dash);
}
