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
     * 
     * @param {Number} numberOfVertices Number of Vertices rendered in this draw call
     */
    addVertices =(numberOfVertices)  => {
        this.vertices += numberOfVertices;
    }

    /**
     * 
     * @param {HTMLElement} div 
     */
    updateVertexDisplay = (div) => {
        div.innerHTML = "Vertices: " + this.vertices.toLocaleString();
    }
}

export default VertexCounter;