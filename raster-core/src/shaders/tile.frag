precision highp float;

varying vec3 objectColor;
varying vec2 texCoord;

uniform sampler2D colorTexture;
uniform bool renderLod;
uniform bool isLoadingHeight;
uniform bool isLoadingColor;
uniform bool renderUniColor;
uniform vec4 uniColor;

void main() {
    gl_FragColor = texture2D(colorTexture, texCoord);
    if (renderLod) {
        gl_FragColor = vec4(objectColor, 1);
    } else if (isLoadingHeight && !isLoadingColor) {
        gl_FragColor.a = 0.5;
    } else if (isLoadingHeight && isLoadingColor) {
        gl_FragColor = vec4(0.2, 0.2, 0.2, 1);
    } else if (renderUniColor) {
        gl_FragColor = uniColor;
    }
}