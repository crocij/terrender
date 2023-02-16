precision highp float;

uniform bool renderXCoord;

varying vec2 coord;

@import ./includes/FloatToRgba;

void main() {
    if (renderXCoord) {
        gl_FragColor = floatToRgba(coord.x);
    } else {
        gl_FragColor = floatToRgba(coord.y);
    }
}