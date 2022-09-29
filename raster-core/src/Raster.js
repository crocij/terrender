import * as twgl from 'twgl.js';
import BinTree from './BinTree/BinTree';
import Quadtree from './Quadtree/Quadtree';
import Camera from './Utils/Camera';
import Parameters from './Utils/Parameters';
import LoadingState from './Utils/LoadingState';
import Timer from './Utils/Timer';
import Counters from './Utils/Counters';
import GlInfo from './Utils/GlInfo';

class Raster {
    #counters;
    #loadingState;
    #timer;

    #glInfo;
    #camera;
    #quadTree
    #binTree;

    #parameters

    /**
     * 
     * @param {HTMLCanvasElement} canvas
     * @param {WebGLRenderingContext} gl
     * @param {object} parameters
     * @param {object} initCamera Initial Camera settings
     */
    constructor(gl, parameters = {}, initCamera = {}) {
        twgl.setDefaults({ textureColor: [0, 0, 0, 1] });
        this.camInitPos = initCamera.pos || [0, 1, 1];
        this.camInitTarget = initCamera.target || [2, 1, 0];
        this.camInitUp = initCamera.up || [0, 0, 1];
        this.camInitSensitivity = initCamera.sensitivity || 0.5

        this.#glInfo = new GlInfo(gl);
        this.#parameters = new Parameters(parameters);
        this.#timer = new Timer();
        this.#counters = new Counters(this.#parameters);
        this.#loadingState = new LoadingState(this.#timer);
        this.ready = false;

        this.createTimers();
        this.setupCamera();
        this.createAndInitializeDataStructures();
    }

    getCounters = () => {
        return this.#counters;
    }

    /**
     * 
     * @returns {GlInfo}
     */
    getGlInfo = () => {
        return this.#glInfo;
    }

    /**
     * 
     * @returns {LoadingState}
     */
    getLoadingState = () => {
        return this.#loadingState;
    }

    /**
     * 
     * @returns {Quadtree}
     */
    getQuadTree = () => {
        return this.#quadTree;
    }

    /**
     * 
     * @returns {Parameters}
     */
    getParameters = () => {
        return this.#parameters;
    }

    /**
     * 
     * @returns {Timer}
     */
    getTimer = () => {
        return this.#timer;
    }

    /**
     * 
     * @returns {Camera}
     */
    getCamera = () => {
        return this.#camera;
    }

    createTimers = () => {
        this.binTreeUpdateTimer = this.#timer.addTimer('binTreeUpdate', 'BinTree Updates');
        this.quadtreeLoadTimer = this.#timer.addTimer('quadtreeLoad', 'Quadtree Load');
        this.quadtreeUnloadTimer = this.#timer.addTimer('quadtreeUnload', 'Quadtree Unload');
        this.drawTimer = this.#timer.addTimer('draw', 'Drawing');
        this.fpsTimer = this.#timer.addTimer('fps', 'FPS');
    }

    createAndInitializeDataStructures = async () => {
        this.#quadTree = new Quadtree(this, this.#parameters.boundaries, this.#parameters.xStart, this.#parameters.yStart);
        this.#binTree = new BinTree(this, this.#quadTree, this.#parameters.boundaries);
    }

    reloadGeomError = async () => {
        this.loadingGeomError = true;
        if (this.#parameters.useGeomMetric && typeof this.#parameters.getGeomErrorSlug === 'function') {
            let response = await fetch(this.#parameters.getGeomErrorSlug(this.#parameters.currentLod, this.#parameters.kPatchBase));
            if (response.status == 200) {
                let geomErrorTree = await response.json()
                this.#binTree.setGeomErrorTree(geomErrorTree);
            } else {
                this.#binTree.setGeomErrorTree(undefined);
            }
        }
        this.loadingGeomError = false;
        this.ready = true;
    }

    setupCamera = () => {
        this.#camera = new Camera(
            this.camInitPos,
            this.camInitTarget,
            this.camInitUp,
            this,
            { sensitivity: this.camInitSensitivity }
        );

        this.#camera.saveViewFrustum();
    }

    start = () => {
        this.prevTime = Date.now();
        twgl.resizeCanvasToDisplaySize(this.#glInfo.getGl().canvas);
        this.prevCanvasWidth = this.#glInfo.getGl().canvas.width;
        this.prevCanvasHeight = this.#glInfo.getGl().canvas.height;
        this.#glInfo.getGl().viewport(0, 0, this.prevCanvasWidth, this.prevCanvasHeight);
        this.#camera.calculateMatrices();
        this.running = true;
        this.reloadGeomError().then(() => {
            this.binTreeUpdateTimer.measureTime(this.#binTree.update, this.#camera);
            this.quadtreeLoadTimer.measureTime(this.#quadTree.loadData);
        })
        requestAnimationFrame(this.render);
    }

    draw = () => {
        this.#counters.getVertexCounter().resetVertices();
        this.#counters.getBinNodeCounter().reset();
        this.#counters.getMblockCounter().reset();
        let startTime = Date.now();
        if (this.#glInfo.isColorCanvasRenderTarget() || this.#glInfo.getColorRenderTarget()) {
            this.#quadTree.draw(
                this.#camera,
                this.#glInfo.getColorShader(),
                {
                    renderLod: this.#parameters.showLodAsColor,
                    renderFlat: this.#parameters.renderFlat
                },
                {
                    renderGeometry: this.#parameters.renderGeometry,
                    renderKPatchLines: this.#parameters.renderKPatchLines
                }
            );
        }

        if (this.#glInfo.isCombinedCanvasRenderTarget() || this.#glInfo.getCombinedRenderTarget()) {
            this.#quadTree.drawCombined(
                this.#camera,
                this.#glInfo.getCombinedShader(),
                {
                    renderLod: this.#parameters.showLodAsColor,
                    renderFlat: this.#parameters.renderFlat
                },
                {
                    renderGeometry: this.#parameters.renderGeometry,
                    renderKPatchLines: this.#parameters.renderKPatchLines
                }
            );
        }

        // If WebGl 1 check if Pixel Pos needs to be rendered
        if (!this.#glInfo.isWebGL2()) {
            if (this.#glInfo.isPixelPosCanvasRenderTargetX() || this.#glInfo.getPixelPosRenderTargetX()) {
                this.#quadTree.drawPixelPos(this.#camera, this.#glInfo.getPixelPosShader(), { renderFlat: this.#parameters.renderFlat, renderXCoord: true });
            }
            if (this.#glInfo.isPixelPosCanvasRenderTargetY() || this.#glInfo.getPixelPosRenderTargetY()) {
                this.#quadTree.drawPixelPos(this.#camera, this.#glInfo.getPixelPosShader(), { renderFlat: this.#parameters.renderFlat, renderXCoord: false });
            }
        }
        this.drawTimer.addManualMeasurement(Date.now() - startTime);
        this.drawCallback && this.drawCallback();
    }

    /**
     * Callback executed when the datastructures (BinTree and Quadtree) are updated
     * @param {Function} func 
     */
    setDataStructureUpdateCallback = (func) => {
        this.dataStructureUpdateCallback = func;
    }

    /**
     * Callback executed when the camera changes/redraws
     * @param {Function} func 
     */
    setCamUpdateCallback = (func) => {
        this.camUpdateCallback = func;
    }

    /**
     * Callback executed at the end of every render loop
     * @param {Function} func 
     */
    setRenderLoopCallback = (func) => {
        this.renderLoopCallback = func;
    }

    /**
     * Callback executes everytime a frame has been drawn
     * @param {Function} func 
     */
    setDrawCallback = (func) => {
        this.drawCallback = func;
    }

    /**
     * Callback executed when a loading cycle finished, e.g. when the new list of mblocks to render is rendered and the caches are updated
     * @param {Function} func 
     */
    setLoadingFinishedCallback = (func) => {
        this.loadingFinishedCallback = func;
    }

    /**
     * Callback that is executed every render loop to evaluate whether the scene should be redrawn or not, should return a boolean
     * @param {Function} func 
     */
    setShouldRedrawCallback = (func) => {
        this.redrawCallback = func;
    }

    render = (time) => {
        if (!this.running) {
            return;
        }

        let didDraw = false;

        if (!this.ready) {
            requestAnimationFrame(this.render);
            return;
        }

        if (this.#parameters.shouldReloadGeomError()) {
            this.reloadGeomError();
            requestAnimationFrame(this.render);
            return;
        }

        if (this.#parameters.shouldSaveViewFrustum()) {
            this.#camera.saveViewFrustum();
        }

        let canvasSizeHasChanged = false;
        let swapped = false;
        let cameraHasChanged = this.#camera.hasChanged();

        // Next mblock tree ready
        if (this.#loadingState.hasChanged() && !this.#loadingState.isLoading()) {
            this.#quadTree.swapLists();
            this.quadtreeUnloadTimer.measureTime(this.#quadTree.cleanUpUnusedData);
            swapped = true;
        }

        if (this.prevCanvasWidth !== this.#glInfo.getGl().canvas.clientWidth || this.prevCanvasHeight !== this.#glInfo.getGl().canvas.clientHeight) {
            this.prevCanvasWidth = this.#glInfo.getGl().canvas.clientWidth;
            this.prevCanvasHeight = this.#glInfo.getGl().canvas.clientHeight;
            twgl.resizeCanvasToDisplaySize(this.#glInfo.getGl().canvas);
            this.#glInfo.getGl().viewport(0, 0, this.prevCanvasWidth, this.prevCanvasHeight);
            this.#camera.calculateMatrices();
            canvasSizeHasChanged = true;
        }
        if (!this.loadingGeomError && ((this.#camera.shouldUpdate() && !this.#parameters.disableUpdateOnCam) || this.#parameters.shouldRecalculate())) {
            if (this.#parameters.shouldResetBintree()) {
                this.#binTree.clear();
            }

            this.binTreeUpdateTimer.measureTime(this.#binTree.update, this.#camera, cameraHasChanged);
            this.quadtreeLoadTimer.measureTime(this.#quadTree.loadData);

            // It is possible, that no textures had to be reloaded -> then can also swap
            if (!this.#loadingState.isLoading()) {
                this.#quadTree.swapLists();
                this.quadtreeUnloadTimer.measureTime(this.#quadTree.cleanUpUnusedData);
                swapped = true;
            }

            this.dataStructureUpdateCallback && this.dataStructureUpdateCallback();
        }
        if (cameraHasChanged || swapped || this.#parameters.shouldRedraw() || canvasSizeHasChanged || (this.redrawCallback && this.redrawCallback())) {
            didDraw = true;
            this.draw();
            this.camUpdateCallback && this.camUpdateCallback();
        }
        let timeDiff = time - this.prevTime;

        timeDiff /= 1000;
        this.fps = Math.round(1 / timeDiff);
        this.prevTime = time;

        if (swapped) {
            this.loadingFinishedCallback && this.loadingFinishedCallback();

            if (this.#parameters.dynamicBinTreeUpdate) {
                this.binTreeUpdateTimer.measureTime(this.#binTree.update, this.#camera, cameraHasChanged);
                this.quadtreeLoadTimer.measureTime(this.#quadTree.loadData);
            }
        }

        if (didDraw) {
            this.fpsTimer.addManualMeasurement(this.fps);
        }
        this.renderLoopCallback && this.renderLoopCallback(didDraw, swapped);
        requestAnimationFrame(this.render);
    }
}

export default Raster;