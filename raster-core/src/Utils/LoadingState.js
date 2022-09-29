import Raster from "../Raster";
import Timer from "./Timer";

class LoadingState {

    /**
     * 
     * @param {Timer} raster 
     */
    constructor(timer) {
        this.currentlyLoadingHeight = 0;
        this.currentlyLoadingColor = 0;
        this.changed = true;
        this.initTime = undefined;
        this.textureUpdateTimer = timer.addTimer("textureUpdate", "Texture Loading Step")
    }

    startTimer = () => {
        if (this.currentlyLoadingColor == 0 && this.currentlyLoadingHeight == 0 && !this.initTime) {
            this.initTime = Date.now();
        }
    }

    endTimer = () => {
        if (this.currentlyLoadingColor == 0 && this.currentlyLoadingHeight == 0 && this.initTime) {
            this.textureUpdateTimer.addManualMeasurement(Date.now() - this.initTime);
            this.initTime = undefined;
        }
    }

    registerStartHeight = () => {
        this.startTimer();
        this.currentlyLoadingHeight += 1;
    }

    registerFinishHeight = () => {
        this.currentlyLoadingHeight -= 1;
        this.changed = true;
        this.endTimer();
    }

    registerStartColor = () => {
        this.startTimer();
        this.currentlyLoadingColor += 1;
    }

    registerFinishColor = () => {
        this.currentlyLoadingColor -= 1;
        this.changed = true;
        this.endTimer();
    }

    hasChanged = () => {
        if (this.changed) {
            this.changed = false;
            return true;
        }
        return false;
    }

    isLoading = () => {
        return this.currentlyLoadingHeight !== 0 || this.currentlyLoadingColor !== 0;
    }
}

export default LoadingState;