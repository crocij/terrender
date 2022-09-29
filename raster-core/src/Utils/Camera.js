import * as twgl from 'twgl.js';
import Raster from '../Raster';
const m4 = twgl.m4;
const v3 = twgl.v3;

// TODO: Resolve position of move events more resilient, see ->https://dustinpfister.github.io/2020/02/20/canvas-keyboard/

const FOV = Math.PI / 6;

class Camera {
    #controlActive = true;
    #topDownMode = false;

    /**
     * 
     * @param {array} initialPos 
     * @param {array} target 
     * @param {array} up 
     * @param {Raster} raster 
     * @param {object} config 
     */
    constructor(initialPos, target, up, raster, config = {}) {
        const {sensitivity = 0.002, positionFactor = 0.005} = config;
        this.sensitivity = sensitivity;
        this.positionFactor = positionFactor
        this.lastUpdate = undefined;
        this.clippingPlanes = [];

        this.lookAt(initialPos, target, up);
        this.initialUp = up;
        this.gl = raster.getGlInfo().getGl();
        this.raster = raster;
        this.loadingState = raster.getLoadingState();
        this.calculateMatrices();

        // Register Listeners
        this.gl.canvas.addEventListener('mousedown', this.pointerDown);
        this.gl.canvas.addEventListener('mouseup', this.pointerUp);
        this.gl.canvas.addEventListener('mousemove', this.pointerMove);
        this.gl.canvas.addEventListener('mouseleave', this.pointerLeave);
        this.gl.canvas.addEventListener('contextmenu', this.pointerClick);
        this.gl.canvas.addEventListener('wheel', this.wheel);

        this.gl.canvas.addEventListener('touchstart', this.touchStart);
        this.gl.canvas.addEventListener('touchmove', this.touchMove);
        this.gl.canvas.addEventListener('touchend', this.touchCancel);
    }

    get right() {
        return v3.normalize(v3.cross(this.viewDirection, this.up));
    }

    get viewDirection() {
        return v3.normalize(v3.subtract(this.target, this.position));
    }

    setControlActive = (val) => {
        this.#controlActive = val;
    }

    isControlActive = () => {
        return this.#controlActive;
    }

    setTopDownMode = (val) => {
        if (this.#topDownMode == val) {
            return;
        }

        if (!this.#topDownMode && val) {
            this.oldUp = this.up;
            this.oldTarget = this.target;
            this.oldPosition = this.position;
            this.oldInitialUp = this.initialUp;
        }
        this.#topDownMode = val;
        if (this.#topDownMode) {
            this.initialUp = [0,1,0];
            let boundaries = this.raster.getParameters().boundaries;
            let center = [(boundaries[2] + boundaries[0]) / 2, (boundaries[3] + boundaries[1]) / 2]; 
            let height = Math.abs((boundaries[3] - boundaries[1]) / 1.9) / Math.tan(FOV / 2);
            this.lookAt([...center, height], [...center, 0], this.initialUp);
        } else {
            this.initialUp = this.oldInitialUp;
            this.lookAt(this.oldPosition, this.oldTarget, this.oldUp);
            delete this.oldPosition;
            delete this.oldTarget;
            delete this.oldUp;
            delete this.oldInitialUp;
        }

        this.calculateMatrices();
        this.updated();
    }

    isTopDownMode = () => {
        return this.#topDownMode;
    }

    hasChanged = () => {
        let hasChanged = this.changed;
        this.changed = false;
        return hasChanged;
    }

    shouldUpdate = () => {
        if (this.updateNext && (!this.loadingState.isLoading())) {
            this.updateNext = false;
            return true;
        }
        return false;
    }

    updated = () => {
        this.updateNext = true;
        this.changed = true;
    }

    getPosition = () => {
        return this.position;
    }

    changeCamPosition = (position, target) => {
        this.lookAt(position, target, this.initialUp);
        this.calculateMatrices();
        this.updated();
    }

    lookAt = (position, target, up) => {
        this.position = position;
        this.target = target;
        let right = v3.cross(this.viewDirection, up);
        this.up = v3.normalize(v3.cross(right, this.viewDirection));
    }

    calculateMatrices = () => {
        this.viewMatrix = m4.inverse(m4.lookAt(this.position, this.target, this.up));
        this.projectionMatrix = m4.perspective(FOV, this.gl.canvas.width / this.gl.canvas.height, 0.01, 1000);
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

    // Rendering View Frustum

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

    renderViewFrustum = () => {
        if (!this.raster.getParameters().disableUpdateOnCam || !this.frustumVBO) {
            return;
        }

        let programInfo = this.raster.getGlInfo().getFrustumShader()
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

    // Mouse Pointer Handlers
    pointerDown = (e) => {
        if (e.button == 0) {
            this.leftPointerDown(e);
        } else if (e.button == 2) {
            this.rightPointerDown(e);
        }
    }

    pointerUp = (e) => {
        if (e.button == 0) {
            this.leftPointerUp(e);
        } else if (e.button == 2) {
            this.rightPointerUp(e);
        }
    }

    pointerMove = (e) => {
        let currentX = e.clientX;
        let currentY = e.clientY;

        if (this.mousePositionX !== undefined && this.mousePositionY !== undefined) {
            let oldX = this.mousePositionX;
            let oldY = this.mousePositionY;
            let diffX = (oldX - currentX);
            let diffY = (oldY - currentY);
            if (this.leftPressed) {
                this.moveLeftRightUpDown(diffX, -diffY);
            } else if (this.rightPressed && !this.#topDownMode) {
                this.lookAround(diffX, diffY);
            }
        }

        this.mousePositionX = currentX;
        this.mousePositionY = currentY;
        e.preventDefault();
    }

    pointerLeave = (e) => {
        this.leftPressed = false;
        this.rightPressed = false;
        this.mousePositionX = undefined;
        this.mousePositionY = undefined;
    }

    pointerClick = (e) => {
        if (e.button == 2) {
            e.preventDefault();
        }
    }

    wheel = (e) => {
        e.preventDefault();
        this.moveForward(-e.deltaY);
    }

    // Touch handlers
    touchStart = (e) => {
        if (e.targetTouches.length > 1) {
            this.doubleTouched = true;
            this.initialFirstTouchPosition = this.extractCoordsFromTouchEvent(e, 0);
            this.initialSecondTouchPosition = this.extractCoordsFromTouchEvent(e, 1);
            this.firstTouchPosition = this.initialFirstTouchPosition;
            this.secondTouchPosition = this.initialSecondTouchPosition;
        } else {
            this.singleTouched = true;
            this.initialFirstTouchPosition = this.extractCoordsFromTouchEvent(e, 0);
            this.firstTouchPosition = this.initialFirstTouchPosition;
        }
        e.preventDefault();
    }

    touchMove = (e) => {
        e.preventDefault();
        if (e.targetTouches.length > 1 && this.firstTouchPosition && this.secondTouchPosition) {
            let dist = this.calculateDistance(this.extractCoordsFromTouchEvent(e, 0), this.extractCoordsFromTouchEvent(e, 1));
            let oldDist = this.calculateDistance(this.firstTouchPosition, this.secondTouchPosition);

            if (Math.abs(dist, oldDist) > 300) {
                this.moveForward(this.sensitivity * (dist - oldDist));
            } else if (!this.#topDownMode) {
                let diffX = this.firstTouchPosition[0] - this.extractCoordsFromTouchEvent(e, 0)[0];
                let diffY = this.firstTouchPosition[1] - this.extractCoordsFromTouchEvent(e, 0)[1];
                this.moveLeftRightUpDown(-diffX, diffY);
            }
        } else if (e.targetTouches.length == 1 && this.firstTouchPosition) {
            let diffX = this.firstTouchPosition[0] - this.extractCoordsFromTouchEvent(e, 0)[0];
            let diffY = this.firstTouchPosition[1] - this.extractCoordsFromTouchEvent(e, 0)[1];
            this.#topDownMode ? this.moveLeftRightUpDown(-diffX, diffY): this.lookAround(-diffX, -diffY);
        }

        if (e.targetTouches > 1) {
            this.firstTouchPosition = this.extractCoordsFromTouchEvent(e, 0);
            this.secondTouchPosition = this.extractCoordsFromTouchEvent(e, 1);
        } else {
            this.firstTouchPosition = this.extractCoordsFromTouchEvent(e, 0);
        }
    }

    touchCancel = (e) => {
        this.singleTouched = false;
        this.doubleTouched = false;
        this.initialFirstTouchPosition = undefined;
        this.initialSecondTouchPosition = undefined;
        this.firstTouchPosition = undefined;
        this.secondTouchPosition = undefined;
        e.preventDefault();
    }

    leftPointerDown = (e) => {
        e.preventDefault();
        this.leftPressed = true;
    }

    leftPointerUp = (e) => {
        e.preventDefault();
        this.leftPressed = false;
        this.mousePositionX = undefined;
        this.mousePositionY = undefined;
    }

    rightPointerDown = (e) => {
        this.rightPressed = true;
        e.preventDefault();
    }

    rightPointerUp = (e) => {
        e.preventDefault();
        this.rightPressed = false;
        this.mousePositionX = undefined;
        this.mousePositionY = undefined;
    }

    moveLeftRightUpDown = (diffX, diffY) => {
        if (!this.#controlActive) {
            return;
        }
        
        diffX = diffX * this.sensitivity * Math.max(this.position[2], 0.0001) * this.positionFactor;
        diffY = diffY * this.sensitivity * Math.max(this.position[2], 0.0001) * this.positionFactor;

        let upDiff = v3.mulScalar(this.up, diffY);
        let rightDiff = v3.mulScalar(this.right, diffX);

        this.position = v3.add(this.position, upDiff);
        this.position = v3.add(this.position, rightDiff);

        this.target = v3.add(this.target, upDiff);
        this.target = v3.add(this.target, rightDiff);
        this.updated();
        this.calculateMatrices();
    }

    lookAround = (diffX, diffY) => {
        if (!this.#controlActive) {
            return;
        }

        diffX = diffX * 0.002;
        diffY = diffY * 0.002;

        // Calculate rotations
        let rotationAroundUp = m4.axisRotation(this.up, diffX);
        let rotationAroundRight = m4.axisRotation(this.right, diffY);

        let newTarget = m4.transformPoint(m4.multiply(rotationAroundUp, rotationAroundRight), v3.subtract(this.target, this.position));

        let dotProd = v3.dot(v3.normalize(v3.subtract(newTarget, this.position)), this.initialUp);

        if (Math.abs(dotProd) >= 0.95) {
            return;
        }

        this.lookAt(this.position, newTarget, this.initialUp);
        this.updated();

        this.calculateMatrices();
    }

    moveForward = (scroll) => {
        if (!this.#controlActive) {
            return;
        }
        
        if (Math.abs(scroll) > 0.5) {
            scroll = Math.sign(scroll) * 0.5;
        }

        scroll *= Math.max(this.position[2], 0.0001) * Math.pow(this.positionFactor, 0.25);

        let changeVec = v3.mulScalar(this.viewDirection, scroll);
        this.position = v3.add(this.position, changeVec);
        this.target = v3.add(this.target, changeVec);

        this.calculateMatrices();
        this.updated();
    }

    extractCoordsFromTouchEvent = (event, index) => {
        var bcr = event.target.getBoundingClientRect();
        var x = event.targetTouches[index].pageX - bcr.x;
        var y = event.targetTouches[index].pageY - bcr.y;
        return [x, y];
    }

    // Helper Functions

    /**
     * Calculates the distance between two touch points
     * @param {Touch} p1 
     * @param {Touch} p2 
     */
    calculateDistance = (p1, p2) => {
        let distX = p1[0] - p2[0];
        let distY = p1[1] - p2[1];
        return Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
    }
}

export default Camera