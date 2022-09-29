class BinNodeCounter {
    constructor(parameters) {
        this.parameters = parameters;
        this.reset();
    }

    addToCounter = (lod) => {
        this.bins[lod] += 1;
        this.bins[this.bins.length - 1] += 1;
    }

    reset = () => {
        this.bins = []
        for (let i = 0; i <= this.parameters.maxBinLod + 1; i += 1) {
            this.bins.push(0);
        }
    }

    getCounters = () => {
        return this.bins;
    }
}

export default BinNodeCounter;