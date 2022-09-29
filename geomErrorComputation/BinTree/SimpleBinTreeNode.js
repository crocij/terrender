class SimpleBinTreeNode {
    constructor(tree, parent, lod, bitAddress, children, minMaxBounds) {
        this.tree = tree;
        this.parent = parent;
        this.bitAddress = bitAddress;
        this.minMaxBounds = minMaxBounds;
        this.children = children;
        this.lod = lod;
    }

    calculateBounds = () => {
        if (this.minMaxBounds.length == 2) {
            return this.minMaxBounds;
        }

        let mins = [];
        let maxs = [];

        this.children.forEach(child => {
            mins.push(child.minMaxBounds[0]);
            maxs.push(child.minMaxBounds[1]);
        });

        let neighbour = this.tree.findNeighbour(this);

        if (neighbour) {
            neighbour.children.forEach(child => {
                mins.push(child.minMaxBounds[0]);
                maxs.push(child.minMaxBounds[1]);
            });
        }

        this.minMaxBounds = [
            Math.min(...mins),
            Math.max(...maxs),
        ]

        if (neighbour) {
            neighbour.minMaxBounds = [...this.minMaxBounds];
            if (neighbour.parent) {
                this.tree.addNodesForProcessing(neighbour.parent);
            }
        }

        if (this.parent) {
            this.tree.addNodesForProcessing(this.parent);
        }

        this.parent = undefined;
        this.bitAddress = undefined;


        return this.minMaxBounds;
    }

    toSimplifiedTree = (minDiff = 0) => {

        // Ignore deepest level of tree, these nodes will neever be split
        if (this.minMaxBounds[1] - this.minMaxBounds[0] > minDiff && this.lod < this.tree.config.maxBinLod - 1) {
            let simplifiedChildren = this.children.map(child => child.toSimplifiedTree(minDiff));
            if (simplifiedChildren.length == 0) {
                return {
                    b: [Math.round(this.minMaxBounds[0]), Math.round(this.minMaxBounds[1])],
                }
            }
            return {
                b: [Math.round(this.minMaxBounds[0]), Math.round(this.minMaxBounds[1])],
                c: simplifiedChildren,
            }
        }

        // Drop children if bounds are below minimal Difference
        return {
            b: [Math.round(this.minMaxBounds[0]), Math.round(this.minMaxBounds[1])],
        }
    }
}

module.exports = SimpleBinTreeNode;