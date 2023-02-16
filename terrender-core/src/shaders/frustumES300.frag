#version 300 es
precision highp float;

layout(location = 0) out vec4 color;
layout(location = 1) out vec4 xCoord;
layout(location = 2) out vec4 yCoord;

void main() {
    color = vec4(1.0, 0.0, 0.0, 1.0);
    xCoord = vec4(0.0, 0.0, 0.0, 0.0);
    yCoord = vec4(0.0, 0.0, 0.0, 0.0);
}