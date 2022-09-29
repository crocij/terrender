#version 300 es
in vec2 vPlanarPosition;

out vec2 texCoord;

void main() {
    texCoord = (vPlanarPosition + vec2(1.0, 1.0)) * 0.5;
    gl_Position = vec4(vPlanarPosition, 0.0, 1.0);
}