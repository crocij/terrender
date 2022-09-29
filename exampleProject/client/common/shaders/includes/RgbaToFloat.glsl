// Source: https://stackoverflow.com/questions/63827836/is-it-possible-to-do-a-rgba-to-float-and-back-round-trip-and-read-the-pixels-in

// Decode a 32-bit float from the RGBA color channels of a texel.
float rgbaToFloat(vec4 v) {
  vec4 bits = v * 255.0;
  float sign = mix(-1.0, 1.0, step(bits[3], 128.0));
  float expo = floor(mod(bits[3] + 0.1, 128.0)) * 2.0 + floor((bits[2] + 0.1) / 128.0) - 127.0;
  float sig = bits[0] + bits[1] * 256.0 + floor(mod(bits[2] + 0.1, 128.0)) * 256.0 * 256.0;
  return sign * (1.0 + sig / 8388607.0) * pow(2.0, expo);
}