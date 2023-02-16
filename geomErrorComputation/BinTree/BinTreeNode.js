const twgl = require('twgl.js');
const m4 = twgl.m4;
const v3 = twgl.v3;

const RequestManualGC = require('../Utils/RequestManualGC');
const QuadtreeNode = require("../Quadtree/QuadtreeNode");
const SimpleBinTreeNode = require('./SimpleBinTreeNode');

class BinTreeNode {

    /**
     * 
     * @param {object} config
     * @param {BinTree} tree
     * @param {Number} type 
     * @param {Number} lod Lod in the BinTree (increases by one with every step)
     * @param {QuadtreeNode} mblock
     * @param {Array} offsetMblock Offset within the mblock
     * @param {String} bitAddress
     */
    constructor(config, tree, type, parent, lod, mblock, offsetMblock, bitAddress) {
        this.bitAddress = bitAddress;
        this.config = config;
        this.type = type;
        this.parent = parent;
        this.lod = lod;
        this.mblock = mblock;
        this.offsetMblock = offsetMblock;
        this.children = [];
        this.minMaxBounds = [];
        this.tree = tree;
    }

    // Fill up like the 0 lod mblock, then as usual are higher mblocks required
    get newMblock() {
        return this.lod % 2 == 0 && (this.lod >= this.config.lodsFirstMblock);
    }

    // Returns the current depth in the current mblock. It is the same for two consecutive lods
    get currentDepthInMblock() {
        if (this.lod <= this.config.lodsFirstMblock) {
            return Math.floor(this.lod / 2);
        } else {

            // Note that the lodsFirstBlock is always even
            if (this.lod % 2 == 1) {
                return this.config.lodsFirstMblock / 2 - 1;
            } else {
                return this.config.lodsFirstMblock / 2;
            }
        }
    }

    get childDisplacementInCurrentMblock() {

        // The current tile is a topLeft and similar, the anchor point within textures does not change for the children
        if (this.lod % 2 == 0) {
            return 0;
        }

        return 0.5 / Math.pow(2, this.currentDepthInMblock + 1);
    }

    get typeRotationMatrix() {
        switch (this.type) {
            case BinTreeNode.LEFT:
            case BinTreeNode.TOPLEFT:
                return m4.rotationZ(0);
            case BinTreeNode.TOP:
            case BinTreeNode.TOPRIGHT:
                return m4.rotationZ(-Math.PI * 0.5);
            case BinTreeNode.RIGHT:
            case BinTreeNode.BOTTOMRIGHT:
                return m4.rotationZ(-Math.PI);
            case BinTreeNode.BOTTOM:
            case BinTreeNode.BOTTOMLEFT:
                return m4.rotationZ(-Math.PI * 1.5);
            default:
                console.error("Unknown Type: " + type);
        }
    }

    get coordTransformationMatrix() {
        let coordTransformationMatrix = m4.identity();
        coordTransformationMatrix = m4.translate(coordTransformationMatrix, v3.create(this.offsetMblock[0], this.offsetMblock[1], 0));
        coordTransformationMatrix = m4.multiply(coordTransformationMatrix, this.typeRotationMatrix);
        if (this.currentDepthInMblock > 0) {
            let currentDepthInMblock = this.currentDepthInMblock;
            let scalingFactor = 1 / Math.pow(2, currentDepthInMblock);
            coordTransformationMatrix = m4.scale(coordTransformationMatrix, v3.create(scalingFactor, scalingFactor, 0));
        }

        return coordTransformationMatrix;
    }

    setup = () => {
        if (this.lod == this.config.maxBinLod) {
            this.mblock.registerNode(this);
            this.mblock = undefined;
            if (this.parent) {
                this.tree.addNodesForProcessing(this.parent)
            }
        } else {
            this.split();
            this.tree.nodesSetup += 1;
            this.replaceWithSimpleNode();
            if (this.tree.nodesSetup % 1000000 == 0) {
                let start = Date.now()
                RequestManualGC();
                console.log('Nodes already setup: ' + this.tree.nodesSetup + '; Time for GC[s]: ' + ((Date.now() - start) / 1000))
            }
            this.children.map(children => children.setup());
        }
    }

    replaceWithSimpleNode = () => {
        let simpleNode = new SimpleBinTreeNode(this.tree, this.parent, this.lod, this.bitAddress, this.children, this.minMaxBounds);
        this.children.map(child => child.parent = simpleNode);

        if (this.parent) {
            let index = this.parent.children.findIndex(child => child.bitAddress === this.bitAddress);
            if (index == -1) {
                console.log('Could not find myself in parent')
            }
            this.parent.children[index] = simpleNode;
        } else {
            let index = this.tree.children.findIndex(child => child.bitAddress === this.bitAddress);
            if (index == -1) {
                console.log('Could not find myself in root')
            }
            this.tree.children[index] = simpleNode;
        }
    }

    setMinMaxBounds = (bounds) => {
        this.minMaxBounds = bounds;
    }

    split = () => {
        switch (this.type) {
            case BinTreeNode.LEFT:
                this.splitLeft();
                break;
            case BinTreeNode.TOP:
                this.splitTop();
                break;
            case BinTreeNode.RIGHT:
                this.splitRight();
                break;
            case BinTreeNode.BOTTOM:
                this.splitBottom();
                break;
            case BinTreeNode.TOPLEFT:
                this.splitTopLeft();
                break;
            case BinTreeNode.TOPRIGHT:
                this.splitTopRight();
                break;
            case BinTreeNode.BOTTOMRIGHT:
                this.splitBottomRight();
                break;
            case BinTreeNode.BOTTOMLEFT:
                this.splitBottomLeft();
                break;
            default:
                console.error("Unknown Node Type: " + this.type);
        }
    }

    splitLeft = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Top left)
        let childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOPLEFT, this, childrenLod, this.mblock, childOffset, newBitAddress));

        // Second Child (Bottom Left)
        childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOMLEFT, this, childrenLod, this.mblock, childOffset, newBitAddress));
    }

    splitTop = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Top Right)
        let childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOPRIGHT, this, childrenLod, this.mblock, childOffset, newBitAddress));

        // Second Child (Top Left)
        childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOPLEFT, this, childrenLod, this.mblock, childOffset, newBitAddress));
    }

    splitRight = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Bottom Right)
        let childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOMRIGHT, this, childrenLod, this.mblock, childOffset, newBitAddress));

        // Second Child (Top Right)
        childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOPRIGHT, this, childrenLod, this.mblock, childOffset, newBitAddress));
    }

    splitBottom = () => {
        this.children = [];
        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Bottom Left)
        let childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOMLEFT, this, childrenLod, this.mblock, childOffset, newBitAddress));

        // Second Child (Bottom Right)
        childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOMRIGHT, this, childrenLod, this.mblock, childOffset, newBitAddress));
    }

    // This should be correct
    splitTopLeft = () => {
        this.children = [];
        let childrenLod = this.lod + 1;
        let childrenOffsetMblock = [...this.offsetMblock]
        let childMblock = this.mblock;

        if (this.newMblock) {
            if (this.offsetMblock[0] > 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] > 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            }
        }

        // First Child (Left)
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.LEFT, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));

        // Second Child (Top)
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOP, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));
    }

    splitTopRight = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let childrenOffsetMblock = [...this.offsetMblock];
        let childMblock = this.mblock;

        if (this.newMblock) {
            if (this.offsetMblock[0] > 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] > 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            }
        }

        // First Child (Top)
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.TOP, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));

        // Second Child (Right)
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.RIGHT, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));
    }

    splitBottomRight = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let childrenOffsetMblock = [...this.offsetMblock]
        let childMblock = this.mblock;

        if (this.newMblock) {
            if (this.offsetMblock[0] > 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] > 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            }
        }

        // First Child (Right)
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.RIGHT, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));

        // Second Child (Bottom)
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOM, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));
    }

    splitBottomLeft = () => {
        this.children = [];

        let childrenLod = this.lod + 1;
        let childrenOffsetMblock = [...this.offsetMblock]
        let childMblock = this.mblock;

        if (this.newMblock) {
            if (this.offsetMblock[0] > 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] > 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerRightChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] - 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] < 0) {
                childMblock = this.mblock.createLowerLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] + 0.25) * 2,
                ];
            } else if (this.offsetMblock[0] < 0 && this.offsetMblock[1] > 0) {
                childMblock = this.mblock.createUpperLeftChild();

                // Relative and scaled
                childrenOffsetMblock = [
                    (this.offsetMblock[0] + 0.25) * 2,
                    (this.offsetMblock[1] - 0.25) * 2,
                ];
            }
        }

        // First Child (Bottom)
        let newBitAddress = this.bitAddress + '0';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.BOTTOM, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));

        // Second Child (Left)
        newBitAddress = this.bitAddress + '1';

        this.children.push(new BinTreeNode(this.config, this.tree, BinTreeNode.LEFT, this, childrenLod, childMblock, childrenOffsetMblock, newBitAddress));
    }
}

BinTreeNode.LEFT = 0;
BinTreeNode.TOP = 1;
BinTreeNode.RIGHT = 2;
BinTreeNode.BOTTOM = 3;
BinTreeNode.TOPLEFT = 4;
BinTreeNode.TOPRIGHT = 5;
BinTreeNode.BOTTOMRIGHT = 6;
BinTreeNode.BOTTOMLEFT = 7;

module.exports = BinTreeNode;