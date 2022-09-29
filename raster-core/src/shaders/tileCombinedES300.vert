#version 300 es
in vec2 vPlanarPosition;

uniform mat4 modelMatrix;
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
out vec2 coord;

// Limited Height colouring (uncomment 1/3)
// out float isWhite;

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

    // Limited Height colouring (uncomment 2/3)
    // isWhite = 0.0;
    
    // Make sure that we look up the texel in its center
    // texCoord = vec2(texCoord.x * (256.0 / 257.0) + (0.5/257.0), texCoord.y * (256.0 / 257.0) + (0.5/257.0));

    if (!noHeightTexture && !renderFlat) {
        vec4 rgba = texture(heightTexture, texCoord);
        height = max(rgba.x, 0.0) * heightScaling;
    }

    if (noColorTexture) {
        texCoord = vec2(0.5, height / (estMaxHeight * heightScaling));

        // Limited Height colouring (uncomment 3/3)
        // float realHeight = height / heightScaling;
        // if (realHeight < 0.0) {
        //     texCoord = vec2(0.5, 0.0);
        //     // height = 0.0;
        //     // isWhite = 1.0;
        // } else if(realHeight > 1500.0) {
        //     texCoord = vec2(0.5, 1.0);
        // } else {
        //     realHeight = (realHeight - 0.0) / 1500.0;
        //     texCoord = vec2(0.5, realHeight);
        // }
    }

    // Uncomment this to check whether overlapping tiles are rendered
    // height = float(lod) * 5.0;

    vec3 finalPosition = vec3(planarPosition, height);
    coord = (modelMatrix * vec4(finalPosition, 1.0)).xy;

    gl_Position = mvpMatrix * vec4(finalPosition, 1.0);
}