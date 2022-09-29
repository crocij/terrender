class MblockCounter {
    constructor(parameters) {
        this.parameters = parameters;
        this.reset();
    }

    addToCounter = (lod)  => {
        this.bins[lod] += 1;
        this.bins[this.bins.length - 1] += 1;
    }

    reset = () => {
        this.bins = []
        for(let i = 0; i <= this.parameters.maxLod + 1; i += 1) {
            this.bins.push(0);
        }
        this.bins.total = 0;
    }

    getCounters = () => {
        return this.bins;
    }
}

export default MblockCounter;