import BinNodeCounter from "./Counters/BinNodeCounter";
import VertexCounter from "./Counters/VertexCounter";
import MblockCounter from "./Counters/MblockCounter";
import GenericCounter from "./Counters/GenericCounter";

class Counters {
    #binNodeCounter;
    #vertexCounter;
    #mblockCounter;
    #genericCounters;

    /**
     * Takes as argument the Parameters of the current instance
     * @param {Parameters} parameters
     */
    constructor(parameters) {
        this.#binNodeCounter = new BinNodeCounter(parameters);
        this.#vertexCounter = new VertexCounter();
        this.#mblockCounter = new MblockCounter(parameters);
        this.#genericCounters = {};
    }

    /**
     * Returns the generic counter with this name, if it does not exist creates it
     * @param {String} name 
     * @returns {GenericCounter}
     */
    getGenericCounter = (name) => {
        if (!this.#genericCounters[name]) {
            this.#genericCounters[name] = new GenericCounter();
        }

        return this.#genericCounters[name];
    }

    /**
     * Returns a dict with all generic counters
     * @returns {Object}
     */
    getGenericCounters = () => {
        return this.#genericCounters;
    }

    /**
     * @returns {BinNodeCounter}
     */
    getBinNodeCounter = () => {
        return this.#binNodeCounter;
    }

    /**
     * @returns {VertexCounter}
     */
    getVertexCounter = () => {
        return this.#vertexCounter;
    }

    /**
     * @returns {MblockCounter}
     */
    getMblockCounter = () => {
        return this.#mblockCounter;
    }
}

export default Counters;