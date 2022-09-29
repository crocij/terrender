attribute vec2 vPlanarPosition;

uniform mat4 mvpMatrix;
uniform mat4 coordRotationMatrix;
uniform mat4 modelMatrix;
uniform sampler2D heightTexture;
uniform float sideLengthOS;
uniform float heightScaling;
uniform bool noHeightTexture;
uniform bool renderFlat;

varying vec2 coord;

@import ./includes/RgbaToFloat;

void main() {

    vec2 planarPosition = (coordRotationMatrix * vec4(vPlanarPosition, 0, 1)).xy;

    float height = 0.0;

    if (!noHeightTexture && !renderFlat) {
        vec2 texCoord = (planarPosition + vec2(sideLengthOS / 2.0, sideLengthOS / 2.0)) * (1.0/sideLengthOS);
        texCoord.y = 1.0 - texCoord.y;

        // Make sure that we look up the texel in its center
        texCoord = vec2(texCoord.x * (256.0 / 257.0) + (0.5/257.0), texCoord.y * (256.0 / 257.0) + (0.5/257.0));
        vec4 rgba = texture2D(heightTexture, texCoord);
        height = max(rgbaToFloat(rgba), 0.0) * heightScaling;
    }
    vec3 finalPosition = vec3(planarPosition, height);
    coord = (modelMatrix * vec4(finalPosition, 1.0)).xy;
    gl_Position = mvpMatrix * vec4(finalPosition, 1.0);
}