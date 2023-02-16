class LoadingState {

    /**
     * @param {Timer} timer 
     */
    constructor(timer) {
        this.currentlyLoadingHeight = 0;
        this.currentlyLoadingColor = 0;
        this.changed = true;
        this.initTime = undefined;
        this.textureUpdateTimer = timer.addTimer("textureUpdate", "Texture Loading Step")
    }

    /**
     * Start the timer if no time is already running
     */
    startTimer = () => {
        if (this.currentlyLoadingColor == 0 && this.currentlyLoadingHeight == 0 && !this.initTime) {
            this.initTime = Date.now();
        }
    }

    /**
     * End the timer if one is running and no more data is being loaded
     */
    endTimer = () => {
        if (this.currentlyLoadingColor == 0 && this.currentlyLoadingHeight == 0 && this.initTime) {
            this.textureUpdateTimer.addManualMeasurement(Date.now() - this.initTime);
            this.initTime = undefined;
        }
    }

    /**
     * Register that a height texture has started loading
     */
    registerStartHeight = () => {
        this.startTimer();
        this.currentlyLoadingHeight += 1;
    }

    /**
     * Register that a height texture has finished loading
     */
    registerFinishHeight = () => {
        this.currentlyLoadingHeight -= 1;
        this.changed = true;
        this.endTimer();
    }

    /**
     * Register that a color texture has started loading
     */
    registerStartColor = () => {
        this.startTimer();
        this.currentlyLoadingColor += 1;
    }

    /**
     * Register that a color texture has finished loading
     */
    registerFinishColor = () => {
        this.currentlyLoadingColor -= 1;
        this.changed = true;
        this.endTimer();
    }

    /**
     * Check if a texture finished loading since this method has been called the last time
     * @returns {Boolean}
     */
    hasChanged = () => {
        if (this.changed) {
            this.changed = false;
            return true;
        }
        return false;
    }

    /**
     * Returns true if currently some texture is being loaded
     * @returns {Boolean}
     */
    isLoading = () => {
        return this.currentlyLoadingHeight !== 0 || this.currentlyLoadingColor !== 0;
    }
}

export default LoadingState;