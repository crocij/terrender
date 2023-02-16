attribute vec3 vPosition;

uniform mat4 vpMatrix;

void main() {
    gl_Position = vpMatrix * vec4(vPosition, 1.0);
}