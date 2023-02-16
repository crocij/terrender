import * as twgl from 'twgl.js';
const v3 = twgl.v3;
import Tile from '../drawableShapes/Tile.js'

class QuadtreeNode {

    /**
     * @param {Terrender} terrender
     * @param {Number} centerHeight 
     * @param {Number} centerWidth
     * @param {Number} x used for loading tile
     * @param {Number} y used for loading tile
     * @param {Number} sideLength 
     * @param {Number} lod 
     * @param {Quadtree} tree 
     * @param {QuadtreeNode} parent 
     */
    constructor(terrender, centerWidth, centerHeight, x, y, sideLength, lod, tree, parent = undefined) {
        this.terrender = terrender;
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

    /**
     * Add this node at the start of the provided list and remove from current list
     * @param {NodeList} list 
     */
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

    /**
     * Add this node at the start of the provided list assuming it is a future list and remove from current list if current list is not the render list
     * @param {NodeList} list 
     */
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

    /**
     * Remove node from the current list
     */
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

    /**
     * Remove node from the future list
     */
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

    /**
     * Set prev element in list
     * @param {QuadtreeNode} prev 
     */
    updatePrev = (prev) => {
        this.prev = prev;
    }

    /**
     * Set prev element in future list
     * @param {QuadtreeNode} prev 
     */
    updateFuturePrev = (prev) => {
        this.futurePrev = prev;
    }

    /**
     * Set next in list
     * @param {QuadtreeNode} next 
     */
    updateNext = (next) => {
        this.next = next;
    }

    /**
     * Set next in future list
     * @param {QuadtreeNode} next 
     */
    updateFutureNext = (next) => {
        this.futureNext = next;
    }

    /**
     * Returns the center position of the node
     * @returns {Array.<Number>}
     */
    getCenter = () => {
        return v3.create(this.centerWidth, this.centerHeight, 0.0);
    }

    /**
     * Add patch to draw in the future
     * @param {BinTreeNode} node 
     */
    addPatchToDraw = (node) => {
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

    /**
     * Remove the provided node from the future list
     * @param {BinTreeNode} node 
     */
    removePatchToDraw = (node) => {
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

    /**
     * Return the current patches to Draw, then reset
     * @returns {Array.<BinTreeNode>}
     */
    resetPatchesToDraw = () => {
        let res = this.patchesToDraw;
        this.patchesToDraw = [];
        return res;
    }

    /**
     * Return the future patches to Draw, then reset
     * @returns {Array.<BinTreeNode>}
     */
    resetFuturePatchesToDraw = () => {
        let res = this.futurePatchesToDraw;
        this.futurePatchesToDraw = [];
        return res;
    }

    /**
     * Set the entire patches to draw array
     * @param {Array.<BintreeNode>} patches 
     */
    setPatchesToDraw = (patches) => {
        this.patchesToDraw = patches;
    }

    /**
     * Create the upper left child of this node if it hasn't been created yet
     * @returns {QuadtreeNode}
     */
    createUpperLeftChild = () => {
        if (!this.upperLeftChild) {
            let center = this.getUpperLeftCenter()
            this.upperLeftChild = new QuadtreeNode(
                this.terrender,
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

    /**
     * Create the upper right child of this node if it hasn't been created yet
     * @returns {QuadtreeNode}
     */
    createUpperRightChild = () => {
        if (!this.upperRightChild) {
            let center = this.getUpperRightCenter()
            this.upperRightChild = new QuadtreeNode(
                this.terrender,
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

    /**
     * Create the lower left child of this node if it hasn't been created yet
     * @returns {QuadtreeNode}
     */
    createLowerLeftChild = () => {
        if (!this.lowerLeftChild) {
            let center = this.getLowerLeftCenter()
            this.lowerLeftChild = new QuadtreeNode(
                this.terrender,
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

    /**
     * Create the lower right child of this node if it hasn't been created yet
     * @returns {QuadtreeNode}
     */
    createLowerRightChild = () => {
        if (!this.lowerRightChild) {
            let center = this.getLowerRightCenter()
            this.lowerRightChild = new QuadtreeNode(
                this.terrender,
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

    /**
     * Load the data for this quadtree and create its tile if it hasn't been created yet
     */
    loadData = () => {
        if (!this.tile) {
            this.tile = new Tile(this.lod, this.x, this.y, this.terrender);
            this.tile.translate(v3.create(this.centerWidth, this.centerHeight, 0));
            this.tile.scale(this.sideLength);
        }
        this.tile.loadTextures();
    }

    /**
     * Returns whether the associated tile exists and is ready
     * @returns {boolean}
     */
    isReady = () => {
        return (this.tile && this.tile.isReady());
    }

    /**
     * Remove the associated tiles data from the GPU and manage the lists
     */
    unloadData = () => {
        if (this.tile) {
            this.tile.unloadTextures();
        }
        if (this.list) {
            this.addFirstToList(this.tree.onRAMList);
        }
    }

    /**
     * Delete the associated tiles data and remove the node from the current list
     */
    deleteData = () => {
        if (this.tile) {
            this.tile.deleteData();
        }
        if (this.list) {
            this.removeFromCurrentList();
        }
    }

    /**
     * Draw the associated patches (only color or combined)
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
     * Draw only the pixel position, this is only used for WebGL1 implementations
     * @param {Camera} camera 
     * @param {Object} programInfo 
     * @param {Object} additionalUniforms 
     */
    drawPixelPos = (camera, programInfo, additionalUniforms) => {
        if (this.tile) {
            this.tile.drawPixelPos(camera, programInfo, additionalUniforms, this.patchesToDraw);
        }
    }

    /**
     * Return the center of the lower left child
     * @returns {Array.<Number>}
     */
    getLowerLeftCenter = () => {
        return [
            this.centerWidth - this.sideLength / 4,
            this.centerHeight - this.sideLength / 4,
            0.0
        ]
    }

    /**
     * Return the center of the lower right child
     * @returns {Array.<Number>}
     */
    getLowerRightCenter = () => {
        return [
            this.centerWidth + this.sideLength / 4,
            this.centerHeight - this.sideLength / 4,
            0.0
        ]
    }

    /**
     * Return the center of the upper left child
     * @returns {Array.<Number>}
     */
    getUpperLeftCenter = () => {
        return [
            this.centerWidth - this.sideLength / 4,
            this.centerHeight + this.sideLength / 4,
            0.0
        ]
    }

    /**
     * Return the center of the upper right child
     * @returns {Array.<Number>}
     */
    getUpperRightCenter = () => {
        return [
            this.centerWidth + this.sideLength / 4,
            this.centerHeight + this.sideLength / 4,
            0.0
        ]
    }
}

export default QuadtreeNode;