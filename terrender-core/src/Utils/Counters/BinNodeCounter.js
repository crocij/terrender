class BinNodeCounter {

    /**
     * The parameters of the instance
     * @param {Parameters} parameters 
     */
    constructor(parameters) {
        this.parameters = parameters;
        this.reset();
    }

    /**
     * Register a binNode for the specified lod
     * @param {Number} lod 
     */
    addToCounter = (lod) => {
        this.bins[lod] += 1;
        this.bins[this.bins.length - 1] += 1;
    }

    /**
     * Reset the bins to 0
     */
    reset = () => {
        this.bins = []
        for (let i = 0; i <= this.parameters.maxBinLod + 1; i += 1) {
            this.bins.push(0);
        }
    }

    /**
     * Returns the bins
     * @returns {Array.<Number>}
     */
    getCounters = () => {
        return this.bins;
    }
}

export default BinNodeCounter;