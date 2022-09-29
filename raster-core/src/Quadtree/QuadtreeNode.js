import * as twgl from 'twgl.js';
const m4 = twgl.m4;
const v3 = twgl.v3;
import Tile from '../drawableShapes/Tile.js'
import Raster from '../Raster.js';
import Quadtree from './Quadtree.js';

class QuadtreeNode {

    /**
     * @param {Raster} raster
     * @param {*} centerHeight 
     * @param {*} centerWidth
     * @param {Number} x used for loading tile
     * @param {Number} y used for loading tile
     * @param {*} sideLength 
     * @param {*} lod 
     * @param {Quadtree} tree 
     * @param {QuadtreeNode} parent 
     */
    constructor(raster, centerWidth, centerHeight, x, y, sideLength, lod, tree, parent = undefined) {
        this.raster = raster;
        this.lod = lod;
        this.centerHeight = centerHeight;
        this.centerWidth = centerWidth;
        this.sideLength = sideLength;

        this.tree = tree;

        // References for doubly linked list
        this.list = undefined;
        this.next = undefined;
        this.prev = undefined;

        this.futureList = undefined;
        this.futureNext = undefined;
        this.futurePrev = undefined;

        this.parent = parent;
        this.patchesToDraw = [];
        this.futurePatchesToDraw = [];

        this.x = x;
        this.y = y;

        this.upperLeftChild = undefined;
        this.upperRightChild = undefined;
        this.lowerLeftChild = undefined;
        this.lowerRightChild = undefined;
        this.tile = undefined;
    }

    addFirstToList = (list) => {
        if (this.list) {
            this.removeFromCurrentList();
        }

        this.list = list;

        if (list.size === 0) {
            list.setLast(this);
        } else {
            let prevFirst = list.first;
            prevFirst.updatePrev(this);
            this.next = prevFirst;
        }

        list.setFirst(this);
        list.increaseSize();
    }

    addFirstToFutureList = (list) => {
        if (this.list && this.list !== this.tree.renderList) {
            this.removeFromCurrentList();
        }

        this.futureList = list;
        if (list.size === 0) {
            list.setLast(this);
        } else {
            let prevFirst = list.first;
            prevFirst.updateFuturePrev(this);
            this.futureNext = prevFirst;
        }

        list.setFirst(this);
        list.increaseSize();
    }

    removeFromCurrentList = () => {
        if (this.list === undefined) {
            return;
        }

        if (this.next) {
            this.next.updatePrev(this.prev);
        } else {
            this.list.setLast(this.prev);
        }

        if (this.prev) {
            this.prev.updateNext(this.next);
        } else {
            this.list.setFirst(this.next);
        }

        this.list.decreaseSize();
        this.list = undefined;
        this.next = undefined;
        this.prev = undefined;
        return this;
    }

    removeFromFutureList = () => {
        if (this.futureList === undefined) {
            return;
        }

        if (this.futureNext) {
            this.futureNext.updateFuturePrev(this.futurePrev);
        } else {
            this.futureList.setLast(this.futurePrev);
        }

        if (this.futurePrev) {
            this.futurePrev.updateFutureNext(this.futureNext);
        } else {
            this.futureList.setFirst(this.futureNext);
        }

        this.futureList.decreaseSize();
        this.futureList = undefined;
        this.futureNext = undefined;
        this.futurePrev = undefined;
        return this;
    }

    updatePrev = (prev) => {
        this.prev = prev;
    }

    updateFuturePrev = (futurePrev) => {
        this.futurePrev = futurePrev;
    }

    updateNext = (next) => {
        this.next = next;
    }

    updateFutureNext = (futureNext) => {
        this.futureNext = futureNext;
    }

    getCenter = () => {
        return v3.create(this.centerWidth, this.centerHeight, 0.0);
    }

    addPatchToDraw = (node) => {
        if (this.patchesToDraw.indexOf(node) < 0) {
            this.patchesToDraw.push(node)
        }
        if (this.list !== this.tree.renderList) {
            this.addFirstToList(this.tree.renderList);
        }
    }

    addFuturePatchToDraw = (node) => {
        if (this.futurePatchesToDraw.indexOf(node) < 0) {
            this.futurePatchesToDraw.push(node);
        }

        if (this.futureList === undefined) {
            this.addFirstToFutureList(this.tree.futureList);
            if (this.list === this.tree.onGPUList || this.list === this.tree.onRAMList) {
                this.removeFromCurrentList();
            }
        }
    }

    removePatchToDraw = (node) => {
        let index = this.patchesToDraw.indexOf(node);
        if (index >= 0) {
            this.patchesToDraw.splice(index, 1);
        }

        if (this.patchesToDraw.length == 0) {
            if (this.list === this.tree.renderList && this.futureList === undefined) {
                this.addFirstToList(this.tree.onGPUList);
            } else {
                this.removeFromCurrentList();
            }
        }
    }

    removeFuturePatchToDraw = (node) => {
        let index = this.futurePatchesToDraw.indexOf(node);
        let prevLength = this.futurePatchesToDraw.length;
        if (index >= 0) {
            this.futurePatchesToDraw.splice(index, 1);
        }

        if (this.futurePatchesToDraw.length == 0) {
            this.removeFromFutureList();
            if (this.patchesToDraw.length == 0 && (this.list === this.tree.renderList || prevLength > 0)) {
                this.addFirstToList(this.tree.onGPUList);
            }
        }
    }

    resetPatchesToDraw = () => {
        let res = this.patchesToDraw;
        this.patchesToDraw = [];
        return res;
    }

    resetFuturePatchesToDraw = () => {
        let res = this.futurePatchesToDraw;
        this.futurePatchesToDraw = [];
        return res;
    }

    setPatchesToDraw = (patches) => {
        this.patchesToDraw = patches;
    }

    createUpperLeftChild = () => {
        if (!this.upperLeftChild) {
            let center = this.getUpperLeftCenter()
            this.upperLeftChild = new QuadtreeNode(
                this.raster,
                center[0],
                center[1],
                this.x * 2,
                this.y * 2 + 1,
                this.sideLength / 2,
                this.lod + 1,
                this.tree,
                this
            );
        }
        return this.upperLeftChild;
    }

    createUpperRightChild = () => {
        if (!this.upperRightChild) {
            let center = this.getUpperRightCenter()
            this.upperRightChild = new QuadtreeNode(
                this.raster,
                center[0],
                center[1],
                this.x * 2 + 1,
                this.y * 2 + 1,
                this.sideLength / 2,
                this.lod + 1,
                this.tree,
                this
            );
        }
        return this.upperRightChild;
    }

    createLowerLeftChild = () => {
        if (!this.lowerLeftChild) {
            let center = this.getLowerLeftCenter()
            this.lowerLeftChild = new QuadtreeNode(
                this.raster,
                center[0],
                center[1],
                this.x * 2,
                this.y * 2,
                this.sideLength / 2,
                this.lod + 1,
                this.tree,
                this
            );
        }
        return this.lowerLeftChild;
    }

    createLowerRightChild = () => {
        if (!this.lowerRightChild) {
            let center = this.getLowerRightCenter()
            this.lowerRightChild = new QuadtreeNode(
                this.raster,
                center[0],
                center[1],
                this.x * 2 + 1,
                this.y * 2,
                this.sideLength / 2,
                this.lod + 1,
                this.tree,
                this
            );
        }
        return this.lowerRightChild;
    }

    loadData = () => {
        if (!this.tile) {
            this.tile = new Tile(this.lod, this.x, this.y, this.raster);
            this.tile.translate(v3.create(this.centerWidth, this.centerHeight, 0));
            this.tile.scale(this.sideLength);
        }
        this.tile.loadTextures();
    }

    isReady = () => {
        return (this.tile && this.tile.isReady());
    }

    unloadData = () => {
        if (this.tile) {
            this.tile.unloadTextures();
        }
        if (this.list) {
            this.addFirstToList(this.tree.onRAMList);
        }
    }

    deleteData = () => {
        if (this.tile) {
            this.tile.deleteData();
        }
        if (this.list) {
            this.removeFromCurrentList();
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
        if (this.tile) {
            this.tile.draw(camera, programInfo, additionalUniforms, config, this.patchesToDraw);
        }
    }

    /**
     * 
     * @param {Camera} camera 
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     */
    drawPixelPos = (camera, programInfo, additionalUniforms) => {
        if (this.tile) {
            this.tile.drawPixelPos(camera, programInfo, additionalUniforms, this.patchesToDraw);
        }
    }

    getLowerLeftCenter = () => {
        return [
            this.centerWidth - this.sideLength / 4,
            this.centerHeight - this.sideLength / 4,
            0.0
        ]
    }

    getLowerRightCenter = () => {
        return [
            this.centerWidth + this.sideLength / 4,
            this.centerHeight - this.sideLength / 4,
            0.0
        ]
    }

    getUpperLeftCenter = () => {
        return [
            this.centerWidth - this.sideLength / 4,
            this.centerHeight + this.sideLength / 4,
            0.0
        ]
    }

    getUpperRightCenter = () => {
        return [
            this.centerWidth + this.sideLength / 4,
            this.centerHeight + this.sideLength / 4,
            0.0
        ]
    }


}

export default QuadtreeNode;