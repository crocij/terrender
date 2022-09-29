import Raster from "raster-core";
import * as twgl from 'twgl.js';
const finalFs = require('./shaders/final.frag');
const finalVs = require('./shaders/final.vert');
const finalES300Fs = require('./shaders/finalES300.frag');
const finalES300Vs = require('./shaders/finalES300.vert');

const MIN_SIDE_NUMBER_BUCKETS = 5;

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        255
    ] : null;
}

function subtractVec(v1, v2) {
    return [v1[0] - v2[0], v1[1] - v2[1]];
}

function addVec(v1, v2) {
    return [v1[0] + v2[0], v1[1] + v2[1]];
}

function scaleVec(v, factor) {
    return [v[0] * factor, v[1] * factor];
}

function normalizeVec(v) {
    let length = Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
    return [v[0] / length, v[1] / length];
}

class Drawing {
    /**
     * 
     * @param {Raster} raster 
     */
    constructor(raster) {
        this.raster = raster;
        this.isActive = false;
        this.changed = false;

        // Register Listeners
        let gl = raster.getGlInfo().getGl();
        gl.canvas.addEventListener('mousedown', this.mouseDown);
        gl.canvas.addEventListener('mouseup', this.mouseUp);
        gl.canvas.addEventListener('mousemove', this.mouseMove);
        gl.canvas.addEventListener('mouseleave', this.mouseLeave);

        gl.canvas.addEventListener('touchstart', this.touchStart);
        gl.canvas.addEventListener('touchmove', this.touchMove);
        gl.canvas.addEventListener('touchend', this.touchEnd);
        this.lineTexture = undefined;

        this.lines = []; 
        this.currentLine = undefined;
        this.mouseDown = false;

        // Setup Buckets
        let boundaries = this.raster.getParameters().boundaries;
        let xDim = boundaries[2] - boundaries[0];
        let yDim = boundaries[3] - boundaries[1];
        this.bucketsX = 0;
        this.bucketsY = 0;
        if (xDim > yDim) {
            this.bucketsY = MIN_SIDE_NUMBER_BUCKETS;
            this.bucketsX = Math.floor(this.bucketsY * (xDim / yDim));
        } else {
            this.bucketsX = MIN_SIDE_NUMBER_BUCKETS;
            this.bucketsY = Math.floor(this.bucketsX * (yDim / xDim));
        }

        this.buckets = [];
        this.bucketStepX = xDim / this.bucketsX;
        this.bucketStepY = yDim / this.bucketsY;
        for (let i2 = 0; i2 < this.bucketsY; i2++) {
            for (let i = 0; i < this.bucketsX; i++) {
                let lowerLeft = [
                    boundaries[0] + i * this.bucketStepX,
                    boundaries[1] + i2 * this.bucketStepY,
                ]
                let lowerRight = [
                    boundaries[0] + (i + 1) * this.bucketStepX,
                    boundaries[1] + i2 * this.bucketStepY,
                ]
                let upperLeft = [
                    boundaries[0] + i * this.bucketStepX,
                    boundaries[1] + (i2 + 1) * this.bucketStepY,
                ]
                let upperRight = [
                    boundaries[0] + (i + 1) * this.bucketStepX,
                    boundaries[1] + (i2 + 1) * this.bucketStepY,
                ]
                this.buckets.push({
                    lowerLeftP: lowerLeft,
                    lowerLeftV: subtractVec(upperLeft, lowerLeft),
                    lowerRightP: lowerRight,
                    lowerRightV: subtractVec(lowerLeft, lowerRight),
                    upperLeftP: upperLeft,
                    upperLeftV: subtractVec(upperRight, upperLeft),
                    upperRightP: upperRight,
                    upperRightV: subtractVec(lowerRight, upperRight),
                    indices: [],
                })
            }
        }

        // Determine LineWidth scale factor
        this.baseLineWidth = Math.min(xDim, yDim) / 1000;

        // Config Setup
        this.colorPickerInput = document.querySelector('#colorPicker');
        this.colorPickerInput.addEventListener('change', () => this.currentColor = hexToRgb(this.colorPickerInput.value));
        this.currentColor = hexToRgb(this.colorPickerInput.value);

        this.deleteLineCheckbox = document.querySelector('#deleteLine');
        this.deleteLineCheckbox.addEventListener('change', () => this.deleteMode = this.deleteLineCheckbox.checked);
        this.deleteMode = this.deleteLineCheckbox.checked;

        this.lineWidthInput = document.querySelector('#lineWidth');
        this.lineWidthInput.addEventListener('change', () => {
            if (this.lineWidthInput.value <= 0) {
                this.lineWidthInput.value = this.currentLineWidth / this.baseLineWidth;
                return;
            }
            this.currentLineWidth = Number.parseFloat(this.lineWidthInput.value) * this.baseLineWidth;
        });
        this.currentLineWidth = Number.parseFloat(this.lineWidthInput.value) * this.baseLineWidth;

        this.downloadButton = document.querySelector('#downloadLines');
        this.downloadButton.disabled = true;
        this.downloadButton.addEventListener('click', () => {
            if (this.lines.length == 0) {
                return;
            }
            let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.lines));
            let downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "lines.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        })

        this.uploadLinesButton = document.querySelector('#uploadLines');
        this.uploadLinesFile = document.querySelector('#uploadLinesFile');
        this.uploadLinesButton.addEventListener('click', () => {
            if (!this.uploadLinesFile.value.length) {
                return;
            }

            this.handleUpload(this.uploadLinesFile.files[0]);
            this.uploadLinesFile.value = '';
        });
        this.fileErrorDiv = document.querySelector('#fileError');

        // Setup Combination Rendering Step
        if (this.raster.getGlInfo().isWebGL2()) {
            this.programInfo = twgl.createProgramInfo(gl, [finalES300Vs, finalES300Fs]);
        } else {
            this.programInfo = twgl.createProgramInfo(gl, [finalVs, finalFs]);
        }

        let vPlanarPosition = [
            -1.0, -1.0,
            1.0, -1.0,
            1.0, 1.0,
            -1.0, 1.0,
        ]

        let indices = [
            0, 1, 2,
            0, 2, 3
        ]

        this.vbo = twgl.createBufferInfoFromArrays(gl, {

            // Twgl does not understand that the first array buffer only has two components hence set it manually
            vPlanarPosition: { numComponents: 2, data: vPlanarPosition },
            indices: indices,
        });

        this.createTextures()
    }

    renderResult = () => {
        let gl = this.raster.getGlInfo().getGl();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.programInfo.program);

        twgl.setBuffersAndAttributes(gl, this.programInfo, this.vbo);
        let generalUniforms = {
            colorTexture: this.raster.getGlInfo().getColorTexture(),
            pixelPosTextureX: this.raster.getGlInfo().getPixelPosTextureX(),
            pixelPosTextureY: this.raster.getGlInfo().getPixelPosTextureY(),
            linesTexture: this.lineTexture,
            linesLength: this.lines.length,
            renderCurrentLine: this.currentLine !== undefined,
            currentLineP1: this.currentLine ? this.currentLine.p1 : [0, 0],
            currentLineP2: this.currentLine ? this.currentLine.p2 : [0, 0],
            currentLineWidth: this.currentLine ? this.currentLine.width : 1.0,
            currentLineColor: this.currentLine ? this.currentLine.color : [0, 0, 0, 0],
            boundaries: this.raster.getParameters().boundaries,
            bucketDimensions: [this.bucketsX, this.bucketsY],
            bucketsTexture: this.bucketTexture,
            maxLinesBucket: this.maxLinesBucket,
        }

        twgl.setUniforms(this.programInfo, generalUniforms);
        gl.drawElements(
            gl.TRIANGLES,
            this.vbo.numElements,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    hasChanged = () => {
        let res = this.changed;
        this.changed = false;
        return res;
    }

    handleUpload = (file) => {
        let reader = new FileReader();

        // Setup the callback event to run when the file is read
        reader.onload = (event) => {
            try {
                let jsonArray = JSON.parse(event.target.result);
                jsonArray.forEach(line => {
                    this.sortLineIntoBuckets(line, this.lines.length);
                    this.lines.push(line);
                });
                this.createTextures();
                this.fileErrorDiv.innerHTML = '';
            } catch (err) {
                this.fileErrorDiv.innerHTML = 'Invalid JSON File'
            }
        };

        // Read the file
        reader.readAsText(file);
    }

    setActive = (value) => {
        this.isActive = value;
    }

    getLinesToDraw = () => {
        if (this.currentLine) {
            return [this.currentLine, ... this.lines];
        }

        return this.lines;
    }

    createTextures = () => {
        this.changed = true;
        this.createBucketTexture();
        this.createLineTexture();
    }

    createLineTexture = () => {
        let gl = this.raster.getGlInfo().getGl();
        if (this.lines.length == 0) {

            // Set Fallback Texture
            this.lineTexture = twgl.createTexture(gl, {
                src: [0,0,0,0],
                format: gl.RGBA,
                height: 1,
                minMag: gl.NEAREST,
                wrap: gl.CLAMP_TO_EDGE,
            });            
            return;
        }

        this.downloadButton.disabled = false;

        let p1x = [];
        let p1y = [];
        let p2x = [];
        let p2y = [];
        let width = [];
        let color = [];
        this.lines.forEach(line => {
            p1x.push(line.p1[0]);
            p1y.push(line.p1[1]);
            p2x.push(line.p2[0]);
            p2y.push(line.p2[1]);
            width.push(line.width);
            let temp = new Uint8Array(line.color)
            color.push(new Float32Array(temp.buffer)[0]);
        });
        let f32Arr = new Float32Array(p1x.concat(p1y).concat(p2x).concat(p2y).concat(width).concat(color));
        let u8arr = new Uint8Array(f32Arr.buffer);
        this.lineTexture = twgl.createTexture(gl, {
            src: u8arr,
            format: gl.RGBA,
            height: 6,
            minMag: gl.NEAREST,
            wrap: gl.CLAMP_TO_EDGE,
        });
    }

    createBucketTexture = () => {
        let gl = this.raster.getGlInfo().getGl();
        let maxLength = Number.MIN_SAFE_INTEGER;
        this.buckets.forEach(bucket => {
            if (bucket.indices.length > maxLength) {
                maxLength = bucket.indices.length;
            }
        });

        if (maxLength == 0) {
            this.maxLinesBucket = maxLength;

            // Set Fallback texture
            this.bucketTexture = twgl.createTexture(gl, {
                src: [0, 0, 0, 0],
                format: gl.RGBA,
                height: 1,
                minMag: gl.NEAREST,
                wrap: gl.CLAMP_TO_EDGE,
            });

            return;
        }

        let texData = [];
        this.buckets.forEach(bucket => {
            if (bucket.indices.length > 0) {
                
                // Reverse the array so we can break out of loop in shader as soon as we have found a line
                let temp = [...bucket.indices].reverse();
                texData.push(...temp);
            }
            for (let i = bucket.indices.length; i < maxLength; i++) {
                texData.push(-1);
            }
        });

        let f32Arr = new Float32Array(texData);
        let u8Arr = new Uint8Array(f32Arr.buffer);
        this.maxLinesBucket = maxLength;
        this.bucketTexture = twgl.createTexture(gl, {
            src: u8Arr,
            format: gl.RGBA,
            height: this.buckets.length,
            minMag: gl.NEAREST,
            wrap: gl.CLAMP_TO_EDGE,
        });
    }

    sortLineIntoBuckets = (line, index) => {
        let lineV = subtractVec(line.p2, line.p1);
        let overhang = scaleVec(normalizeVec(lineV), line.width);
        let p1Out = subtractVec(line.p1, overhang);
        let p2Out = addVec(line.p2, overhang);
        lineV = subtractVec(p2Out, p1Out);
        let rectangularVec = [-overhang[1], overhang[0]];

        let startPoint1 = addVec(p1Out, rectangularVec);
        let startPoint2 = subtractVec(p1Out, rectangularVec);

        let vecShortSide = subtractVec(startPoint2, startPoint1);
        let startPoint1Prime = addVec(startPoint1, lineV);


        for (let i = 0; i < this.buckets.length; i++) {
            let bucket = this.buckets[i];
            let isP1Inside = p1Out[0] >= bucket.lowerLeftP[0] && p1Out[0] <= bucket.lowerRightP[0] && p1Out[1] >= bucket.lowerLeftP[1] && p1Out[1] <= bucket.upperLeftP[1];
            let isP2Inside = p2Out[0] >= bucket.lowerLeftP[0] && p2Out[0] <= bucket.lowerRightP[0] && p2Out[1] >= bucket.lowerLeftP[1] && p2Out[1] <= bucket.upperLeftP[1];
            if (isP1Inside || isP2Inside) {
                bucket.indices.push(index);
                continue;
            }

            // Check if line bounding box intersects any of the four sides
            if (
                this.checkIntersection({ p: startPoint1, v: lineV }, { p: bucket.lowerLeftP, v: bucket.lowerLeftV }) ||
                this.checkIntersection({ p: startPoint2, v: lineV }, { p: bucket.lowerLeftP, v: bucket.lowerLeftV }) ||
                this.checkIntersection({ p: startPoint1, v: vecShortSide }, { p: bucket.lowerLeftP, v: bucket.lowerLeftV }) ||
                this.checkIntersection({ p: startPoint1Prime, v: vecShortSide }, { p: bucket.lowerLeftP, v: bucket.lowerLeftV })
            ) {
                bucket.indices.push(index);
                continue;
            }
            if (
                this.checkIntersection({ p: startPoint1, v: lineV }, { p: bucket.upperLeftP, v: bucket.upperLeftV }) ||
                this.checkIntersection({ p: startPoint2, v: lineV }, { p: bucket.upperLeftP, v: bucket.upperLeftV }) ||
                this.checkIntersection({ p: startPoint1, v: vecShortSide }, { p: bucket.upperLeftP, v: bucket.upperLeftV }) ||
                this.checkIntersection({ p: startPoint1Prime, v: vecShortSide }, { p: bucket.upperLeftP, v: bucket.upperLeftV })
            ) {
                bucket.indices.push(index);
                continue;
            }
            if (
                this.checkIntersection({ p: startPoint1, v: lineV }, { p: bucket.upperRightP, v: bucket.upperRightV }) ||
                this.checkIntersection({ p: startPoint2, v: lineV }, { p: bucket.upperRightP, v: bucket.upperRightV }) ||
                this.checkIntersection({ p: startPoint1, v: vecShortSide }, { p: bucket.upperRightP, v: bucket.upperRightV }) ||
                this.checkIntersection({ p: startPoint1Prime, v: vecShortSide }, { p: bucket.upperRightP, v: bucket.upperRightV })
            ) {
                bucket.indices.push(index);
                continue;
            }
            if (
                this.checkIntersection({ p: startPoint1, v: lineV }, { p: bucket.lowerRightP, v: bucket.lowerRightV }) ||
                this.checkIntersection({ p: startPoint2, v: lineV }, { p: bucket.lowerRightP, v: bucket.lowerRightV }) ||
                this.checkIntersection({ p: startPoint1, v: vecShortSide }, { p: bucket.lowerRightP, v: bucket.lowerRightV }) ||
                this.checkIntersection({ p: startPoint1Prime, v: vecShortSide }, { p: bucket.lowerRightP, v: bucket.lowerRightV })
            ) {
                bucket.indices.push(index);
                continue;
            }

            // Note that the bucket could also be entirely inside the bounding box (but lay close to the rounded corners of the line hence we have to check all corners)
            if (this.isOnLine(bucket.lowerLeftP, line) || this.isOnLine(bucket.upperLeftP, line) || this.isOnLine(bucket.upperRightP, line) || this.isOnLine(bucket.lowerRightP, line)) {
                bucket.indices.push(index);
            }
        }
    }

    checkIntersection = (line1, line2) => {

        // According to https://stackoverflow.com/questions/4977491/determining-if-two-line-segments-intersect/4977569#4977569
        let det = line2.v[0] * line1.v[1] - line1.v[0] * line2.v[1];
        if (det == 0) {
            return false;
        }

        let s = (1 / det) * ((line1.p[0] - line2.p[0]) * line1.v[1] - (line1.p[1] - line2.p[1]) * line1.v[0]);
        let t = (1 / det) * (-((line2.p[0] - line1.p[0]) * line2.v[1] + (line1.p[1] - line2.p[1]) * line2.v[0]));
        return s >= 0 && s <= 1 && t >= 0 && t <= 1
    }

    isOnLine = (pos, line) => {
        let diffX = line.p2[0] - line.p1[0];
        let diffY = line.p2[1] - line.p1[1];

        let distToLine = Math.abs(diffX * (line.p1[1] - pos[1]) - (line.p1[0] - pos[0]) * diffY) / Math.sqrt(diffX * diffX + diffY * diffY);

        if (distToLine < line.width) {
            let maxDist = Math.sqrt(Math.pow(Math.sqrt(diffX * diffX + diffY * diffY), 2) + line.width * line.width);
            let distP1 = Math.sqrt(Math.pow(line.p1[0] - pos[0], 2) + Math.pow(line.p1[1] - pos[1], 2));
            let distP2 = Math.sqrt(Math.pow(line.p2[0] - pos[0], 2) + Math.pow(line.p2[1] - pos[1], 2));
            if ((distP1 <= maxDist && distP2 <= maxDist) || distP1 < line.width || distP2 < line.width) {
                return true;
            }
        }
        return false;
    }

    getBucketIndex = (pos) => {
        let indexX = Math.floor((pos[0] - this.raster.getParameters().boundaries[0]) / this.bucketStepX);
        let indexY = Math.floor((pos[1] - this.raster.getParameters().boundaries[1]) / this.bucketStepY);
        return indexY * this.bucketsX + indexX;
    }

    deleteLineAtPos = (pos) => {
        let bucketIndex = this.getBucketIndex(pos);
        let lineIndexToDelete = -1;
        for (let i = this.buckets[bucketIndex].indices.length - 1; i >= 0; i--) {
            let candidate = this.lines[this.buckets[bucketIndex].indices[i]];
            if (this.isOnLine(pos, candidate)) {
                lineIndexToDelete = this.buckets[bucketIndex].indices[i];
                break;
            }
        }

        if (lineIndexToDelete >= 0) {
            this.lines.splice(lineIndexToDelete, 1);
            this.buckets.forEach(bucket => {
                let localIndex = bucket.indices.findIndex(index => index === lineIndexToDelete);
                if (localIndex >= 0) {
                    bucket.indices.splice(localIndex, 1);
                }
                bucket.indices = bucket.indices.map(index => index > lineIndexToDelete ? index - 1 : index);
            });
            this.createTextures();
        }
    }

    mouseDown = (event) => {
        if (!this.isActive || this.deleteMode) {
            return;
        }

        this.changed = true;
        this.mouseDown = true;
        let currentPos = this.getMousePosition(event.offsetX, event.offsetY);
        this.currentLine = {
            p1: currentPos,
            p2: currentPos,
            width: this.currentLineWidth,
            color: this.currentColor,
        }
    }

    mouseUp = (event) => {
        if (!this.isActive) {
            return;
        }

        if (!this.deleteMode) {
            if (this.mouseDown && this.currentLine) {
                this.sortLineIntoBuckets(this.currentLine, this.lines.length);
                this.lines.push(this.currentLine);
                this.createTextures();
            }
            this.currentLine = undefined;
            this.mouseDown = false;
        } else {
            let coords = this.getMousePosition(event.offsetX, event.offsetY);
            if (coords[0] == 0.0 && coords[1] == 0.0) {
                return;
            }
            this.deleteLineAtPos(coords);
        }
    }

    mouseMove = (event) => {
        if (!this.isActive || this.deleteMode) {
            return;
        }

        if (this.mouseDown && this.currentLine) {
            let coords = this.getMousePosition(event.offsetX, event.offsetY);

            // Mouse is not on surface, but should also check more see below
            if (coords[0] == 0.0 && coords[1] == 0.0) {
                return;
            }

            this.currentLine.p2 = coords;
            this.changed = true;
        }
    }

    mouseLeave = (event) => {
        if (!this.isActive || this.deleteMode) {
            return;
        }

        if (this.mouseDown && this.currentLine) {
            this.sortLineIntoBuckets(this.currentLine, this.lines.length);
            this.lines.push(this.currentLine);
            this.createTextures();
        }

        this.currentLine = undefined;
        this.mouseDown = false;
    }

    touchStart = (event) => {
        if (!this.isActive || this.deleteMode) {
            return;
        }

        this.mouseDown = true;
        this.changed = true;

        let currentPos = this.getMousePosition(...this.extractCoordsFromTouchEvent(event));
        this.currentLine = {
            p1: currentPos,
            p2: currentPos,
            width: this.currentLineWidth,
            color: this.currentColor,
        }
    }

    touchMove = (event) => {
        if (!this.isActive) {
            return;
        }

        if (this.mouseDown && this.currentLine && !this.deleteMode) {
            let coords = this.getMousePosition(...this.extractCoordsFromTouchEvent(event));
            // Mouse is not on surface
            if (coords[0] == 0.0 && coords[1] == 0 && this.isMousePositionOutside(event.offsetX, event.offsetY)) {
                return;
            }
            this.changed = true;
            this.currentLine.p2 = coords;
        } else if (this.deleteMode) {

            // Touch end event does not provide the removed touch point so save it here for later
            this.deletePrevCoords = this.getMousePosition(...this.extractCoordsFromTouchEvent(event));
        }
    }

    touchEnd = (event) => {
        if (!this.isActive) {
            return;
        }

        if (!this.deleteMode) {
            if (this.mouseDown) {
                this.sortLineIntoBuckets(this.currentLine, this.lines.length);
                this.lines.push(this.currentLine);
                this.createTextures()
            }

            this.currentLine = undefined;
            this.mouseDown = false;
        } else if (this.deletePrevCoords) {
            let coords = this.deletePrevCoords;
            delete this.deletePrevCoords;
            if (coords[0] == 0.0 && coords[1] == 0.0) {
                return;
            }
            this.deleteLineAtPos(coords);
        }
    }

    extractCoordsFromTouchEvent = (event) => {
        var bcr = event.target.getBoundingClientRect();
        var x = event.targetTouches[0].pageX - bcr.x;
        var y = event.targetTouches[0].pageY - bcr.y;
        return [x, y];
    }

    getMousePosition = (inputX, inputY) => {
        if (this.raster.getGlInfo().isWebGL2()) {
            return this.getMousePositionGL2(inputX, inputY);
        } else {
            return this.getMousePositionGL1(inputX, inputY);
        }
    }

    getMousePositionGL1 = (inputX, inputY) => {
        let x = 0;
        let y = 0;
        let gl = this.raster.getGlInfo().getGl();
        let mouseX = Math.floor(inputX);
        let mouseY = Math.floor(gl.canvas.height - inputY);
        if (this.raster.getGlInfo().getPixelPosRenderTargetX()) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raster.getGlInfo().getPixelPosRenderTargetX());
            let posArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, posArray);
            posArray = new Float32Array(posArray.buffer);
            x = posArray[0];
        }
        if (this.raster.getGlInfo().getPixelPosRenderTargetY()) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raster.getGlInfo().getPixelPosRenderTargetY());
            let posArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, posArray);
            posArray = new Float32Array(posArray.buffer);
            y = posArray[0];
        }
        return [x, y];
    }

    getMousePositionGL2 = (inputX, inputY) => {
        let x = 0;
        let y = 0;
        let gl = this.raster.getGlInfo().getGl();
        let mouseX = Math.floor(inputX);
        let mouseY = Math.floor(gl.canvas.height - inputY);
        if (this.raster.getGlInfo().getCombinedRenderTarget()) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raster.getGlInfo().getCombinedRenderTarget());
            gl.readBuffer(gl.COLOR_ATTACHMENT1)
            let posArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, posArray);
            posArray = new Float32Array(posArray.buffer);
            x = posArray[0];

            gl.readBuffer(gl.COLOR_ATTACHMENT2)
            posArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, posArray);
            posArray = new Float32Array(posArray.buffer);
            y = posArray[0];
        }
        
        return [x, y];
    }

    isMousePositionOutside = (inputX, inputY) => {
        if (this.raster.getGlInfo().isWebGL2()) {
            return this.isMousePositionOutsideGL2(inputX, inputY);
        } else {
            return this.isMousePositionOutsideGL1(inputX, inputY);
        }
    }

    // TODO: Sporadically this does not work
    isMousePositionOutsideGL1 = (inputX, inputY) => {
        let gl = this.raster.getGlInfo().getGl();
        let mouseX = Math.floor(inputX);
        let mouseY = Math.floor(gl.canvas.height - inputY);
        if (this.raster.getGlInfo().getColorRenderTarget()) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raster.getGlInfo().getColorRenderTarget());
            let colorArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, colorArray);

            // if alpha in the color buffer is not zero it is inside
            return colorArray[3] != 0.0;
        }
        return true;
    }

    // TODO: Sporadically this does not work
    isMousePositionOutsideGL2 = (inputX, inputY) => {
        let gl = this.raster.getGlInfo().getGl();
        let mouseX = Math.floor(inputX);
        let mouseY = Math.floor(gl.canvas.height - inputY);
        if (this.raster.getGlInfo().getCombinedRenderTarget()) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raster.getGlInfo().getCombinedRenderTarget());
            gl.readBuffer(gl.COLOR_ATTACHMENT0)
            let colorArray = new Uint8Array(4);
            gl.readPixels(mouseX, mouseY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, colorArray);

            // if alpha in the color buffer is not zero it is inside
            return colorArray[3] != 0.0;
        }
        return true;
    }
}

export default Drawing;