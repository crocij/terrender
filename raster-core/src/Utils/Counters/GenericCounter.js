class GenericCounter {
    #value;
    
    constructor() {
        this.#value = 0;
    }

    /**
     * Resets the counter for the rendered vertices to 0
     */
    add = (val = 1) => {
        this.#value += val;
    }

    subtract = (val = 1) => {
        this.#value -= val;
    }

    getValue = () => {
        return this.#value;
    }
}

export default GenericCounter;