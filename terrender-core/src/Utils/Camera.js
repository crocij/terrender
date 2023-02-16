import * as twgl from 'twgl.js';
const m4 = twgl.m4;
const v3 = twgl.v3;

const FOV = Math.PI / 2;

class Camera {
    #up;
    #target;
    #position;
    #initialUp;
    #fov

    /**
     * 
     * @param {array} initialPos 
     * @param {array} target 
     * @param {array} up 
     * @param {Terrender} terrender 
     */
    constructor(initialPos, target, up, terrender) {
        this.lastUpdate = undefined;
        this.clippingPlanes = [];
        this.gl = terrender.getGlInfo().getGl();
        this.#fov = FOV;

        this.lookAt(initialPos, target, up);
        this.initialUp = up;
        this.terrender = terrender;
        this.loadingState = terrender.getLoadingState();
        this.calculateMatrices();
    }

    /**
     * Right Vector of the current camera configuration
     * @type {Array.<Number>}
     */
    get right() {
        return v3.normalize(v3.cross(this.viewDirection, this.up));
    }
    
    /**
     * View direction of the current camera configuration
     * @type {Array.<Number>}
     */
    get viewDirection() {
        return v3.normalize(v3.subtract(this.target, this.position));
    }

    /**
     * Up vector of the current camera configuration
     * @type {Array.<Number>}
     */
    get up() {
        return this.#up;
    }
    
    set up(val) {
        this.#up = val;
        this.updated();
    }

    /**
     * Target of the current camera configuration
     * @type {Array.<Number>}
     */
    get target() {
        return this.#target;
    }
    
    set target(val) {
        this.#target = val;
        this.updated();
    }

    /**
     * Position vector of the current camera configuration
     * @type {Array.<Number>}
     */
    get position() {
        return this.#position;
    }
    
    set position(val) {
        this.#position = val;
        this.updated();
    }

    /**
     * Initial up vector of the current camera configuration
     * @type {Array.<Number>}
     */
    get initialUp() {
        return this.#initialUp;
    }
    
    set initialUp(val) {
        this.#initialUp = val;
        this.updated();
    }

    /**
     * Current horizontal field of view
     * @returns {Number}
     */
    getFOV() {
        return this.#fov;
    }

    /**
     * Current verticla field of view
     * @returns {Number}
     */
    getVFOV() {
        return 2 * Math.atan(Math.tan(this.#fov / 2) * this.gl.canvas.height / this.gl.canvas.width);
    }

    /**
     * Returns the value of the changed flag and resets it to false
     * @returns {Boolean}
     */
    hasChanged = () => {
        let hasChanged = this.changed;
        this.changed = false;
        return hasChanged;
    }

    /**
     * Returns true if the grid should be updated now and resets the flag
     * @returns {Boolean}
     */
    shouldUpdate = () => {
        if (this.updateNext && (!this.loadingState.isLoading())) {
            this.updateNext = false;
            return true;
        }
        return false;
    }

    /**
     * Set the flags to indicate that the camera changed
     */
    updated = () => {
        this.updateNext = true;
        this.changed = true;
    }

    /**
     * Set the target and position of the camera
     * @param {Array.<Number>} position 
     * @param {Array.<Number>} target 
     */
    changeCamPosition = (position, target) => {
        this.lookAt(position, target, this.initialUp);
    }

    /**
     * Set the parameters of the camera, will set the update flags
     * @param {Array.<Number>} position 
     * @param {Array.<Number>} target 
     * @param {Array.<Number>} up 
     */
    lookAt = (position, target, up) => {
        this.position = position;
        this.target = target;
        let right = v3.cross(this.viewDirection, up);
        this.up = v3.normalize(v3.cross(right, this.viewDirection));
        // this.up = up;
        this.calculateMatrices();
        this.updated();
    }

    /**
     * Calculate the matrices for the current camera configurations and the clipping planes
     */
    calculateMatrices = () => {
        this.viewMatrix = m4.inverse(m4.lookAt(this.position, this.target, this.up));
        this.projectionMatrix = m4.perspective(this.#fov, this.gl.canvas.width / this.gl.canvas.height, 0.01, 1000);
        this.viewProjectionMatrix = m4.multiply(this.projectionMatrix, this.viewMatrix);
        this.inverseViewProjectionMatrix = m4.inverse(this.viewProjectionMatrix);

        let pointFrontLowerLeft = m4.transformPoint(this.inverseViewProjectionMatrix, [-1.0, -1.0, -1.0]);
        let pointFrontUpperLeft = m4.transformPoint(this.inverseViewProjectionMatrix, [-1.0, 1.0, -1.0]);
        let pointFrontLowerRight = m4.transformPoint(this.inverseViewProjectionMatrix, [1.0, -1.0, -1.0]);
        let pointFrontUpperRight = m4.transformPoint(this.inverseViewProjectionMatrix, [1.0, 1.0, -1.0]);
        let pointBackUpperLeft = m4.transformPoint(this.inverseViewProjectionMatrix, [-1.0, 1.0, 0.0]);
        let pointBackLowerRight = m4.transformPoint(this.inverseViewProjectionMatrix, [1.0, -1.0, 0.0]);

        let vecMiddleUpperLeft = v3.subtract(pointBackUpperLeft, pointFrontUpperLeft);
        let vecMiddleLowerRight = v3.subtract(pointBackLowerRight, pointFrontLowerRight);
        let vecFrontTop = v3.subtract(pointFrontUpperRight, pointFrontUpperLeft);
        let vecFrontRight = v3.subtract(pointFrontLowerRight, pointFrontUpperRight);
        let vecFrontBottom = v3.subtract(pointFrontLowerLeft, pointFrontLowerRight);
        let vecFrontLeft = v3.subtract(pointFrontUpperLeft, pointFrontLowerLeft);

        this.clippingPlanes = [
            {normal: v3.normalize(v3.cross(vecMiddleUpperLeft, vecFrontTop)), p: pointFrontUpperLeft}, // Top
            {normal: v3.normalize(v3.cross(vecMiddleLowerRight, vecFrontBottom)), p: pointFrontLowerRight}, // Bottom
            {normal: v3.normalize(v3.cross(vecMiddleLowerRight, vecFrontRight)), p: pointFrontUpperRight}, // Right
            {normal: v3.normalize(v3.cross(vecMiddleUpperLeft, vecFrontLeft)), p: pointFrontUpperLeft}, // Left
            {normal: v3.normalize(v3.subtract(this.target, this.position)), p: pointFrontLowerRight} // Front
        ]
    }

    /**
     * Save the current view frustum in world space and create its vertex buffer
     */
    saveViewFrustum = () => {
        let vertices = [
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [-1, -1, -1]), // Front Lower Left
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [-1, 1, -1]), // Front Upper Left
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [1, 1, -1]), // Front Upper Right
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [1, -1, -1]), // Front Lower Right
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [-1, -1, 1]), // Back Lower Left
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [-1, 1, 1]), // Back Upper Left
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [1, 1, 1]), // Back Upper Right
            ...m4.transformPoint(this.inverseViewProjectionMatrix, [1, -1, 1]), // Back Lower Right
        ]

        let indices = new Uint32Array([
            0, 1,
            1, 2,
            2, 3,
            3, 0,

            0, 4,
            1, 5,
            2, 6,
            3, 7,
            
            4, 5,
            5, 6,
            6, 7,
            7, 5,
        ]);

        this.frustumVBO = twgl.createBufferInfoFromArrays(this.gl, {
            vPosition: vertices,
            indices: indices
        });
    }

    /**
     * Render the currently saved view frustum if the update on camera change is disabled, e.g. render the frustum related to the last triangulation of the terrain
     */
    renderViewFrustum = () => {
        if (!this.terrender.getParameters().disableUpdateOnCam || !this.frustumVBO) {
            return;
        }

        let programInfo = this.terrender.getGlInfo().getFrustumShader()
        this.gl.useProgram(programInfo.program);
        twgl.setBuffersAndAttributes(this.gl, programInfo, this.frustumVBO);
        this.gl.lineWidth(5)

        const uniforms = {
            vpMatrix: this.viewProjectionMatrix,
        }

        twgl.setUniforms(programInfo, uniforms);
        this.gl.drawElements(
            this.gl.LINES,
            this.frustumVBO.numElements,
            this.gl.UNSIGNED_INT,
            0
        );
        this.gl.lineWidth(1);
    }
}

export default Camera