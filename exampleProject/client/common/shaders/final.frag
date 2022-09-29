precision highp float;

uniform sampler2D colorTexture;
uniform sampler2D pixelPosTextureX;
uniform sampler2D pixelPosTextureY;

uniform sampler2D linesTexture;
uniform sampler2D bucketsTexture;
uniform int linesLength;

uniform vec4 boundaries;
uniform vec2 bucketDimensions;
uniform int maxLinesBucket;

uniform bool renderCurrentLine;
uniform vec2 currentLineP1;
uniform vec2 currentLineP2;
uniform float currentLineWidth;
uniform vec4 currentLineColor;

varying vec2 texCoord;

@import ./includes/RgbaToFloat;

bool isOnLine(vec2 realWorldPos, vec2 p1, vec2 p2, float lineWidth) {

    // Check if the point is close to the line
    float diffX = p2.x - p1.x;
    float diffY = p2.y - p1.y;

    float distToLine = abs(diffX * (p1.y - realWorldPos.y) - (p1.x - realWorldPos.x) * diffY) / sqrt(diffX * diffX + diffY * diffY);

    // Point lays close to line 
    if (distToLine < lineWidth) {
        float maxDist = sqrt(pow(sqrt(diffX * diffX + diffY * diffY), 2.0) + lineWidth * lineWidth);
        float distP1 = sqrt(pow(p1.x - realWorldPos.x, 2.0) + pow(p1.y - realWorldPos.y, 2.0));
        float distP2 = sqrt(pow(p2.x - realWorldPos.x, 2.0) + pow(p2.y - realWorldPos.y, 2.0));
        if ((distP1 <= maxDist && distP2 <= maxDist) || distP1 < lineWidth || distP2 < lineWidth) {
            return true;
        }
    }
    return false;
}

float getBucketIndex(vec2 worldPos) {
    float bucketLengthX = (boundaries.z - boundaries.x) / bucketDimensions.x;
    float bucketLengthY = (boundaries.w - boundaries.y) / bucketDimensions.y;
    float indexX = floor((worldPos.x - boundaries.x) / bucketLengthX);
    float indexY = floor((worldPos.y - boundaries.y) / bucketLengthY);
    return indexY * bucketDimensions.x + indexX;
}

void main() {
    gl_FragColor = texture2D(colorTexture, texCoord);

    if (gl_FragColor.a == 1.0) {
        float xCoord = rgbaToFloat(texture2D(pixelPosTextureX, texCoord));  
        float yCoord = rgbaToFloat(texture2D(pixelPosTextureY, texCoord));
        vec2 worldPos = vec2(xCoord, yCoord);

        // Check Lines from texture
        if (linesLength > 0) {
            float offsetHeightBuckets = 1.0 / (bucketDimensions.x * bucketDimensions.y);
            float offsetWidthBuckets = 1.0 / float(maxLinesBucket);
            float bucketIndex = (getBucketIndex(worldPos) + 0.5) * offsetHeightBuckets;

            float offsetHeightLines = 1.0 / 6.0;
            float offsetWidthLines = 1.0 / float(linesLength);

            // WebGl does not allow dynamically number loop iterations, however it does allow breaks
            for (int i = 0; i < 30000; i++) {
                float lineIndex = rgbaToFloat(texture2D(bucketsTexture, vec2((float(i) + 0.5) * offsetWidthBuckets, bucketIndex)));

                if (lineIndex < 0.0 || i >= maxLinesBucket) break;
                float indexWidth = (lineIndex + 0.5) * offsetWidthLines;
                float p1x = rgbaToFloat(texture2D(linesTexture, vec2(indexWidth, 0.5 * offsetHeightLines)));
                float p1y = rgbaToFloat(texture2D(linesTexture, vec2(indexWidth, 1.5 * offsetHeightLines)));
                float p2x = rgbaToFloat(texture2D(linesTexture, vec2(indexWidth, 2.5 * offsetHeightLines)));
                float p2y = rgbaToFloat(texture2D(linesTexture, vec2(indexWidth, 3.5 * offsetHeightLines)));
                float width = rgbaToFloat(texture2D(linesTexture, vec2(indexWidth, 4.5 * offsetHeightLines)));
                if (isOnLine(worldPos, vec2(p1x, p1y), vec2(p2x, p2y), width)) {
                    gl_FragColor = texture2D(linesTexture, vec2(indexWidth, 5.5 * offsetHeightLines));
                    break;
                }
            }
        }

        // Check currently drawn line
        if (renderCurrentLine && isOnLine(worldPos, currentLineP1, currentLineP2, currentLineWidth)) {
            gl_FragColor = currentLineColor / 255.0;
        }
    }
}