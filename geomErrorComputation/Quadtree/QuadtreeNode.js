const twgl = require('twgl.js');
const m4 = twgl.m4;
const v3 = twgl.v3;
const Tile = require('./Tile.js')
const Quadtree = require('./Quadtree.js');

class QuadtreeNode {

    /**
     * @param {object} config
     * @param {Number} x,
     * @param {Number} y,
     * @param {*} lod 
     * @param {Quadtree} tree 
     * @param {QuadtreeNode} parent 
     */
    constructor(config, x, y, lod, tree) {
        this.config = config;
        this.lod = lod;

        this.tree = tree;

        this.x = x;
        this.y = y;

        this.upperLeftChild = undefined;
        this.upperRightChild = undefined;
        this.lowerLeftChild = undefined;
        this.lowerRightChild = undefined;
        this.tile = undefined;
        this.nodes = [];
    }

    registerNode = (node) => {
        let size = this.nodes.push(node);
        if (size == 1) {
            this.tree.addLeaf(this)
        }
    }

    loadHeightIntoNodes = async () => {
        await this.loadData();
        this.nodes.forEach(node => {
                let bounds = this.tile.getBounds(node);
                node.setMinMaxBounds(bounds);
                node.replaceWithSimpleNode();
            }
        )
        this.tile.deleteData();
        this.tile = undefined;
        this.nodes = undefined;
    }

    createUpperLeftChild = () => {
        if (!this.upperLeftChild) {
            this.upperLeftChild = new QuadtreeNode(
                this.config,
                this.x * 2,
                this.y * 2 + 1,
                this.lod + 1,
                this.tree,
            );
        }
        return this.upperLeftChild;
    }

    createUpperRightChild = () => {
        if (!this.upperRightChild) {
            this.upperRightChild = new QuadtreeNode(
                this.config,
                this.x * 2 + 1,
                this.y * 2 + 1,
                this.lod + 1,
                this.tree,
            );
        }
        return this.upperRightChild;
    }

    createLowerLeftChild = () => {
        if (!this.lowerLeftChild) {
            this.lowerLeftChild = new QuadtreeNode(
                this.config,
                this.x * 2,
                this.y * 2,
                this.lod + 1,
                this.tree,
            );
        }
        return this.lowerLeftChild;
    }

    createLowerRightChild = () => {
        if (!this.lowerRightChild) {
            this.lowerRightChild = new QuadtreeNode(
                this.config,
                this.x * 2 + 1,
                this.y * 2,
                this.lod + 1,
                this.tree,
            );
        }
        return this.lowerRightChild;
    }

    loadData = async () => {
        if (!this.tile) {
            this.tile = new Tile(this.lod, this.x, this.y, this.config);
        }
        return this.tile.loadHeightTiff();
    }

    getBounds = (binNode) => {
        this.tile.getBounds(binNode);
    }
}

module.exports = QuadtreeNode;