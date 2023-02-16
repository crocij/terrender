#version 300 es
precision highp float;

in vec3 objectColor;
in vec2 texCoord;

uniform sampler2D colorTexture;
uniform bool renderLod;
uniform bool isLoadingHeight;
uniform bool isLoadingColor;
uniform bool renderUniColor;
uniform vec4 uniColor;

out vec4 color;

void main() {
    color = texture(colorTexture, texCoord);
    if (renderLod) {
        color = vec4(objectColor, 1);
    } else if (isLoadingHeight && !isLoadingColor) {
        color.a = 0.5;
    } else if (isLoadingHeight && isLoadingColor) {
        color = vec4(0.2, 0.2, 0.2, 1);
    } else if (renderUniColor) {
        color = uniColor;
    }
}