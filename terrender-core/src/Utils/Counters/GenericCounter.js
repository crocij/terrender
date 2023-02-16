class GenericCounter {
    #value;
    
    constructor() {
        this.#value = 0;
    }

    /**
     * Add a value to the counter
     * @param {Number} val 
     */
    add = (val = 1) => {
        this.#value += val;
    }

    /**
     * Subtract a value of the counter
     * @param {Number} val 
     */
    subtract = (val = 1) => {
        this.#value -= val;
    }

    /**
     * Return the current counter
     * @return {Number}
     */
    getValue = () => {
        return this.#value;
    }
}

export default GenericCounter;