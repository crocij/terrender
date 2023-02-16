import * as twgl from 'twgl.js';

/**
 * @type {GradientTexture}
 */
let instance;

/**
 * Singleton containing a gradient texture for coloring based on height
 */
class GradientTexture {

    /**
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     * @returns {GradientTexture}
     */
    static getGradientTexture(gl) {
        if (!instance) {
            instance = new GradientTexture(gl);
        }

        return instance;
    }

    /**
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    constructor(gl) {
        this.gl = gl;
        this.setUpTexture()
    }

    /**
     * Create the texture
     */
    setUpTexture = () => {
        this.texture = twgl.createTexture(
            this.gl,
            {
                src: [
                    175, 0, 0, 255,
                    175, 175, 0, 255,
                    0, 175, 0, 255,
                    0, 175, 175, 255,
                    0, 0, 175, 255,
                ],
                format: this.gl.RGBA,
                height: 5,
                minMag: this.gl.LINEAR,
                wrap: this.gl.CLAMP_TO_EDGE,
            }
        )
    }
}

export default GradientTexture;