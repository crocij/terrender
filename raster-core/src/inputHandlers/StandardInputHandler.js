import * as twgl from 'twgl.js';
import interact from 'interactjs';

const m4 = twgl.m4;
const v3 = twgl.v3;

const SENSITIVITY_FACTOR_MOVEMENT_VIEW_AXIS = 3;
const SENSITIVITY_FACTOR_LOOK_AROUND = 0.7;


class StandardInputHandler {
    #active = true;
    #topDownMode = false;
    #camera;
    #interact;

    /**
     * @constructor
     * @param {Raster} raster Raster
     * @param {Object} config Additional configuration for the controls
     * @param {Number} config.sensitivity Sensitivity of the camera control
     * @param {Number} config.positionFactor How much the sensitivity of the controls should change depending on the camera position Z value
     */
    constructor(raster, config = {}) {
        const { sensitivity = 1.0, positionFactor = 0.005 } = config;
        this.#camera = raster.getCamera();
        this.positionFactor = positionFactor;
        this.raster = raster;
        this.gl = raster.getGlInfo().getGl();
        this.sensitivity = sensitivity;

        this.#interact = interact(this.gl.canvas);

        // TODO: differentiation of events -> possibly wait for n amounts, then set. 
        this.#interact.gesturable({
            onmove: (event) => {
                if (Math.abs(event.dy) > 2) {
                    this.onDoublePan(event.dy)
                } else if(Math.abs(event.da) > 1) {
                    this.onRotate(event.da);
                } else if (event.scale > 1.05 || event.scale < 0.95) {
                    this.onPinch(event.ds);
                }
            }
        })

        // Register Listeners
        this.gl.canvas.addEventListener('mousedown', this.onPointerDown);
        this.gl.canvas.addEventListener('mouseup', this.onPointerUp);
        this.gl.canvas.addEventListener('mousemove', this.onPointerMove);
        this.gl.canvas.addEventListener('contextmenu', this.onContextMenu);
        this.gl.canvas.addEventListener('wheel', this.onWheel);

        this.gl.canvas.addEventListener('touchstart', this.onTouchStart);
        this.gl.canvas.addEventListener('touchmove', this.onTouchMove);
        this.gl.canvas.addEventListener('touchend', this.onTouchEnd);
    }

    /**
     * Set the active value for the controls
     * @param {boolean} active 
     */
    setActive = (active) => {
        this.#active = active;
    }

    /**
     * Returns whether the controls are active
     * @returns {boolean}
     */
    isActive = () => {
        return this.#active;
    }

    /**
     * Set whether the camera is in top down mode or not
     * @param {boolean} val 
     */
    setTopDownMode = (val) => {

        // TODO
        if (this.#topDownMode == val) {
            return;
        }

        if (!this.#topDownMode && val) {
            this.oldUp = this.#camera.up;
            this.oldTarget = this.#camera.target;
            this.oldPosition = this.#camera.position;
            this.oldInitialUp = this.#camera.initialUp;
        }
        this.#topDownMode = val;
        if (this.#topDownMode) {
            this.#camera.initialUp = [0, 1, 0];
            let boundaries = this.raster.getParameters().boundaries;
            let center = [(boundaries[2] + boundaries[0]) / 2, (boundaries[3] + boundaries[1]) / 2];
            let height = Math.abs((boundaries[3] - boundaries[1]) / 1.9) / Math.tan(this.#camera.getFOV() / 2);
            this.#camera.lookAt([...center, height], [...center, 0], this.#camera.initialUp);
        } else {
            this.#camera.initialUp = this.oldInitialUp;
            this.#camera.lookAt(this.oldPosition, this.oldTarget, this.oldUp);
            delete this.oldPosition;
            delete this.oldTarget;
            delete this.oldUp;
            delete this.oldInitialUp;
        }
    }

    /**
     * Returns whether the control is in top down mode or not
     * @returns {boolean}
     */
    isTopDownMode = () => {
        return this.#topDownMode;
    }

    /**
     * Move forward by the specified value factorized together with the position factor.
     * By using the percentOffsetCenter property it is possible to move not directly on the view vector but a vector pointing somewhere else on the screen
     * @param {Number} value 
     * @param {Array.<Number>} offsetCenter offset relative to the viewport, the canvas is covered by the interval [-1,1] in both directions
     * @returns 
     */
    moveOnViewAxis = (value, offsetCenter = [0, 0]) => {
        if (!this.#active) {
            return;
        }

        value *= Math.sqrt(Math.max(this.#camera.position[2], 0.0001)) * this.positionFactor;

        let rotationAroundUp = m4.axisRotation(this.#camera.up, - offsetCenter[0] * this.#camera.getFOV() / 2);
        let rotationAroundRight = m4.axisRotation(this.#camera.right, offsetCenter[1] * this.#camera.getVFOV() / 2);

        let changeDirection = m4.transformDirection(rotationAroundRight, this.#camera.viewDirection);
        changeDirection = v3.normalize(m4.transformDirection(rotationAroundUp, changeDirection));
        let changeVec = v3.mulScalar(changeDirection, value);
        let newPosition = v3.add(this.#camera.position, changeVec);
        let newTarget = v3.add(newPosition, this.#camera.viewDirection);

        if (newPosition[2] <= 0) {
            return;
        }

        this.#camera.changeCamPosition(newPosition, newTarget);
    }

    /**
     * Move relative to the terrain according to provided coords in projected forward and right direction. The positionFactor will be added.
     * @param {Array.<Number>} deltaCoords 
     */
    moveRelativeToTerrain = (deltaCoords) => {
        if (!this.#active) {
            return;
        }

        deltaCoords = deltaCoords.map(value => {
            return value * Math.max(this.#camera.position[2], 0.0001) * this.positionFactor;
        });

        let right = this.#camera.right;
        let forward = this.#topDownMode ? this.#camera.up : this.#camera.viewDirection;
        right[2] = 0;
        forward[2] = 0;
        right = v3.mulScalar(v3.normalize(right), deltaCoords[0]);
        forward = v3.mulScalar(v3.normalize(forward), deltaCoords[1]);

        let newPos = v3.add(this.#camera.position, right);
        newPos = v3.add(newPos, forward);
        let newTarget = v3.add(this.#camera.target, right);
        newTarget = v3.add(newTarget, forward);
        this.#camera.changeCamPosition(newPos, newTarget);
    }

    /**
     * Look around the Z and right axis according to the provided deltas
     * @param {Array.<Number>} deltaCoords 
     */
    lookAround = (deltaCoords) => {
        if (!this.#active || this.#topDownMode) {
            return;
        }

        // Calculate rotations
        let rotationAroundUp = m4.rotationZ(-deltaCoords[0] * 0.002);
        let rotationAroundRight = m4.axisRotation(this.#camera.right, deltaCoords[1] * 0.002);

        let newDirection = m4.transformDirection(m4.multiply(rotationAroundUp, rotationAroundRight), v3.subtract(this.#camera.target, this.#camera.position));
        let newTarget = v3.add(this.#camera.position, newDirection)

        let dotProd = v3.dot(v3.normalize(v3.subtract(newTarget, this.#camera.position)), this.#camera.initialUp);

        if (Math.abs(dotProd) >= 0.95) {
            return;
        }

        this.#camera.changeCamPosition(this.#camera.position, newTarget);
    }

    /**
     * Rotate around up
     * @param {Number} angle 
     */
    rotateAroundUp = (angle) => {
        if (!this.#active || this.#topDownMode) {
            return;
        }

        // Calculate rotation matrix
        let rotationAroundUp = m4.rotationZ(angle);

        let newDirection = m4.transformDirection(rotationAroundUp, v3.subtract(this.#camera.target, this.#camera.position));
        let newTarget = v3.add(this.#camera.position, newDirection)

        let dotProd = v3.dot(v3.normalize(v3.subtract(newTarget, this.#camera.position)), this.#camera.initialUp);

        if (Math.abs(dotProd) >= 0.95) {
            return;
        }

        this.#camera.changeCamPosition(this.#camera.position, newTarget);
    }

    //
    // Mouse event handling
    //

    onPointerDown = (event) => {
        if (event.button == 0) {
            this.leftPointerDown(event);
        } else if (event.button == 2) {
            this.rightPointerDown(event);
        } else if (event.button == 1) {
            this.middlePointerDown(event);
        }
    }

    onPointerUp = (event) => {
        if (event.button == 0) {
            this.leftPointerUp(event);
        } else if (event.button == 2) {
            this.rightPointerUp(event);
        }
    }

    onPointerMove = (event) => {
        let currentMouseCoords = [event.clientX, event.clientY];

        if (this.lastMovement && (Date.now() - this.lastMovement < 40)) {
            return;
        }
        this.lastMovement = Date.now();

        if (this.mouseCoords !== undefined) {
            let oldMouseCoords = this.mouseCoords;
            let diffMouseCoords = [
                this.sensitivity * (oldMouseCoords[0] - currentMouseCoords[0]),
                this.sensitivity * (oldMouseCoords[1] - currentMouseCoords[1]),
            ];
            if (this.leftPointerPressed && !event.altKey) {
                diffMouseCoords[1] = -1 * diffMouseCoords[1];
                this.moveRelativeToTerrain(diffMouseCoords);
            } else if (this.rightPointerPressed) {
                diffMouseCoords[0] *= SENSITIVITY_FACTOR_LOOK_AROUND;
                diffMouseCoords[1] *= -1 * SENSITIVITY_FACTOR_LOOK_AROUND;
                this.lookAround(diffMouseCoords);
            }
        }

        this.mouseCoords = currentMouseCoords;
        event.preventDefault();
    }

    onWheel = (event) => {
        event.preventDefault();

        let centerOffset = [
            (2 * event.offsetX - this.gl.canvas.width) / this.gl.canvas.width,
            - (2 * event.offsetY - this.gl.canvas.height) / this.gl.canvas.height,
        ];

        this.moveOnViewAxis(-event.deltaY * this.sensitivity * SENSITIVITY_FACTOR_MOVEMENT_VIEW_AXIS, centerOffset);
    }

    leftPointerDown = (event) => {
        event.preventDefault()
        this.leftPointerPressed = true;
    }
    leftPointerUp = (event) => {
        event.preventDefault();
        this.leftPointerPressed = false;
        this.mouseCoords = undefined;
    }

    rightPointerDown = (event) => {
        event.preventDefault()
        this.rightPointerPressed = true;
    }
    rightPointerUp = (event) => {
        event.preventDefault();
        this.rightPointerPressed = false;
        this.mouseCoords = undefined;
    }

    middlePointerDown = (event) => {
        event.preventDefault();
        this.middlePointerPressed = true;
    }
    middlePointerUp = (event) => {
        event.preventDefault();
        this.middlePointerPressed = false;
        this.mouseCoords = undefined;
    }

    onContextMenu = (event) => {
        if (event.button == 2) {
            event.preventDefault();
        }
    }

    //
    // Touch handlers
    //

    onTouchStart = (e) => {
        if (e.targetTouches.length > 1) {
            this.singleTouch = false;
            this.touchPosition = undefined;
            return;
        }
        this.singleTouch = true;
        this.touchPosition = this.extractCoordsFromTouchEvent(e, 0);

        e.preventDefault();
    }

    onTouchMove = (e) => {

        // Handle with interactJS
        if (e.targetTouches.length > 1) {
            this.singleTouch = false;
            this.touchPosition = undefined;
            return;
        }

        e.preventDefault();
        if (this.touchPosition) {
            let diffX = this.touchPosition[0] - this.extractCoordsFromTouchEvent(e, 0)[0];
            let diffY = this.touchPosition[1] - this.extractCoordsFromTouchEvent(e, 0)[1];
            this.moveRelativeToTerrain([this.sensitivity * diffX, this.sensitivity * -diffY]);
        }
        this.touchPosition = this.extractCoordsFromTouchEvent(e, 0);
    }

    onTouchEnd = (e) => {
        // Handle with interactJS
        if (e.targetTouches.length > 1) {
            return;
        }

        e.preventDefault();
        this.singleTouch = false;
        this.touchPosition = undefined;
    }

    //
    // Gesturable Event Handling 
    //
    onDoublePan = (deltaY) => {
        this.lookAround([0, this.sensitivity * deltaY]);
    }

    onPinch = (deltaScale) => {
        this.moveOnViewAxis(1000.0 * this.sensitivity * deltaScale);
    }

    onRotate = (deltaAngle) => {
        this.rotateAroundUp(deltaAngle * (Math.PI / 180));

    }

    /**
     * Extract the coordinates of the by index specified touch point form the provided touch event
     * @param {TouchEvent} event 
     * @param {Number} index 
     * @returns {Array.<Number>}
     */
    extractCoordsFromTouchEvent = (event, index) => {
        let bcr = event.target.getBoundingClientRect();
        let x = event.targetTouches[index].pageX - bcr.x;
        let y = event.targetTouches[index].pageY - bcr.y;
        return [x, y];
    }
}

export default StandardInputHandler;