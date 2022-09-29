import * as twgl from 'twgl.js';
const m4 = twgl.m4;
const v3 = twgl.v3;

import QuadtreeNode from "../Quadtree/QuadtreeNode";
import Raster from '../Raster';
import Camera from '../Utils/Camera';

class BinTreeNode {

    /**
     * 
     * @param {Raster} raster Raster
     * @param {Number} type 
     * @param {Array} refinementPoint 
     * @param {Number} edgeLength The not hypotenuse side length
     * @param {Number} lod Lod in the BinTree (increases by one with every step)
     * @param {QuadtreeNode} mblock
     * @param {Array} offsetMblock Offset within the mblock
     * @param {Object} geomErrorNode Matching node in the geom error tree, if node has no children forwards same node on split
     */
    constructor(raster, type, parent, refinementPoint, edgeLength, lod, mblock, offsetMblock, geomErrorNode = undefined) {
        this.raster = raster;
        this.type = type;
        this.parent = parent;
        this.refinementPoint = refinementPoint;
        this.edgeLength = edgeLength;
        this.hypotenuseLength = Math.sqrt(edgeLength * edgeLength * 2);
        this.lod = lod;
        this.mblock = mblock;
        this.offsetMblock = offsetMblock;
        this.determineMblockCenterPoint(type, edgeLength, refinementPoint);
        this.children = [];
        this.geomErrorNode = geomErrorNode;
        this.isEntirelyInFrustum = false;
    }

    // Fill up like the 0 lod mblock, then as usual are higher mblocks required
    get newMblock() {
        return this.lod % 2 == 0 && (this.lod >= this.raster.getParameters().lodsFirstMblock);
    }

    // Returns the current depth in the current mblock. It is the same for two consecutive lods
    get currentDepthInMblock() {
        if (this.lod <= this.raster.getParameters().lodsFirstMblock) {
            return Math.floor(this.lod / 2);
        } else {

            // Note that the lodsFirstBlock is always even
            if (this.lod % 2 == 1) {
                return this.raster.getParameters().lodsFirstMblock / 2 - 1;
            } else {
                return this.raster.getParameters().lodsFirstMblock / 2;
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
        if (!this._coordTransformationMatrix) {
            this._coordTransformationMatrix = m4.identity();
            this._coordTransformationMatrix = m4.translate(this._coordTransformationMatrix, v3.create(this.offsetMblock[0], this.offsetMblock[1], 0));
            this._coordTransformationMatrix = m4.multiply(this._coordTransformationMatrix, this.typeRotationMatrix);
            if (this.currentDepthInMblock > 0) {
                let currentDepthInMblock = this.currentDepthInMblock;
                let scalingFactor = 1 / Math.pow(2, currentDepthInMblock);
                this._coordTransformationMatrix = m4.scale(this._coordTransformationMatrix, v3.create(scalingFactor, scalingFactor, 0));
            }
        }
        return this._coordTransformationMatrix;
    }

    get firstChildGeomErrorNode() {
        if (this.geomErrorNode) {
            if (this.geomErrorNode.c && this.geomErrorNode.c.length == 2) {
                return this.geomErrorNode.c[0];
            }
            return this.geomErrorNode;
        }
        return undefined;
    }

    get secondChildGeomErrorNode() {
        if (this.geomErrorNode) {
            if (this.geomErrorNode.c && this.geomErrorNode.c.length == 2) {
                return this.geomErrorNode.c[1];
            }
            return this.geomErrorNode;
        }
        return undefined;
    }

    determineMblockCenterPoint = (type, edgeLength, refinementPoint) => {

        // TODO: This is wrong, the edge lenth is not hypotenuse
        switch (type) {
            case BinTreeNode.LEFT:
                this.mblockCenterPoint = [...refinementPoint];
                this.mblockCenterPoint[0] += edgeLength / 2;
                break;
            case BinTreeNode.TOP:
                this.mblockCenterPoint = [...refinementPoint];
                this.mblockCenterPoint[1] -= edgeLength / 2;
                break;
            case BinTreeNode.RIGHT:
                this.mblockCenterPoint = [...refinementPoint];
                this.mblockCenterPoint[0] -= edgeLength / 2;
                break;
            case BinTreeNode.BOTTOM:
                this.mblockCenterPoint = [...refinementPoint];
                this.mblockCenterPoint[1] += edgeLength / 2;
                break;
            default:
                this.mblockCenterPoint = [...refinementPoint];
        }
    }

    deactivate = () => {
        this.mblock.removeFuturePatchToDraw(this);
        this.children.map(child => child.deactivate());
    }

    // TODO: Prep mBlock so we can register with offset
    evaluate = (camera) => {
        let res;

        this.parent && this.parent.mblock.removeFuturePatchToDraw(this.parent);
        this.mblock.addFuturePatchToDraw(this);

        if (this.errorFunction(camera)) {
            if (this.children.length == 0) {
                this.split();
            }
            this.children.forEach(child => child.isEntirelyInFrustum = this.isEntirelyInFrustum)
            this.children.forEach(child => child.deactivate());
            res = this.children;
        } else {
            if (this.children.length !== 0) {
                this.children.forEach(child => child.deactivate());
            }
            res = [];
        }

        return res;
    }

    recursiveEvaluate = (camera) => {
        if (this.errorFunction(camera)) {
            if (this.children.length == 0) {
                this.split();
            }
            this.mblock.removeFuturePatchToDraw(this);
            this.children.forEach(child => child.isEntirelyInFrustum = this.isEntirelyInFrustum)
            this.children.forEach(child => child.recursiveEvaluate(camera));
        } else {
            if (this.children.length !== 0) {
                this.children.forEach(child => child.deactivate());
            }
            this.mblock.addFuturePatchToDraw(this);
        }
    }

    errorFunction = (camera) => {
        if (this.lod == this.raster.getParameters().maxBinLod) {
            return false;
        }

        let octagonDistance = 1;
        let cullingFactor = 1;
        let geomError = 1;

        // Use error as flag to check if any metric is set
        let error = 0;
        if (this.raster.getParameters().useCullingMetric) {
            cullingFactor = this.isEntirelyInFrustum ? 1 : this.calculateCullingError(camera);
            if (cullingFactor == 0) {
                return false;
            }
            error = 1;
        }
        if (this.raster.getParameters().useGeomMetric && this.geomErrorNode) {
            geomError = this.calculateGeomError();
            error = 1;
        }
        if (this.raster.getParameters().useDistanceMetric) {
            octagonDistance = this.calculateOctohedronDistance(camera);
            error = 1;
        }

        error = octagonDistance * cullingFactor * geomError * error;
        return error > this.raster.getParameters().errorThreshold;
    }

    calculateGeomError = () => {
        if (!this.geomErrorNode || !this.geomErrorNode.b || this.geomErrorNode.b.length != 2) {
            return this.raster.getParameters().heightScaling * 1.0;
        }

        let bounds = this.geomErrorNode.b;
        return Math.max(this.raster.getParameters().heightScaling * (bounds[1] - bounds[0]), this.raster.getParameters().heightScaling * 1.0);
    }

    /**
     * Based on the paper from Gerstner 2003
     * Note that the prefix of the variable names gives away
     * where its origin point is.
     * ref: Origin at reference point
     * rat: Origin at the lower right point of the lower triangle that is defined by the diagonal line segment to check
     * con: Origin at the corner to check
     * @param {Camera} camera 
     * @returns 
     */
    calculateOctohedronDistance = (camera) => {
        let ref_mirroredPoint = this.mirrorPointIntoFirstQuadrant(this.translatePointToRefinement(camera.position));

        // mirror point so, that it is in the lower half of the first quadrant
        if (ref_mirroredPoint[0] < ref_mirroredPoint[1]) {
            let newY = ref_mirroredPoint[0];
            ref_mirroredPoint[0] = ref_mirroredPoint[1];
            ref_mirroredPoint[1] = newY;
        }

        let result = 0;

        // Variable based on type
        // The corner point
        let ref_corner;

        // The point on the diagonal line limiting the diagonal line segment to check
        let ref_pointOnDiag1;

        // The second point limiting the diagonal line segment (ame as the corner)
        let ref_pointOnDiag2;

        // The distance to the vertical line
        let verticalOffset;

        if (this.type < 4) {
            ref_corner = [0, 0];
            ref_corner[0] += this.hypotenuseLength;
            ref_corner[1] += this.hypotenuseLength / 2;

            ref_pointOnDiag1 = [0.75 * this.hypotenuseLength, 0.75 * this.hypotenuseLength];
            ref_pointOnDiag2 = ref_corner;

            verticalOffset = this.hypotenuseLength;
        } else {
            ref_corner = [0, 0];
            ref_corner[0] += 1.5 * this.edgeLength;
            ref_corner[1] += 0.5 * this.edgeLength;

            ref_pointOnDiag1 = [this.edgeLength, this.edgeLength];
            ref_pointOnDiag2 = ref_corner;

            verticalOffset = 1.5 * this.edgeLength;
        }

        // Check which distance to calculate
        if (ref_mirroredPoint[1] <= ref_corner[1]) {

            // Vertical Distance
            result = ref_mirroredPoint[0] - verticalOffset;

            // Check if point is inside
            if (ref_mirroredPoint[0] <= verticalOffset) {
                result = 0;
            }
        } else {

            // Check if point is in the lower half of the first quadrant with respect to the corner Point -> use cornerDistance, else diagonal distance
            let con_mirroredPoint = this.translatePoint2d(ref_corner, ref_mirroredPoint);
            if (con_mirroredPoint[0] >= con_mirroredPoint[1]) {

                // Distance Corner
                result = this.pointDistance2d(ref_corner, ref_mirroredPoint);
                // Check if point is inside
                if (this.absoluteValue2d(ref_mirroredPoint) < this.absoluteValue2d(ref_corner)) {
                    result = 0;
                }
            } else {
                // Diagonal Distance
                // Move the relevant points so they are relative to the right angled triangle (rat) spanned up by the both diagonal limiting points
                let ref_CornerPointOfDiagTriangle = [
                    ref_pointOnDiag1[0],
                    ref_pointOnDiag2[1]
                ]
                let rat_pointOnDiag1 = this.translatePoint2d(ref_CornerPointOfDiagTriangle, ref_pointOnDiag1);
                let rat_camPoint = this.translatePoint2d(ref_CornerPointOfDiagTriangle, ref_mirroredPoint);
                let rat_Intersection = [
                    (rat_pointOnDiag1[1] - rat_camPoint[1] + rat_camPoint[0]) / 2,
                    0
                ]
                rat_Intersection[1] = -rat_Intersection[0] + rat_pointOnDiag1[1];

                let distanceDiagonal = this.pointDistance2d(rat_Intersection, rat_camPoint);
                result = distanceDiagonal;

                // Check if point is inside 
                let isInside = rat_camPoint[0] < 0 || rat_camPoint[1] < 0 || rat_camPoint[1] < -rat_camPoint[0] + rat_pointOnDiag1[1];

                if (isInside) {
                    result = 0;
                }
            }
        }

        // If we have the geom min max use this, else edge length times 2
        let heightBound;

        if (this.raster.getParameters().useMinMaxForErrors && this.geomErrorNode && this.geomErrorNode.b && this.geomErrorNode.b.length == 2) {

            //TODO: Should we increase this bounds?
            heightBound = [this.raster.getParameters().heightScaling * this.geomErrorNode.b[0], this.raster.getParameters().heightScaling * this.geomErrorNode.b[1]]
        } else {
            heightBound = [0, Math.max(this.edgeLength * 2, this.raster.getParameters().estMaxHeight * this.raster.getParameters().heightScaling)];
        }

        // Check third dimension
        if (ref_mirroredPoint[2] < heightBound[0]) {
            if (result == 0) {
                result = heightBound[0] - ref_mirroredPoint[2]
            } else {
                result = Math.sqrt(Math.pow(heightBound[0] - ref_mirroredPoint[2], 2) + Math.pow(result, 2));
            }
        }

        if (ref_mirroredPoint[2] >= heightBound[1]) {
            if (result == 0) {
                result = ref_mirroredPoint[2] - heightBound[1];
            } else {
                result = Math.sqrt(Math.pow(ref_mirroredPoint[2] - heightBound[1], 2) + Math.pow(result, 2));
            }
        }


        // if result is 0 cam inside of octohedron => should split
        if (result == 0) {
            result = Number.MAX_VALUE;
        } else {
            result = 1.0 / Math.pow(result, this.raster.getParameters().distanceMetricExponent)
        }

        return result;
    }

    /**
     * Calculates the culling error
     * First transform vertices of octohedron to cam space, 
     * then see for all clipping planes some vertex is on the correct side.
     * If for all clipping planes all vertices are inside also child octohedrons are entirely in frustum
     * @param {Camera} camera 
     */
    calculateCullingError = (camera) => {
        if (this.isEntirelyInFrustum) {
            return 1;

        }

        let minMaxBounds;
        if (this.geomErrorNode && this.geomErrorNode.b && this.geomErrorNode.b.length == 2) {
            minMaxBounds = [
                this.raster.getParameters().heightScaling * this.geomErrorNode.b[0],
                this.raster.getParameters().heightScaling * this.geomErrorNode.b[1]
            ];
        } else {
            minMaxBounds = [0, Math.max(this.edgeLength * 2, this.raster.getParameters().estMaxHeight * this.raster.getParameters().heightScaling)];
        }
        let verticesIn2d = [];
        if (this.type < 4) {
            verticesIn2d.push([
                this.refinementPoint[0] + this.hypotenuseLength / 2,
                this.refinementPoint[1] + this.hypotenuseLength,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.hypotenuseLength,
                this.refinementPoint[1] + this.hypotenuseLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.hypotenuseLength,
                this.refinementPoint[1] - this.hypotenuseLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.hypotenuseLength / 2,
                this.refinementPoint[1] - this.hypotenuseLength,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.hypotenuseLength / 2,
                this.refinementPoint[1] - this.hypotenuseLength,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.hypotenuseLength,
                this.refinementPoint[1] - this.hypotenuseLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.hypotenuseLength,
                this.refinementPoint[1] + this.hypotenuseLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.hypotenuseLength / 2,
                this.refinementPoint[1] + this.hypotenuseLength,
            ]);
        } else {
            verticesIn2d.push([
                this.refinementPoint[0] + this.edgeLength / 2,
                this.refinementPoint[1] + this.edgeLength * 1.5,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.edgeLength * 1.5,
                this.refinementPoint[1] + this.edgeLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.edgeLength * 1.5,
                this.refinementPoint[1] - this.edgeLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] + this.edgeLength / 2,
                this.refinementPoint[1] - this.edgeLength * 1.5,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.edgeLength / 2,
                this.refinementPoint[1] - this.edgeLength * 1.5,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.edgeLength * 1.5,
                this.refinementPoint[1] - this.edgeLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.edgeLength * 1.5,
                this.refinementPoint[1] + this.edgeLength / 2,
            ]);
            verticesIn2d.push([
                this.refinementPoint[0] - this.edgeLength / 2,
                this.refinementPoint[1] + this.edgeLength * 1.5,
            ]);
        }
        let vertices = [
            ...verticesIn2d.map(vert => [...vert, minMaxBounds[0]]),
            ...verticesIn2d.map(vert => [...vert, minMaxBounds[1]])
        ]
        
        this.isEntirelyInFrustum = true;
        let intersects = true;

        for (let i = 0; i < camera.clippingPlanes.length; i++) {
            let somePointInside = false;

            // Check all corners of the octohedron -> for each plane at least one corner must be on the correct side of it
            for (let i2 = 0; i2 < 16; i2++) {
                let vert = vertices[i2];
                let val = v3.dot(v3.subtract(vert, camera.clippingPlanes[i].p), camera.clippingPlanes[i].normal);
                if (val < 0) {
                    this.isEntirelyInFrustum = false;

                    // No need to check further, found a point on the correct side and it is not entirely in frustum
                    if (somePointInside) {
                        break;
                    }
                } else {
                    somePointInside = true;

                    // No need to check further, found a point on the correct side and it is not entirely in frustum
                    if (!this.isEntirelyInFrustum) {
                        break;
                    }
                }
            }
            if (!somePointInside) {
                intersects = false;
                break;
            }
        }

        return intersects ? 1 : 0;
    }

    /**
     * Calculates the point that lays in the first quadrant (upper left) as seen from the origin
     * @param {Array} point 
     */
    mirrorPointIntoFirstQuadrant = (point) => {
        let result = [point[0], point[1]];

        if (result[0] < 0) {
            result[0] = -result[0];
        }
        if (result[1] < 0) {
            result[1] = -result[1];
        }

        if (point[2] !== undefined) {
            result.push(point[2]);
        }

        return result;
    }

    /**
     * Translate Point so that the refinement point is at 0/0 
     */
    translatePointToRefinement = (point) => {
        let result = this.translatePoint2d(this.refinementPoint, point);
        if (point[2] !== undefined) {
            result.push(point[2]);
        }
        return result;
    }

    /**
     * Calculates the distance between 2d points
     * @param {Number[]} point1 
     * @param {Number[]} point2 
     */
    pointDistance2d = (point1, point2) => {
        return Math.sqrt(Math.pow(point1[0] - point2[0], 2) + Math.pow(point1[1] - point2[1], 2));
    }

    /**
     * Calculates the absolute value of a point/vector in 2d
     * @param {Number[]} point 
     */
    absoluteValue2d = (point) => {
        return Math.sqrt(Math.pow(point[0], 2) + Math.pow(point[1], 2))
    }

    /**
     * 
     * @param {Number[]} newOrigin 
     * @param {Number[]} point 
     */
    translatePoint2d = (newOrigin, point) => {
        return [
            point[0] - newOrigin[0],
            point[1] - newOrigin[1],
        ]
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

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Top left)
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.hypotenuseLength / 4;
        childrenRefinementPoint[1] -= this.hypotenuseLength / 4;
        let childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];


        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPLEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.firstChildGeomErrorNode));

        // Second Child (Bottom Left)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.hypotenuseLength / 4;
        childrenRefinementPoint[1] += this.hypotenuseLength / 4;
        childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMLEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.secondChildGeomErrorNode));
    }

    splitTop = () => {
        this.children = [];

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Top Right)
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.hypotenuseLength / 4;
        childrenRefinementPoint[1] -= this.hypotenuseLength / 4;
        let childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPRIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.firstChildGeomErrorNode));

        // Second Child (Top Left)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.hypotenuseLength / 4;
        childrenRefinementPoint[1] -= this.hypotenuseLength / 4;
        childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPLEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.secondChildGeomErrorNode));
    }

    splitRight = () => {
        this.children = [];

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Bottom Right)
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.hypotenuseLength / 4;
        childrenRefinementPoint[1] += this.hypotenuseLength / 4;
        let childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] + currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMRIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.firstChildGeomErrorNode));

        // Second Child (Top Right)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.hypotenuseLength / 4;
        childrenRefinementPoint[1] -= this.hypotenuseLength / 4;
        childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOPRIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.secondChildGeomErrorNode));
    }

    splitBottom = () => {
        this.children = [];
        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
        let childrenLod = this.lod + 1;
        let currentDisplacement = this.childDisplacementInCurrentMblock;

        // First Child (Bottom Left)
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.hypotenuseLength / 4;
        childrenRefinementPoint[1] += this.hypotenuseLength / 4;
        let childOffset = [
            this.offsetMblock[0] + currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMLEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.firstChildGeomErrorNode));

        // Second Child (Bottom Right)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.hypotenuseLength / 4;
        childrenRefinementPoint[1] += this.hypotenuseLength / 4;
        childOffset = [
            this.offsetMblock[0] - currentDisplacement,
            this.offsetMblock[1] - currentDisplacement
        ];

        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOMRIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, this.mblock, childOffset, this.secondChildGeomErrorNode));
    }

    // This should be correct
    splitTopLeft = () => {
        this.children = [];
        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
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
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.LEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.firstChildGeomErrorNode));

        // Second Child (Top)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[1] += this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOP, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.secondChildGeomErrorNode));
    }

    splitTopRight = () => {
        this.children = [];

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
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
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[1] += this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.TOP, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.firstChildGeomErrorNode));

        // Second Child (Right)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.RIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.secondChildGeomErrorNode));
    }

    splitBottomRight = () => {
        this.children = [];

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
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
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] += this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.RIGHT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.firstChildGeomErrorNode));

        // Second Child (Bottom)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[1] -= this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOM, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.secondChildGeomErrorNode));
    }

    splitBottomLeft = () => {
        this.children = [];

        let childrenEdgeLength = Math.sqrt(Math.pow(this.edgeLength, 2) * 2) / 2;
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
        let childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[1] -= this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.BOTTOM, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.firstChildGeomErrorNode));

        // Second Child (Left)
        childrenRefinementPoint = [...this.refinementPoint];
        childrenRefinementPoint[0] -= this.edgeLength / 2;
        this.children.push(new BinTreeNode(this.raster, BinTreeNode.LEFT, this, childrenRefinementPoint, childrenEdgeLength, childrenLod, childMblock, childrenOffsetMblock, this.secondChildGeomErrorNode));
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

export default BinTreeNode;