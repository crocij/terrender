const Quadtree = require("../Quadtree/Quadtree");
const BinTreeNode = require("./BinTreeNode");
const RequestManualGC = require('../Utils/RequestManualGC');

/**
 * @property {Array.<BinTreeNode>} children
 */
class BinTree {

    /**
     * 
     * @param {object} config 
     * @param {Quadtree} quadTree 
     * @param {*} boundaries 
     */
    constructor(config, quadTree, boundaries = [-180, -90, 180, 90]) {
        this.config = config;
        this.center = [
            (boundaries[0] + boundaries[2]) / 2,
            (boundaries[1] + boundaries[3]) / 2
        ]
        this.boundaries = boundaries;
        this.quadTree = quadTree;
        this.children = [];
        this.nodesToProcess = [];
        this.nodesSetup = 0;
    }

    setupTree = () => {
        if (this.children.length == 0) {
            this.children = [];
            let xLength = Math.abs(this.boundaries[0] - this.boundaries[2]);
            let yLength = Math.abs(this.boundaries[1] - this.boundaries[3]);

            if (xLength >= yLength) {
                let nrOfMblocks = xLength / yLength;
                for (let i = 0; i < nrOfMblocks; i++) {
                    if (i % 2 == 0) {
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.TOPLEFT, undefined, 0, this.quadTree.roots[i], [0, 0], (i * 2) + '1'));
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.BOTTOMRIGHT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2 + 1) + '1'));
                    } else {
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.BOTTOMLEFT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2) + '1'));
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.TOPRIGHT, undefined, 0, this.quadTree.roots[i], [0, 0], (i * 2 + 1) + '1'));
                    }
                }
            } else {
                let nrOfMblocks = yLength / xLength;
                for (let i = 0; i < nrOfMblocks; i++) {
                    if (i % 2 == 0) {
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.BOTTOMLEFT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2) + '1'));
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.TOPRIGHT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2 + 1) + '1'));
                    } else {
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.TOPLEFT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2) + '1'));
                        this.children.push(new BinTreeNode(this.config, this, BinTreeNode.BOTTOMRIGHT, undefined, 0, this.quadTree.roots[i], [0, 0],  (i * 2 + 1) + '1'));
                    }
                }
            }
        }

        this.children.map(child => {
            RequestManualGC();
            return child.setup() 
        })
    }

    calculateBounds = () => {
        let initLod = this.nodesToProcess[0] && this.nodesToProcess[0].lod;
        console.log('Started LOD: ' + initLod);
        while (this.nodesToProcess.length > 0) {
            let node = this.nodesToProcess.splice(0, 1)[0];
            if (node.minMaxBounds.length !== 2) {
                node.calculateBounds();
            }
            if (node.lod != initLod) {
                initLod = node.lod;
                console.log('Started LOD: ' + initLod);
                if (initLod > 4) {
                    RequestManualGC();
                }
            }
        }
    }

    toString = (minDiff = 0) => {
        let simplifiedRoots = this.children.map(child => child.toSimplifiedTree(minDiff));
        return JSON.stringify(simplifiedRoots);
    }

    addNodesForProcessing = (node) => {
        this.nodesToProcess.push(node);
    }

    /**
     * 
     * @param {BinTreeNode} node 
     */
    findNeighbour = (node) => {
        let rootTriangle = Number.parseInt(node.bitAddress.substring(0, 1));
        let addressString = node.bitAddress.substring(1);
        let nodeIsOnEdge = this.nodeIsOnEdge(node.lod, addressString);

        if (nodeIsOnEdge && !this.edgeNodeIsInside(rootTriangle, addressString)) {
            return undefined;
        }

        let neighbour
        if (nodeIsOnEdge) {
            neighbour = this.applyRulesToEdgeNode(addressString);
        } else {
            neighbour = this.applyRules(addressString);
        }

        if (this.nodeIsOnDiag(node.lod, addressString)) {
            if (rootTriangle % 2 == 0) {
                return this.traverseTree(rootTriangle + 1, neighbour);
            } else {
                return this.traverseTree(rootTriangle - 1, neighbour);
            }
        } else if (nodeIsOnEdge) {
            if (rootTriangle % 2 == 0) {
                return this.traverseTree(rootTriangle - 1, neighbour);
            } else {
                return this.traverseTree(rootTriangle + 1, neighbour);
            }
        }

        return this.traverseTree(rootTriangle, neighbour);
    }

    /**
     * According to Gerstner 1999
     * @param {Number} lod 
     * @param {string} address 
     */
    nodeIsOnDiag = (lod, address) => {
        let regex = new RegExp(/^1(11|00)*$/)
        if (lod % 2 == 0 && regex.test(address)) {
            return true;
        }
        return false;
    }

    /**
     * According to Gerstner 1999
     * @param {Number} lod 
     * @param {string} address 
     * @returns 
     */
    nodeIsOnEdge = (lod, address) => {
        let regex = new RegExp(/^(10|11)(11|00)*$/)
        if (lod % 2 == 1 && regex.test(address)) {
            return true;
        }
        return false;
    }

    /**
     * 
     * @param {Number} rootIndex 
     * @param {String} address 
     */
    edgeNodeIsInside = (rootIndex, address) => {
        if (rootIndex % 2 == 0 && address.startsWith('11') && rootIndex != 0) {
            return true;
        }
        if (rootIndex % 2 == 1 && address.startsWith('10') && rootIndex != this.children.length - 1) {
            return true;
        }
        return false;
    }

    applyRules = (address) => {
        let tempAddress = address + '_';
        while (tempAddress.includes('_')) {
            if (tempAddress.includes('00_')) {
                tempAddress = tempAddress.replace('00_', '_11')
                continue;
            }
            if (tempAddress.includes('11_')) {
                tempAddress = tempAddress.replace('11_', '_00');
                continue;
            }
            if (tempAddress.includes('01_')) {
                tempAddress = tempAddress.replace('01_', '10');
                continue;
            }
            if (tempAddress.includes('10_')) {
                tempAddress = tempAddress.replace('10_', '01');
                continue;
            }
            tempAddress = tempAddress.replace('_', '');
        }
        return tempAddress;
    }

    applyRulesToEdgeNode = (address) => {
        let tempAddress = address + '_';
        while (tempAddress.includes('_') && tempAddress.indexOf('_') != 2) {
            if (tempAddress.includes('00_')) {
                tempAddress = tempAddress.replace('00_', '_11')
                continue;
            }
            if (tempAddress.includes('11_')) {
                tempAddress = tempAddress.replace('11_', '_00');
                continue;
            }
            if (tempAddress.includes('01_')) {
                tempAddress = tempAddress.replace('01_', '10');
                continue;
            }
            if (tempAddress.includes('10_')) {
                tempAddress = tempAddress.replace('10_', '01');
                continue;
            }
        }
        tempAddress = tempAddress.replace('11_', '10');
        tempAddress = tempAddress.replace('10_', '11');
        return tempAddress;
    }

    /**
     * 
     * @param {number} root 
     * @param {string} address 
     */
    traverseTree = (root, address) => {
        let node = this.children[root];
        address = address.substring(1);
        while (address.length > 0) {
            let nextChild = address.substring(0, 1);
            address = address.substring(1);
            node = node.children[Number.parseInt(nextChild)];
        }
        return node;
    }
}

module.exports = BinTree;