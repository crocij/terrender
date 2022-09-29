import BinNodeCounter from "./Counters/BinNodeCounter";
import VertexCounter from "./Counters/VertexCounter";
import MblockCounter from "./Counters/MblockCounter";
import GenericCounter from "./Counters/GenericCounter";

class Counters {
    #binNodeCounter;
    #vertexCounter;
    #mblockCounter;
    #genericCounters;

    constructor(parameters) {
        this.#binNodeCounter = new BinNodeCounter(parameters);
        this.#vertexCounter = new VertexCounter();
        this.#mblockCounter = new MblockCounter(parameters);
        this.#genericCounters = {};
    }

    getGenericCounter = (name) => {
        if (!this.#genericCounters[name]) {
            this.#genericCounters[name] = new GenericCounter();
        }

        return this.#genericCounters[name];
    }

    getGenericCounters = () => {
        return this.#genericCounters;
    }

    getBinNodeCounter = () => {
        return this.#binNodeCounter;
    }

    getVertexCounter = () => {
        return this.#vertexCounter;
    }

    getMblockCounter = () => {
        return this.#mblockCounter;
    }
}

export default Counters;