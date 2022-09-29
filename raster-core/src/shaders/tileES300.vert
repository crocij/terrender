#version 300 es
in vec2 vPlanarPosition;

uniform mat4 mvpMatrix;
uniform mat4 coordRotationMatrix;
uniform sampler2D heightTexture;
uniform float sideLengthOS;
uniform float heightScaling;
uniform float estMaxHeight;
uniform int lod;
uniform int maxLod;
uniform bool renderFlat;
uniform bool noHeightTexture;
uniform bool noColorTexture;

out vec3 objectColor;
out vec2 texCoord;

void main() {
    if (float(lod / 2) == float(lod) / 2.0) {
	    objectColor = vec3(0, 1.5 * (float(lod) + 1.0) / float(maxLod + 1), 0);
    } else {
        objectColor = vec3(1.5 * (float(lod) + 1.0) / float(maxLod + 1), 0, 0);
    }

    vec2 planarPosition = (coordRotationMatrix * vec4(vPlanarPosition, 0, 1)).xy;

    float height = 0.0;

    texCoord = (planarPosition + vec2(sideLengthOS / 2.0, sideLengthOS / 2.0)) * (1.0/sideLengthOS);

    texCoord.y = 1.0 - texCoord.y;
    
    // Make sure that we look up the texel in its center
    // texCoord = vec2(texCoord.x * (256.0 / 257.0) + (0.5/257.0), texCoord.y * (256.0 / 257.0) + (0.5/257.0));

    if (!noHeightTexture && !renderFlat) {
        vec4 rgba = texture(heightTexture, texCoord);
        height = max(rgba.x, 0.0) * heightScaling;
    }

    if (noColorTexture) {
        texCoord = vec2(0.5, height / (estMaxHeight * heightScaling));
    }

    // Uncomment this to check whether overlapping tiles are rendered
    // height = float(lod) * 5.0;

    vec3 finalPosition = vec3(planarPosition, height);

    gl_Position = mvpMatrix * vec4(finalPosition, 1.0);
}