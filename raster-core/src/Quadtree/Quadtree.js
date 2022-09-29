import Camera from '../Utils/Camera.js';
import QuadtreeNode from './QuadtreeNode.js';

/**
 * @property {QuadtreeNode} first
 */
class NodeList {
    /**
     * 
     * @param {Array[QuadtreeNode]} nodes
     */
    constructor(nodes = []) {
        this.size = 0;
        this.first = undefined;
        this.last = undefined;

        nodes.reverse().forEach((node) => {
            node.addFirstToList(this);
        });
    }

    increaseSize = () => {
        this.size += 1;
    }

    decreaseSize = () => {
        this.size -= 1;
    }

    setFirst = (node) => {
        this.first = node;
    }

    setLast = (node) => {
        this.last = node;
    }
}

class Quadtree {

    /**
     * 
     * @param {Raster} raster 
     * @param {Array[Number]} boundaries in worldspace
     * @param {Number} x left most x Coordinate for getting data
     * @param {Number} y bottom most y Coordinate for getting data
     */
    constructor(raster, boundaries, x, y) {
        this.gl = raster.getGlInfo().getGl();
        this.raster = raster;
        this.roots = [];
        let xLength = Math.abs(boundaries[0] - boundaries[2]);
        let yLength = Math.abs(boundaries[1] - boundaries[3]);

        if (xLength >= yLength) {
            let nrOfMblocks = xLength / yLength;
            for (let i = 0; i < nrOfMblocks; i++) {
                let center = [
                    boundaries[0] + (i + 0.5) * yLength,
                    boundaries[1] + 0.5 * yLength
                ]
                this.roots.push(new QuadtreeNode(raster, center[0], center[1], x + i, y, yLength, 0, this));
            }
        } else {
            let nrOfMblocks = yLength / xLength;
            for (let i = 0; i < nrOfMblocks; i++) {
                let center = [
                    boundaries[0] + 0.5 * xLength,
                    boundaries[1] + (0.5 + i) * xLength
                ]
                this.roots.push(new QuadtreeNode(raster, center[0], center[1], x, y + 1, xLength, 0, this));
            }
        }

        this.renderList = new NodeList();
        this.onGPUList = new NodeList();
        this.onRAMList = new NodeList();
        this.futureList = new NodeList();

        this.drawableNodes = [];
    }

    swapLists = () => {
        if (this.futureList.size == 0) {
            return;
        }

        while (this.renderList.first !== undefined) {
            let node = this.renderList.first;
            node.resetPatchesToDraw();
            node.removeFromCurrentList();
            if (node.futureList === undefined) {
                node.addFirstToList(this.onGPUList);
            }
        }

        while (this.futureList.first !== undefined) {
            let node = this.futureList.first;
            node.removeFromFutureList();
            let patches = node.resetFuturePatchesToDraw();
            node.setPatchesToDraw(patches);
            node.addFirstToList(this.renderList);
        }
    }

    /**
     * 
     * @param {Camera} camera 
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     * @param {Object} config 
     */
    draw = (camera, programInfo, additionalUniforms, config) => {
        let node = this.renderList.first;
        if (node !== undefined) {
            !this.raster.getGlInfo().isColorCanvasRenderTarget() && this.raster.getGlInfo().recreateColorRenderTarget(this.gl)
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.raster.getGlInfo().getColorRenderTarget());
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT);
        }
        while (node !== undefined) {
            node.draw(camera, programInfo, additionalUniforms, config);
            node = node.next;
        }

        // Draw View frustum, in camera is checkde whether it is necessary
        this.raster.getCamera().renderViewFrustum();
    }

    /**
     * 
     * @param {Camera} camera 
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     * @param {Object} config 
     */
    drawCombined = (camera, programInfo, additionalUniforms, config) => {  
        let node = this.renderList.first;
        if (node !== undefined) {
            this.raster.getGlInfo().recreateCombinedRenderTargets();
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.raster.getGlInfo().getCombinedRenderTarget());
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT);
        }

        // Draw View frustum, in camera is checked whether it is necessary
        this.raster.getCamera().renderViewFrustum();

        while (node !== undefined) {
            node.draw(camera, programInfo, additionalUniforms, config);
            node = node.next;
        }
    }

    /**
     * 
     * @param {Camera} camera 
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     */
    drawPixelPos = (camera, programInfo, additionalUniforms) => {
        let node = this.renderList.first;
        if (node !== undefined) {
            if (additionalUniforms.renderXCoord) {
                !this.raster.getGlInfo().isPixelPosCanvasRenderTargetX() && this.raster.getGlInfo().recreatePixelPosRenderTargetX(this.gl)
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.raster.getGlInfo().getPixelPosRenderTargetX());
            } else {
                !this.raster.getGlInfo().isPixelPosCanvasRenderTargetY() && this.raster.getGlInfo().recreatePixelPosRenderTargetY(this.gl)
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.raster.getGlInfo().getPixelPosRenderTargetY());
            }
            this.gl.clear(this.gl.DEPTH_BUFFER_BIT | this.gl.COLOR_BUFFER_BIT);
        }
        while (node !== undefined) {
            node.drawPixelPos(camera, programInfo, additionalUniforms);
            node = node.next;
        }
    }

    loadData = () => {
        let node = this.futureList.first;
        while (node !== undefined) {
            node.loadData();
            node = node.futureNext;
        }
    }

    cleanUpUnusedData = () => {
        this.unloadUnusedData();
        this.deleteUnusedData();
    }

    unloadUnusedData = () => {
        while (this.onGPUList.size > this.raster.getParameters().maxGpuCache) {
            let lastNode = this.onGPUList.last;
            lastNode.unloadData();
        }
    }

    deleteUnusedData = () => {
        while (this.onRAMList.size > this.raster.getParameters().maxRamCache) {
            let lastNode = this.onRAMList.last;
            lastNode.deleteData();
        }
    }

    tileCountToString = () => {
        return "Tiles rendered: " + this.renderList.size + "; Tiles idling on GPU: " + this.onGPUList.size + "; Total tiles on GPU: " + (this.renderList.size + this.onGPUList.size) + "; Tiles in RAM: " + this.onRAMList.size;
    }
}

export default Quadtree;