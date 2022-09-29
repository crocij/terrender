import * as twgl from 'twgl.js';
const m4 = twgl.m4;
const v3 = twgl.v3;

import TileBufferInfo from './TileBufferInfo.js';
import GradientTexture from './GradientTexture.js';
import BinTreeNode from '../BinTree/BinTreeNode.js';
import Raster from '../Raster.js';
import Camera from '../Utils/Camera.js';
import Parameters from '../Utils/Parameters.js';

class WorkerQueue {
    constructor(workerSrc, nrWorkers, raster) {
        this.workers = [];
        this.timer = raster.getTimer().addTimer(workerSrc, 'Time for webworker ' + workerSrc);
        for (let i = 0; i < nrWorkers; i++) {
            this.workers.push({
                worker: new Worker(workerSrc),
                locked: false,
            })
        }
        this.queue = [];
        this.counter = raster.getCounters().getGenericCounter(workerSrc);
    }

    addToQueue = (responseBuffer) => {
        return new Promise((resolve, reject) => {
            this.queue.push({
                responseBuffer: responseBuffer,
                resolve: resolve,
                reject: reject,
            });
            this.startNext()
        });
    }

    startNext = () => {
        for (let i = 0; i < this.workers.length && this.queue.length > 0; i++) {
            if (!this.workers[i].locked) {
                let startTime = Date.now();
                this.workers[i].locked = true;
                this.counter.add();
                let next = this.queue.shift();
                this.workers[i].worker.onmessage = (e) => {
                    next.resolve(e.data);
                    this.counter.subtract();
                    this.workers[i].locked = false;
                    this.timer.addManualMeasurement(Date.now() - startTime)
                    this.startNext();
                }
                this.workers[i].worker.postMessage(next.responseBuffer, [next.responseBuffer]);
            }
        }
    }
}

class WorkerCreator {
    constructor() {
        this.initialized = false;
        this.workerQueuePNG = undefined;
        this.workerQueueTiffHeight = undefined;
        this.workerQueueTiffColor = undefined;
    }

    /**
     * 
     * @param {Parameters} parameters 
     */
    createWorkers = (parameters, raster) => {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        let nrWorkerQueues = 0;

        if (parameters.colorIsTiff) {
            nrWorkerQueues++;
        }
        if (parameters.heightIsTiff) {
            nrWorkerQueues++;
        } else if (parameters.isIOS || raster.getGlInfo().isWebGL2()) {
            nrWorkerQueues++;
        }

        if (nrWorkerQueues == 0) {
            return;
        }

        let sizeWorkerQueue = navigator.hardwareConcurrency ? Math.max(Math.floor((navigator.hardwareConcurrency - 1) / nrWorkerQueues), 2) : Math.max(Math.floor(4 / nrWorkerQueues), 2);

        if (parameters.colorIsTiff) {
            this.workerQueueTiffColor = new WorkerQueue('workerBundleTiffColor.js', sizeWorkerQueue, raster);
        }
        if (parameters.heightIsTiff) {
            this.workerQueueTiffHeight = new WorkerQueue('workerBundleTiffHeight.js', sizeWorkerQueue, raster);
        } else if (parameters.isIOS || raster.getGlInfo().isWebGL2()) {
            this.workerQueuePNG = new WorkerQueue('workerBundlePng.js', sizeWorkerQueue, raster);
        }
    }
}

const workerCreator = new WorkerCreator();

class Tile {
    /**
     * 
     * @param {*} lod 
     * @param {*} xIndex 
     * @param {*} yIndex 
     * @param {Raster} raster 
     */
    constructor(lod, xIndex, yIndex, raster) {
        if (!workerCreator.initialized) {
            workerCreator.createWorkers(raster.getParameters(), raster);
        }
        this.tileBufferInfo = TileBufferInfo.getTileBufferInfo(raster, 257, 257, 1.0);
        this.gradientTexture = GradientTexture.getGradientTexture(raster.getGlInfo().getGl());
        this.loadingState = raster.getLoadingState();
        this.timer = raster.getTimer();
        this.tileBufferInfo.createBufferInfo(raster.getGlInfo().getGl());
        this.isLoadingHeight = false;
        this.isLoadingColor = false;
        this.gl = raster.getGlInfo().getGl();
        this.raster = raster;
        this.lod = lod;
        this.xIndex = xIndex;
        this.yIndex = yIndex;

        // The sideLength in the object space, we need it later in the shaders to scale the height
        this.sideLengthOS = 1.0;

        this.modelMatrix = m4.identity();

        this.tiffSource = 'asset/height/' + lod + '/' + xIndex + '/' + yIndex;
        this.textureSource = 'asset/texture/' + lod + '/' + xIndex + '/' + yIndex;
        this.noHeightTexture = false;
        this.colorTexElem = undefined;
        this.heightRawData = undefined;
        this.color = [Math.random(), Math.random(), Math.random(), 1];
        // this.color = [0, 0, 0, 1]
        this.createTimers();
    }

    createTimers = () => {
        this.heightFetchTimer = this.timer.addTimer('heightFetch', 'Height Texture Fetching');
        this.heightArrayBufferReadTimer = this.timer.addTimer('heightArrayBufferRead', 'Reading Height Response Array Buffer');
        this.colorFetchTimer = this.timer.addTimer('colorFetch', 'Color Texture Fetching');
        this.colorArrayBufferReadTimer = this.timer.addTimer('colorArrayBufferRead', 'Reading Color Response Array Buffer');
        this.colorTextureTimer = this.timer.addTimer('colorTexture', 'Prepare Color Texture')
        this.heightTextureTimer = this.timer.addTimer('heightTexture', 'Prepare Height Texture');
    }

    loadTextures = () => {
        if (!this.heightTexture && !this.isLoadingHeight) {
            this.loadHeightTexture();
        }

        if (!this.colorTexture && !this.isLoadingColor) {
            this.loadColorTexture();
        }
    }

    isReady = () => {
        return  this.heightTexture !== undefined && !this.isLoadingHeight && this.colorTexture !== undefined && !this.isLoadingColor;
    }

    isHeightReady = () => {
        return this.heightTexture || this.noHeightTexture || this.heightRawData || this.heightTexElement;
    }

    isColorReady= () => {
        return this.colorTexture || this.noColorTexture || this.colorRawData || this.colorTexElem;
    }

    loadHeightTexture = () => {
        if (this.noHeightTexture) {

            // Set Placeholder texture
            if (this.raster.getGlInfo().isWebGL2()) {
                this.heightTexture = twgl.createTexture(this.gl, {
                    src: [0.0],
                    width: 1,
                    height: 1,
                    minMag: this.gl.NEAREST,
                    wrap: this.gl.CLAMP_TO_EDGE,
                    internalFormat: this.gl.R32F,
                }, (err) => console.error(err));
            } else {

                this.heightTexture = twgl.createTexture(this.gl, {
                    src: [0, 0, 0, 0],
                    width: 1,
                    height: 1,
                    minMag: this.gl.NEAREST,
                    wrap: this.gl.CLAMP_TO_EDGE,
                }, (err) => console.error(err));
            }

            return;
        }

        if (this.raster.getParameters().heightIsTiff) {
            this.loadingState.registerStartHeight();
            this.loadHeightTiff().then(res => {
                this.loadingState.registerFinishHeight();
                this.isLoadingHeight = false;
            }).catch(err => {
                this.loadingState.registerFinishHeight();
                this.isLoadingHeight = false;
                this.raster.getParameters().errorCallback(err, 'Loading Height Failed');
            });
        } else if (this.raster.getParameters().isIOS || this.raster.getGlInfo().isWebGL2()) {

            // https://bugs.webkit.org/show_bug.cgi?id=165297
            this.loadingState.registerStartHeight();
            this.loadHeightPngIOS().then(res => {
                this.loadingState.registerFinishHeight();
                this.isLoadingHeight = false;
            }).catch(err => {
                this.loadingState.registerFinishHeight();
                this.isLoadingHeight = false;
                this.raster.getParameters().errorCallback(err, 'Loading Height Failed');
            });
        } else {
            this.loadHeightPng();
        }
    }

    loadColorTexture = () => {
        if (this.noColorTexture) {

            // Set Placeholder Texture
            if (this.raster.getGlInfo().isWebGL2()) {
                this.colorTexture = twgl.createTexture(this.gl, {
                    src: [0, 0, 0],
                    width: 1,
                    height: 1,
                    wrap: this.gl.CLAMP_TO_EDGE,
                    minMag: this.gl.LINEAR,
                    format: this.gl.RGB,
                }, (err) => {
                    err && console.error(err);
                });
            } else {

                this.colorTexture = twgl.createTexture(this.gl, {
                    src: [0, 0, 0],
                    width: 1,
                    height: 1,
                    wrap: this.gl.CLAMP_TO_EDGE,
                    minMag: this.gl.LINEAR,
                    format: this.gl.RGB,
                }, (err) => {
                    err && console.error(err);
                });
            }
            return;
        }

        if (this.raster.getParameters().colorIsTiff) {
            this.loadingState.registerStartColor();
            this.loadColorTextureTiff().then(() => {
                this.loadingState.registerFinishColor();
                this.isLoadingColor = false;
            }).catch(err => {
                this.loadingState.registerFinishColor();
                this.isLoadingColor = false;
                this.raster.getParameters().errorCallback(err, 'Loading Color Failed');
            });
        } else {
            this.loadColorTexturePng();
        }
    }

    loadColorTextureTiff = async () => {
        if (this.raster.getParameters().noColorTextures) {
            return;
        }

        this.isLoadingColor = true;

        if (!this.colorRawData) {
            let startTime = Date.now();
            let overallStarTime = Date.now();
            let response = await fetch(this.textureSource);

            if (response.status == 204) {
                this.isLoadingColor = false;
                this.noColorTexture = true;
                // Set Placeholder Texture
                if (this.raster.getGlInfo().isWebGL2()) {
                    this.colorTexture = twgl.createTexture(this.gl, {
                        src: [0, 0, 0],
                        width: 1,
                        height: 1,
                        wrap: this.gl.CLAMP_TO_EDGE,
                        minMag: this.gl.LINEAR,
                        format: this.gl.RGB,
                    }, (err) => {
                        err && console.error(err);
                    });
                } else {

                    this.colorTexture = twgl.createTexture(this.gl, {
                        src: [0, 0, 0],
                        width: 1,
                        height: 1,
                        wrap: this.gl.CLAMP_TO_EDGE,
                        minMag: this.gl.LINEAR,
                        format: this.gl.RGB,
                    }, (err) => {
                        err && console.error(err);
                    });
                }
                return true;
            }

            this.colorFetchTimer.addManualMeasurement(Date.now() - startTime);
            startTime = Date.now();

            const arrayBuffer = await response.arrayBuffer();

            this.colorArrayBufferReadTimer.addManualMeasurement(Date.now() - startTime);
            let rasters = new Uint8Array(await workerCreator.workerQueueTiffColor.addToQueue(arrayBuffer));
            this.colorRawData = rasters;
            this.colorRasterWidth = Math.sqrt(rasters.length / 3);
            this.colorRasterHeight = this.colorRasterWidth;

            this.colorTextureTimer.addManualMeasurement(Date.now() - overallStarTime);
        }

        if (this.raster.getGlInfo().isWebGL2()) {
            this.colorTexture = twgl.createTexture(this.gl, {
                src: this.colorRawData,
                width: this.colorRasterWidth,
                height: this.colorRasterHeight,
                wrap: this.gl.CLAMP_TO_EDGE,
                minMag: this.gl.LINEAR,
                format: this.gl.RGB,
            }, (err) => {
                err && console.error(err);
            });
        } else {

            this.colorTexture = twgl.createTexture(this.gl, {
                src: this.colorRawData,
                width: this.colorRasterWidth,
                height: this.colorRasterHeight,
                wrap: this.gl.CLAMP_TO_EDGE,
                minMag: this.gl.LINEAR,
                format: this.gl.RGB,
            }, (err) => {
                err && console.error(err);
            });
        }
        return true;
    }

    loadColorTexturePng = () => {
        if (this.raster.getParameters().noColorTextures) {
            return;
        }
        this.isLoadingColor = true;
        this.loadingState.registerStartColor();
        let startTime = Date.now();
        this.colorTexture = twgl.createTexture(this.gl, {
            src: this.colorTexElem || this.textureSource,
            wrap: this.gl.CLAMP_TO_EDGE,
        }, (err, tex, source) => {
            if (!err) {
                this.colorTexElem = source;
            } else {
                this.raster.getParameters().errorCallback(err, 'Loading Color Failed');
                this.noColorTexture = true;
            }
            this.isLoadingColor = false;
            this.loadingState.registerFinishColor();
            this.colorTextureTimer.addManualMeasurement(Date.now() - startTime);
        });

        // Callback above is only called if src is an URL/Remote
        if (this.colorTexElem) {
            this.isLoadingColor = false;
            this.loadingState.registerFinishColor();
        }
    }

    loadHeightTiff = async () => {
        if (this.noHeightTexture) {
            return true;
        }
        this.isLoadingHeight = true;

        if (!this.heightRawData) {
            let startTime = Date.now();
            let overallStartTime = Date.now();
            let response = await fetch(this.tiffSource);

            if (response.status == 204) {
                this.isLoadingHeight = false;
                this.noHeightTexture = true;
                
                // Set Placeholder texture
                if (this.raster.getGlInfo().isWebGL2()) {
                    this.heightTexture = twgl.createTexture(this.gl, {
                        src: [0.0],
                        width: 1,
                        height: 1,
                        minMag: this.gl.NEAREST,
                        wrap: this.gl.CLAMP_TO_EDGE,
                        internalFormat: this.gl.R32F,
                    }, (err) => console.error(err));
                } else {

                    this.heightTexture = twgl.createTexture(this.gl, {
                        src: [0, 0, 0, 0],
                        width: 1,
                        height: 1,
                        minMag: this.gl.NEAREST,
                        wrap: this.gl.CLAMP_TO_EDGE,
                    }, (err) => console.error(err));
                }
                return true;
            }

            this.heightFetchTimer.addManualMeasurement(Date.now() - startTime);
            startTime = Date.now();

            const arrayBuffer = await response.arrayBuffer();
            this.heightRawData = new Float32Array(await workerCreator.workerQueueTiffHeight.addToQueue(arrayBuffer));
            this.heightRasterHeight = Math.sqrt(this.heightRawData.length);
            this.heightRasterWidth = this.heightRasterHeight;
            if (!this.raster.getGlInfo().isWebGL2()) {
                this.heightRawData = new Uint8Array(this.heightRawData.buffer);
            }
            this.heightTextureTimer.addManualMeasurement(Date.now() - overallStartTime);
        }

        if (this.raster.getGlInfo().isWebGL2()) {
            this.heightTexture = twgl.createTexture(this.gl, {
                src: this.heightRawData,
                width: this.heightRasterHeight,
                height: this.heightRasterWidth,
                minMag: this.gl.NEAREST,
                wrap: this.gl.CLAMP_TO_EDGE,
                internalFormat: this.gl.R32F,
            }, (err) => console.error(err));
        } else {
            this.heightTexture = twgl.createTexture(this.gl, {
                src: this.heightRawData,
                width: this.heightRasterHeight,
                height: this.heightRasterWidth,
                minMag: this.gl.NEAREST,
                wrap: this.gl.CLAMP_TO_EDGE,
            }, (err) => console.error(err));
        }
        return true;
    }

    loadHeightPng = () => {
        this.isLoadingHeight = true;
        this.loadingState.registerStartHeight();
        let startTime = Date.now();
        this.heightTexture = twgl.createTexture(this.gl, {
            src: this.heightTexElement || this.tiffSource,
            minMag: this.gl.NEAREST,
            wrap: this.gl.CLAMP_TO_EDGE,
        }, (err, tex, source) => {
            if (!err) {
                this.heightTexElement = source;
            } else {
                this.raster.getParameters().errorCallback(err, 'Loading Height Failed');
                this.noHeightTexture = true;
            }
            this.isLoadingHeight = false;
            this.loadingState.registerFinishHeight();
            this.heightTextureTimer.addManualMeasurement(Date.now() - startTime);
        });

        // Callback above is only called if src is an URL/Remote
        if (this.heightTexElement) {
            this.isLoadingHeight = false;
            this.loadingState.registerFinishHeight();
        }
    }

    loadHeightPngIOS = async () => {
        if (this.noHeightTexture) {
            return true;
        }
        this.isLoadingHeight = true;

        if (!this.heightRawData) {
            let startTime = Date.now();
            let response
            response = await fetch(this.tiffSource);

            if (response.status == 204) {
                this.isLoadingHeight = false;
                this.noHeightTexture = true;
                return true;
            }

            const arrayBuffer = await response.arrayBuffer();

            this.heightRawData = new Float32Array(await workerCreator.workerQueuePNG.addToQueue(arrayBuffer));
            this.heightRasterHeight = Math.sqrt(this.heightRawData.length);
            this.heightRasterWidth = this.heightRasterHeight;
            if (!this.raster.getGlInfo().isWebGL2()) {
                this.heightRawData = new Uint8Array(this.heightRawData.buffer);
            }
            this.heightTextureTimer.addManualMeasurement(Date.now() - startTime);
        }

        if (this.raster.getGlInfo().isWebGL2()) {
            this.heightTexture = twgl.createTexture(this.gl, {
                src: this.heightRawData,
                width: this.heightRasterHeight,
                height: this.heightRasterWidth,
                minMag: this.gl.NEAREST,
                wrap: this.gl.CLAMP_TO_EDGE,
                internalFormat: this.gl.R32F,
            }, (err) => console.error(err));
        } else {
            this.heightTexture = twgl.createTexture(this.gl, {
                src: this.heightRawData,
                width: this.heightRasterHeight,
                height: this.heightRasterWidth,
                minMag: this.gl.NEAREST,
                wrap: this.gl.CLAMP_TO_EDGE,
            }, (err) => console.error(err));
        }
        return true;
    }

    unloadTextures = () => {
        if (this.heightTexture) {
            this.gl.deleteTexture(this.heightTexture);
            delete this.heightTexture;
        }

        if (this.colorTexture) {
            this.gl.deleteTexture(this.colorTexture);
            delete this.colorTexture;
        }
    }

    deleteData = () => {
        this.unloadTextures();
        if (this.colorTexElem) {
            this.colorTexElem.src = '';
        }
        if (this.heightTexElement) {
            this.heightTexElement.src = '';
        }
        this.heightTexElement = undefined;
        this.heightRawData = undefined;
        this.colorTexElem = undefined;
        this.colorRawData = undefined;
    }

    rotateX = (angle) => {
        this.modelMatrix = m4.rotateX(this.modelMatrix, angle);
    }

    rotateY = (angle) => {
        this.modelMatrix = m4.rotateY(this.modelMatrix, angle);
    }

    rotateZ = (angle) => {
        this.modelMatrix = m4.rotateZ(this.modelMatrix, angle);
    }

    scale = (factor) => {
        this.modelMatrix = m4.scale(this.modelMatrix, v3.create(factor, factor, 1));
    }

    translate = (direction) => {
        this.modelMatrix = m4.translate(this.modelMatrix, direction);
    }

    /**
     * 
     * @param {Camera} camera
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     * @param {Object} config 
     * @param {array[BinTreeNode]} patches 
     */
    draw = (camera, programInfo, additionalUniforms, config, patches) => {
        if (this.tileBufferInfo.kPatchBase !== this.raster.getParameters().kPatchBase) {
            this.tileBufferInfo.recreateBuffers(this.gl);
        }
        patches.forEach((val, index) => {
            if (index == 0) {
                this.raster.getCounters().getMblockCounter().addToCounter(patches[0].mblock.lod);
            }
            this.drawPatch(camera, programInfo, additionalUniforms, config, val);
        })
    }

    /**
     * 
     * @param {Camera} camera
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     * @param {Object} config 
     * @param {BinTreeNode} patch 
     */
    drawPatch = (camera, programInfo, additionalUniforms, config, patch) => {

        // Convert mBlock Lod to BinTree Lod
        additionalUniforms.lod = patch.lod;
        additionalUniforms.maxLod = this.raster.getParameters().maxBinLod;
        this.raster.getCounters().getBinNodeCounter().addToCounter(patch.lod);
        const viewProjectionMatrix = camera.viewProjectionMatrix;
        const mvpMatrix = m4.multiply(viewProjectionMatrix, this.modelMatrix);
        const uniforms = {

            // Set texture to empty object if none available, else TWGL crashes when using webGL2
            heightTexture: this.heightTexture || {},
            colorTexture: (this.raster.getParameters().noColorTextures ? this.gradientTexture.texture : this.colorTexture) || {},
            noColorTexture: this.raster.getParameters().noColorTextures,
            mvpMatrix: mvpMatrix,
            coordRotationMatrix: patch.coordTransformationMatrix,
            sideLengthOS: this.sideLengthOS,
            noHeightTexture: this.noHeightTexture || this.isLoadingHeight,
            isLoadingColor: this.isLoadingColor,
            isLoadingHeight: this.isLoadingHeight,
            renderUniColor: this.raster.getParameters().renderUniColor,
            uniColor: this.color,
            heightScaling: this.raster.getParameters().heightScaling,
            estMaxHeight: this.raster.getParameters().estMaxHeight,
            modelMatrix: this.modelMatrix,
            ...additionalUniforms,
        }

        this.gl.useProgram(programInfo.program);

        let bufferInfo = this.noHeightTexture || this.isLoadingHeight ? this.tileBufferInfo.getTypeGeoBuffer(patch.type) : this.tileBufferInfo.getTypeKPatchBuffer(patch.type);
        if (config.renderKPatchLines) {
            bufferInfo = this.tileBufferInfo.getTypeKPatchLinesBuffer(patch.type);
        } else if (config.renderGeometry) {
            bufferInfo = this.tileBufferInfo.getTypeGeoBuffer(patch.type);
        }

        let renderMode = this.gl.TRIANGLES;
        if (config.renderKPatchLines) {
            renderMode = this.gl.LINES;
        } else if (config.renderGeometry) {
            renderMode = this.gl.LINE_LOOP;
        }

        this.raster.getCounters().getVertexCounter().addVertices(bufferInfo.numElements);

        twgl.setBuffersAndAttributes(this.gl, programInfo, bufferInfo);
        twgl.setUniforms(programInfo, uniforms);
        this.gl.drawElements(
            renderMode,
            bufferInfo.numElements,
            this.gl.UNSIGNED_INT,
            0
        );
    }

    /**
     * 
     * @param {Camera} camera
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     * @param {BinTreeNode} patch 
     */
    drawPixelPos = (camera, programInfo, additionalUniforms, patches) => {
        if (this.tileBufferInfo.kPatchBase !== this.raster.getParameters().kPatchBase) {
            this.tileBufferInfo.recreateBuffers(this.gl);
        }
        patches.forEach((val, index) => {
            this.drawPixelPosPatch(camera, additionalUniforms, programInfo, val);
        })
    }

    drawPixelPosPatch = (camera, additionalUniforms, programInfo, patch) => {
        const viewProjectionMatrix = camera.viewProjectionMatrix;
        const mvpMatrix = m4.multiply(viewProjectionMatrix, this.modelMatrix);

        this.gl.useProgram(programInfo.program);

        let bufferInfo = this.tileBufferInfo.getTypeKPatchBuffer(patch.type);
        twgl.setBuffersAndAttributes(this.gl, programInfo, bufferInfo);

        const uniforms = {
            mvpMatrix: mvpMatrix,
            coordRotationMatrix: patch.coordTransformationMatrix,

            // Set texture to empty object if none available, else TWGL crashes when using webGL2
            heightTexture: this.heightTexture || {},
            sideLengthOS: this.sideLengthOS,
            noHeightTexture: this.noHeightTexture || this.isLoadingHeight,
            modelMatrix: this.modelMatrix,
            heightScaling: this.raster.getParameters().heightScaling,
            ...additionalUniforms
        }

        twgl.setUniforms(programInfo, uniforms);
        this.gl.drawElements(
            this.gl.TRIANGLES,
            bufferInfo.numElements,
            this.gl.UNSIGNED_INT,
            0
        );
    }
}

export default Tile;