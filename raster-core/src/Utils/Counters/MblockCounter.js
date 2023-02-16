class MblockCounter {

    /**
     * 
     * @param {Parameters} parameters 
     */
    constructor(parameters) {
        this.parameters = parameters;
        this.reset();
    }

    /**
     * Register a mblock for the specified lod
     * @param {Number} lod 
     */
    addToCounter = (lod)  => {
        this.bins[lod] += 1;
        this.bins[this.bins.length - 1] += 1;
    }

    /**
     * Reset te counters for all lods
     */
    reset = () => {
        this.bins = []
        for(let i = 0; i <= this.parameters.maxLod + 1; i += 1) {
            this.bins.push(0);
        }
        this.bins.total = 0;
    }

    /**
     * Returns the bins
     * @returns {Array.<Number>}
     */
    getCounters = () => {
        return this.bins;
    }
}

export default MblockCounter;