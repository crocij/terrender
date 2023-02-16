class VertexCounter {
    constructor() {
        this.vertices = 0;
    }

    /**
     * Resets the counter for the rendered vertices to 0
     */
    resetVertices = () => {
        this.vertices = 0;
    }

    /**
     * Add a number of vertices to the counter
     * @param {Number} num Number of Vertices rendered in this draw call
     */
    addVertices =(num)  => {
        this.vertices += num;
    }

    /**
     * Write a prettified string with the number of vertices into the provided HTML Element
     * @param {HTMLElement} div 
     */
    updateVertexDisplay = (div) => {
        div.innerHTML = "Vertices: " + this.vertices.toLocaleString();
    }
}

export default VertexCounter;