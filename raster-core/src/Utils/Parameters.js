const paramsRequiringRedraw = [
    'showLodAsColor',
    'renderFlat',
    'renderGeometry',
    'renderKPatchLines',
    'renderUniColor'
];

const paramsRequiringUpdateDataStructures = [
    'kPatchBase',
    'currentLod',
    'errorThreshold',
    'useCullingMetric',
    'useGeomMetric',
    'heightScaling',
    'useDistanceMetric',
    'useMinMaxForErrors',
    'estMaxHeight'
];

const paramsRequiringResetBintree = [
    'kPatchBase',
    'currentLod',
];

const paramsRequiringReloadGeomError = [
    'useGeomMetric',
    'getGeomErrorSlug',
    'kPatchBase',
    'currentLod',
]

const paramsRequiringSavingViewFrustum = [
    'disableUpdateOnCam',
]

class Parameters {
    constructor(parameters = {}) {
        this._shouldRedraw = false;
        this._shouldRecalculate = false;
        this._shouldResetBintree = false;
        this._shouldReloadGeomError = false;
        this._shouldSaveViewFrustum = false;
        this.kPatchBase = parameters.kPatchBase || 129;
        this.tileSideLength = parameters.tileSideLength || 257;
        this.maxLod = parameters.maxLod || 7;
        this.currentLod = parameters.currentLod || 7;
        this.errorThreshold = parameters.errorThreshold || 0.01;
        this.useCullingMetric = parameters.useCullingMetric !== undefined ? parameters.useCullingMetric : true;
        this.useDistanceMetric = parameters.useDistanceMetric !== undefined ? parameters.useDistanceMetric : true;
        this.maxGpuCache = parameters.maxGpuCache || 200;
        this.maxRamCache = parameters.maxRamCache || 400;
        this.disableUpdateOnCam = parameters.disableUpdateOnCam || false;
        this.showLodAsColor = parameters.showLodAsColor || false;
        this.renderFlat = parameters.renderFlat || false;
        this.renderGeometry = parameters.renderGeometry || false;
        this.renderKPatchLines = parameters.renderKPatchLines || false;
        this.getGeomErrorSlug = parameters.getGeomErrorSlug;
        this.useGeomMetric = parameters.useGeomMetric !== undefined ? parameters.useGeomMetric : false;
        this.useMinMaxForErrors = parameters.useMinMaxForErrors || false;
        this.heightScaling = parameters.heightScaling || 0.000025;
        this.renderUniColor = parameters.renderUniColor || false;
        this.boundaries = parameters.boundaries || [-180, -90, 180, 90];
        this.xStart = parameters.xStart || 0;
        this.yStart = parameters.yStart || 0;
        this.noColorTextures = parameters.noColorTextures || false;
        this.colorIsTiff = parameters.colorIsTiff || false;
        this.heightIsTiff = parameters.heightIsTiff || false;
        this.estMaxHeight = parameters.estMaxHeight || 10000;
        this.distanceMetricExponent = parameters.distanceMetricExponent || 2;
        this.dynamicBinTreeUpdate = parameters.dynamicBinTreeUpdate !== undefined ? parameters.dynamicBinTreeUpdate : true;
        this.dynamicBinTreeUpdateTreeLengthRatio = parameters.dynamicBinTreeUpdateTreeLengthRatio !== undefined ? parameters.dynamicBinTreeUpdateTreeLengthRatio : 0.75;
        this.dynamicBinTreeUpdateNotReadyRatio = parameters.dynamicBinTreeUpdateNotReadyRatio !== undefined ? parameters.dynamicBinTreeUpdateNotReadyRatio : 0.2;
        this.errorCallback = typeof parameters.errorCallback === 'function' ? parameters.errorCallback : (err, message) => {
            console.log(message);
            console.error(err);
        };
        this.isIOS = (
            (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) ||
            
            // https://stackoverflow.com/questions/57776001/how-to-detect-ipad-pro-as-ipad-using-javascript 
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent)
            ));
        this.calculateDerivedParams();
    }

    /**
     * Set a specific param
     * @param {string} name 
     * @param {*} value 
     * @returns 
     */
    setParam = (name, value) => {
        if (this[name] === undefined) {
            console.warn('Unknown Param: ' + name)
            return;
        }
        if (this[name] === value) {
            return
        }
        this[name] = value;
        if (paramsRequiringRedraw.find(param => param === name)) {
            this._shouldRedraw = true;
        }
        if (paramsRequiringSavingViewFrustum.find(param => param === name)) {
            this._shouldSaveViewFrustum = true;
        }
        if (paramsRequiringUpdateDataStructures.find(param => param === name)) {
            this._shouldRecalculate = true;
            this.calculateDerivedParams();
        }
        if (paramsRequiringResetBintree.find(param => param === name)) {
            this._shouldResetBintree = true;
            this.calculateDerivedParams();
        }
        if (paramsRequiringReloadGeomError.find(param => param === name)) {
            if (this.useGeomMetric || typeof this.getGeomErrorSlug == 'function') {
                this._shouldReloadGeomError = true;
            }
        }
    }

    /**
     * Set multiple params at once with an object like this: {paramName: newValue, param2Name: newValue2}
     * @param {object} params 
     */
    setParams = (params) => {
        Object.keys(params).forEach(paramName => {
            this.setParam(paramName, params[paramName]);
        })
    }

    /**
     * Calculate Params that are dynamic based on other params
     */
    calculateDerivedParams = () => {
        this.lodsFirstMblock = 2 * Math.log2((this.tileSideLength - 1) / (this.kPatchBase - 1));

        // Note that maxLod also has a zero lod e.g. maxLod 7 -> 8 different lod levels
        this.maxBinLod = this.lodsFirstMblock + this.currentLod * 2;
    }

    shouldRedraw = () => {
        let res = this._shouldRedraw;
        this._shouldRedraw = false;
        return res;
    }

    shouldRecalculate = () => {
        let res = this._shouldRecalculate;
        this._shouldRecalculate = false;
        return res;
    }

    shouldResetBintree = () => {
        let res = this._shouldResetBintree;
        this._shouldResetBintree = false;
        return res;
    }

    shouldReloadGeomError = () => {
        let res = this._shouldReloadGeomError;
        this._shouldReloadGeomError = false;
        return res; 
    }

    shouldSaveViewFrustum = () => {
        let res = this._shouldSaveViewFrustum;
        this._shouldSaveViewFrustum = false;
        return res;
    }
}

export default Parameters;