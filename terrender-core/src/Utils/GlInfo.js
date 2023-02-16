import * as twgl from 'twgl.js';

const tileFs = require('../shaders/tile.frag');
const tileVs = require('../shaders/tile.vert');
const tileES300Fs = require('../shaders/tileES300.frag');
const tileES300Vs = require('../shaders/tileES300.vert');
const tileCombinedES300Fs = require('../shaders/tileCombinedES300.frag');
const tileCombinedES300Vs = require('../shaders/tileCombinedES300.vert');
const pixelPosFs = require('../shaders/pixelPos.frag');
const pixelPosVs = require('../shaders/pixelPos.vert');
const frustumFs = require('../shaders/frustum.frag');
const frustumVs = require('../shaders/frustum.vert');
const frustumES300Fs = require('../shaders/frustumES300.frag');
const frustumES300Vs = require('../shaders/frustumES300.vert');

class GlInfo {
    #gl;
    #colorShader;
    #combinedShader;
    #pixelPosShader;
    #frustumShader;
    #isWebGL2;

    #canvasRenderTarget;
    #combinedRenderTarget;
    #pixelPosRenderTargetX;
    #pixelPosTextureX;
    #pixelPosRenderTargetY;
    #pixelPosTextureY;
    #prevPixelPosHeightX = 0;
    #prevPixelPosWidthX = 0;
    #prevPixelPosHeightY = 0;
    #prevPixelPosWidthY = 0;
    #colorRenderTarget;
    #colorTexture;
    #prevColorHeight = 0;
    #prevColorWidth = 0;

    /**
     * 
     * @param {WebGLRenderingContext|WebGL2RenderingContext} gl 
     */
    constructor(gl) {
        this.#gl = gl;
        this.#isWebGL2 = twgl.isWebGL2(this.#gl);

        // Enable float Textures via extension for WebGL1
        if (!this.#isWebGL2) {
            const float_texture_ext = this.#gl.getExtension('OES_texture_float');
            if (float_texture_ext === null) {
                console.error("Browser does not support FloatTextures")
            }

            const index_uint_ext = this.#gl.getExtension('OES_element_index_uint');
            if (index_uint_ext === null) {
                console.error("Browser does not support integers as indexes")
            }
        }

        this.#gl.enable(this.#gl.DEPTH_TEST);
        this.#gl.depthFunc(this.#gl.LESS);

        if (this.#isWebGL2) {
            this.#colorShader = twgl.createProgramInfo(this.#gl, [tileES300Vs, tileES300Fs]);
            this.#combinedShader = twgl.createProgramInfo(this.#gl, [tileCombinedES300Vs, tileCombinedES300Fs]);
            this.#frustumShader = twgl.createProgramInfo(this.#gl, [frustumES300Vs, frustumES300Fs]);
        } else {
            this.#colorShader = twgl.createProgramInfo(this.#gl, [tileVs, tileFs]);
            this.#pixelPosShader = twgl.createProgramInfo(this.#gl, [pixelPosVs, pixelPosFs]);
            this.#frustumShader = twgl.createProgramInfo(this.#gl, [frustumVs, frustumFs]);
        }
        this.#canvasRenderTarget = GlInfo.COLOR_RENDER_TARGET;
        this.#pixelPosRenderTargetX = null;
        this.#colorRenderTarget = null;
    }

    /**
     * 
     * @returns {WebGLRenderingContext|WebGL2RenderingContext}
     */
    getGl = () => {
        return this.#gl;
    }
    
    /**
     * 
     * @returns {twgl.ProgramInfo}
     */
    getColorShader = () => {
        return this.#colorShader;
    }

    /**
     * 
     * @returns {twgl.ProgramInfo}
     */
    getCombinedShader = () => {
        return this.#combinedShader;
    }

    /**
     * 
     * @returns {twgl.ProgramInfo}
     */
    getPixelPosShader = () => {
        return this.#pixelPosShader;
    }

    /**
     * 
     * @returns {twgl.ProgramInfo}
     */
    getFrustumShader = () => {
        return this.#frustumShader;
    }

    /**
     * 
     * @returns {Boolean}
     */
    isWebGL2 = () => {
        return this.#isWebGL2;
    }

    /**
     * Set the render target 
     * @param {String} target 
     */
    setCanvasRenderTarget = (target) => {
        if (target &&
            target !== GlInfo.COLOR_RENDER_TARGET &&
            target !== GlInfo.PIXEL_POS_RENDER_TARGETX &&
            target !== GlInfo.PIXEL_POS_RENDER_TARGETY &&
            target !== GlInfo.COMBINED_RENDER_TARGET
        ) {
            console.error('Unknown render target: ' + target);
            return;
        }
        this.#canvasRenderTarget = target;
    }

    /**
     * 
     * @returns {Boolean}
     */
    isColorCanvasRenderTarget = () => {
        return this.#canvasRenderTarget === GlInfo.COLOR_RENDER_TARGET;
    }

    /**
     * 
     * @returns {Boolean}
     */
    isPixelPosCanvasRenderTargetX = () => {
        return this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETX;
    }

    /**
     * 
     * @returns {Boolean}
     */
    isPixelPosCanvasRenderTargetY = () => {
        return this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETY;
    }

    /**
     * 
     * @returns {Boolean}
     */
    isCombinedCanvasRenderTarget = () => {
        return this.#canvasRenderTarget === GlInfo.COMBINED_RENDER_TARGET;
    }

    /**
     * Recreate the color render target if the dimension of the canvas changed
     */
    recreateColorRenderTarget = () => {
        if (this.#gl.canvas.height === this.#prevColorHeight && this.#gl.canvas.width === this.#prevColorWidth) {
            return;
        }

        if (this.#canvasRenderTarget === GlInfo.COLOR_RENDER_TARGET) {
            this.setCanvasRenderTarget(null);
        }

        this.#prevColorHeight = this.#gl.canvas.height;
        this.#prevColorWidth = this.#gl.canvas.width;

        this.#colorTexture = twgl.createTexture(this.#gl, {
            height: this.#gl.canvas.height,
            width: this.#gl.canvas.width,
            format: this.#gl.RGBA,
            minMag: this.#gl.LINEAR,
        });

        this.#colorRenderTarget = this.#gl.createFramebuffer();
        this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#colorRenderTarget);
        this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT0, this.#gl.TEXTURE_2D, this.#colorTexture, 0);

        // Add Depth buffer
        const depthBuffer = this.#gl.createRenderbuffer();
        this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, depthBuffer);
        this.#gl.renderbufferStorage(this.#gl.RENDERBUFFER, this.#gl.DEPTH_COMPONENT16, this.#prevColorWidth, this.#prevColorHeight);
        this.#gl.framebufferRenderbuffer(this.#gl.FRAMEBUFFER, this.#gl.DEPTH_ATTACHMENT, this.#gl.RENDERBUFFER, depthBuffer);
    }

    /**
     * Recreate the combined render targets if the canvas size changed and the webGL version is 2
     */
    recreateCombinedRenderTargets = () => {
        if (!this.#isWebGL2) {
            console.warn('Multiple Target Textures are only supported in WebGL2')
            return;
        }

        if (!this.#combinedRenderTarget) {
            this.#combinedRenderTarget = this.#gl.createFramebuffer();
        }

        this.setCanvasRenderTarget(null);

        this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#combinedRenderTarget);

        // Create Color
        if (this.#gl.canvas.height !== this.#prevColorHeight || this.#gl.canvas.width !== this.#prevColorWidth || !this.#colorTexture) {
            this.#prevColorHeight = this.#gl.canvas.height;
            this.#prevColorWidth = this.#gl.canvas.width;

            this.#colorTexture = twgl.createTexture(this.#gl, {
                height: this.#gl.canvas.height,
                width: this.#gl.canvas.width,
                format: this.#gl.RGBA,
                minMag: this.#gl.NEAREST,
            });
            this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT0, this.#gl.TEXTURE_2D, this.#colorTexture, 0);
        }

        // Create Pos X
        if (this.#gl.canvas.height !== this.#prevPixelPosHeightX || this.#gl.canvas.width !== this.#prevPixelPosWidthX || !this.#pixelPosTextureX) {
            this.#prevPixelPosHeightX = this.#gl.canvas.height;
            this.#prevPixelPosWidthX = this.#gl.canvas.width;

            this.#pixelPosTextureX = twgl.createTexture(this.#gl, {
                height: this.#gl.canvas.height,
                width: this.#gl.canvas.width,
                format: this.#gl.RGBA,
                minMag: this.#gl.NEAREST,
            });
            this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT1, this.#gl.TEXTURE_2D, this.#pixelPosTextureX, 0);
        }

        // Create Pos Y
        if (this.#gl.canvas.height !== this.#prevPixelPosHeightY || this.#gl.canvas.width !== this.#prevPixelPosWidthY || !this.#pixelPosTextureY) {
            this.#prevPixelPosHeightY = this.#gl.canvas.height;
            this.#prevPixelPosWidthY = this.#gl.canvas.width;

            this.#pixelPosTextureY = twgl.createTexture(this.#gl, {
                height: this.#gl.canvas.height,
                width: this.#gl.canvas.width,
                format: this.#gl.RGBA,
                minMag: this.#gl.NEAREST,
            });
            this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT2, this.#gl.TEXTURE_2D, this.#pixelPosTextureY, 0);
        }

        this.#gl.drawBuffers([
            this.#gl.COLOR_ATTACHMENT0,
            this.#gl.COLOR_ATTACHMENT1,
            this.#gl.COLOR_ATTACHMENT2,
        ]);

        // Add Depth buffer
        const depthBuffer = this.#gl.createRenderbuffer();
        this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, depthBuffer);
        this.#gl.renderbufferStorage(this.#gl.RENDERBUFFER, this.#gl.DEPTH_COMPONENT16, this.#prevColorWidth, this.#prevColorHeight);
        this.#gl.framebufferRenderbuffer(this.#gl.FRAMEBUFFER, this.#gl.DEPTH_ATTACHMENT, this.#gl.RENDERBUFFER, depthBuffer);
    }

    /**
     * Recreate the pixel position render targets when the canvas size changed
     */
    recreatePixelPosRenderTarget = () => {
        this.recreatePixelPosRenderTargetX();
        this.recreatePixelPosRenderTargetY();
    }

    /**
     * Recreate the X pixel position render target when the canvas size changed
     */
    recreatePixelPosRenderTargetX = () => {
        if (this.#gl.canvas.height === this.#prevPixelPosHeightX && this.#gl.canvas.width === this.#prevPixelPosWidthX && this.#pixelPosRenderTargetX) {
            return;
        }

        this.#prevPixelPosWidthX = this.#gl.canvas.width;
        this.#prevPixelPosHeightX = this.#gl.canvas.height;

        if (this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETX) {
            this.setCanvasRenderTarget(null);
        }

        this.#pixelPosTextureX = twgl.createTexture(this.#gl, {
            height: this.#gl.canvas.height,
            width: this.#gl.canvas.width,
            format: this.#gl.RGBA,
            minMag: this.#gl.NEAREST,
        });

        this.#pixelPosRenderTargetX = this.#gl.createFramebuffer();
        this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#pixelPosRenderTargetX);
        this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT0, this.#gl.TEXTURE_2D, this.#pixelPosTextureX, 0);

        // Add Depth buffer
        const depthBuffer = this.#gl.createRenderbuffer();
        this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, depthBuffer);
        this.#gl.renderbufferStorage(this.#gl.RENDERBUFFER, this.#gl.DEPTH_COMPONENT16, this.#prevPixelPosWidthX, this.#prevPixelPosHeightX);
        this.#gl.framebufferRenderbuffer(this.#gl.FRAMEBUFFER, this.#gl.DEPTH_ATTACHMENT, this.#gl.RENDERBUFFER, depthBuffer);
    }

    /**
     * Recreate the Y pixel position render target when the canvas size changed
     */
    recreatePixelPosRenderTargetY = () => {
        if (this.#gl.canvas.height === this.#prevPixelPosHeightY && this.#gl.canvas.width === this.#prevPixelPosWidthY && this.#pixelPosRenderTargetY) {
            return;
        }

        this.#prevPixelPosWidthY = this.#gl.canvas.width;
        this.#prevPixelPosHeightY = this.#gl.canvas.height;

        if (this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETY) {
            this.setCanvasRenderTarget(null);
        }

        this.#pixelPosTextureY = twgl.createTexture(this.#gl, {
            height: this.#gl.canvas.height,
            width: this.#gl.canvas.width,
            format: this.#gl.RGBA,
            minMag: this.#gl.NEAREST,
        });

        this.#pixelPosRenderTargetY = this.#gl.createFramebuffer();
        this.#gl.bindFramebuffer(this.#gl.FRAMEBUFFER, this.#pixelPosRenderTargetY);
        this.#gl.framebufferTexture2D(this.#gl.FRAMEBUFFER, this.#gl.COLOR_ATTACHMENT0, this.#gl.TEXTURE_2D, this.#pixelPosTextureY, 0);

        // Add Depth buffer
        const depthBuffer = this.#gl.createRenderbuffer();
        this.#gl.bindRenderbuffer(this.#gl.RENDERBUFFER, depthBuffer);
        this.#gl.renderbufferStorage(this.#gl.RENDERBUFFER, this.#gl.DEPTH_COMPONENT16, this.#prevPixelPosWidthY, this.#prevPixelPosHeightY);
        this.#gl.framebufferRenderbuffer(this.#gl.FRAMEBUFFER, this.#gl.DEPTH_ATTACHMENT, this.#gl.RENDERBUFFER, depthBuffer);
    }

    /**
     * @returns {WebGLFramebuffer|null}
     */
    getColorRenderTarget = () => {
        return this.#canvasRenderTarget === GlInfo.COLOR_RENDER_TARGET ? null : this.#colorRenderTarget;
    }

    /**
     * @returns {WebGLFramebuffer|null}
     */
    getCombinedRenderTarget = () => {
        return this.#combinedRenderTarget;
    }

    /**
     * @returns {WebGLFramebuffer|null}
     */
    getPixelPosRenderTargetX = () => {
        return this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETX ? null : this.#pixelPosRenderTargetX;
    }

    /**
     * @returns {WebGLFramebuffer|null}
     */
    getPixelPosRenderTargetY = () => {
        return this.#canvasRenderTarget === GlInfo.PIXEL_POS_RENDER_TARGETY ? null : this.#pixelPosRenderTargetY;
    }

    /**
     * @returns {WebGLTexture|null}
     */
    getColorTexture = () => {
        return this.#colorTexture;
    }

    /**
     * @returns {WebGLTexture|null}
     */
    getPixelPosTextureX = () => {
        return this.#pixelPosTextureX;
    }

    /**
     * @returns {WebGLTexture|null}
     */
    getPixelPosTextureY = () => {
        return this.#pixelPosTextureY;
    }


    static COLOR_RENDER_TARGET = 'color';
    static PIXEL_POS_RENDER_TARGETX = 'pixelPosX';
    static PIXEL_POS_RENDER_TARGETY = 'pixelPosY';
    static COMBINED_RENDER_TARGET = 'combined';

    // Expose both constants outside of terrender-core via instances object
    get COLOR_RENDER_TARGET() {
        return GlInfo.COLOR_RENDER_TARGET;
    }

    get PIXEL_POS_RENDER_TARGETX() {
        return GlInfo.PIXEL_POS_RENDER_TARGETX;
    }

    get PIXEL_POS_RENDER_TARGETY() {
        return GlInfo.PIXEL_POS_RENDER_TARGETY;
    }

    get COMBINED_RENDER_TARGET() {
        return GlInfo.COMBINED_RENDER_TARGET;
    }
}

export default GlInfo;