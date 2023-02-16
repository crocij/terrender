#version 300 es
precision highp float;

in vec3 objectColor;
in vec2 texCoord;
in vec2 coord;

// Limited Height colouring (uncomment 1/2)
// in float isWhite;

uniform sampler2D colorTexture;
uniform bool renderLod;
uniform bool isLoadingHeight;
uniform bool isLoadingColor;
uniform bool renderUniColor;
uniform vec4 uniColor;

layout(location = 0) out vec4 color;
layout(location = 1) out vec4 xCoord;
layout(location = 2) out vec4 yCoord;

@import ./includes/FloatToRgba;

void main() {
    color = texture(colorTexture, texCoord);
    if (renderLod) {
        color = vec4(objectColor, 1);
    } else if (isLoadingHeight && !isLoadingColor) {
        color.a = 0.5;
    } else if (isLoadingHeight && isLoadingColor) {
        color = vec4(0.2, 0.2, 0.2, 1.0);
    } else if (renderUniColor) {
        color = uniColor;
    }

    // Limited Height colouring (uncomment 2/2)
    // if (isWhite == 1.0) {
    //     color = vec4(0.0);
    // }

    xCoord = floatToRgba(coord.x);
    yCoord = floatToRgba(coord.y);
}