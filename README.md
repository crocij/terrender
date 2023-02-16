# General Information
To run and bundle any of the projects, you have to install node.js (https://nodejs.org/en/) on your device. Everything was tested with node version ```v14.17.5```. The browser should be recent, see here: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields, "private class fields" is the relevant feature that needs to be supported.

# Step by Step Running the exampleProject
As the built bundle is also in the git repo, building is not required.

## Installing node_modules
Navigate to the folder ```exampleProject/server``` and run ```npm install``` to install the required ```node_modules```.

## Set paths to your data
Set the path to your data in ```exampleProject/server/config.json```. Note that at least the height data must be provided.

## Start the server
Make sure you have node installed on your system, if so you can run the project as follows: ```node /path/to/git/exampleProject/server/index.js config.json```. It will be available under localhost:3000

## Configuration

As example, see ```exampleProject/server/config.json```.

### Mandatory Parameter
- ```server.hostname``` The hostname under which the server should be reachable
- ```server.port``` The port of the server
- ```server.heightAssets``` Path to the folder where the height texture folders are (e.g. the folder with the LOD Subfolders)

### Optional Parameters restricting functionality
- ```server.textureAssets``` Path of the folder with the color textures, the folder is simmilar to the ```server.heightAssets``` folder. If not set a color gradient depending on the height will be used
- ```server.geomErrorFolder``` Path to the folder where the precalculated geomErrors precalculated with the ```geomErrorComputation``` script. The files should be named by the following schema: ```{lod}_{kPatchBase}.json```. If not set or not complete the geometric error wont be used for the not available LOD and kPatchBase settings.

### Optional Parameters
Note that the default parameters are fit for the world dataset

- ```server.type``` Either ```'expert'```, ```'standard'``` or ```'minimal'```. Controls the set of settings the user has in the browser. Default: ```'expert'```
- ```client.tileSideLength``` Side length of a height single height texture. Default: ```257```
- ```client.boundaries``` Array of the lower left and upper right corner point of the coordinate system. From this parameter the number and position of root mblocks and binTree nodes is derived so the proportions of the siode length of the spanned rectangle should be the same as for the data. Default: ```[-180, -90, 180, 90]```
- ```client.heightScaling```: Scaling of the height relative to the unit of the ```client.boundaries```. Default: Calculated from ```client.boundaries``` based on the average latitude.
- ```verticalExaggeration```Exaggeration factor of the height features during rendering. DEFAULT: ```1``` 
- ```client.estMaxHeight``` Estimated maximum value of the height in the height textures, is used if no geometric bounds are available. Default: ```10000```
- ```client.xStart``` Start (e.g. lowest) x index of the textures at LOD 0. Default: ```0```
- ```client.yStart``` Start (e.g. lowest) y index of the textures at LOD 0. Default: ```0```
- ```client.maxLod``` Maximum LOD that the user can set, should not be higher than the maximum LOD of the data available. Defaul: ```7```
- ```client.currentLod``` Initialy set LOD, should not be higher than ```client.maxLod```. Default: ```7```
- ```client.kPatchBase``` Initial kPatchBase of the binnary nodes, should be a power of two plus 1 and smaller than ```client.tileSideLength```. Default: ```129```
- ```client.errorThreshold``` Initial error threshold, if set to low the website might crash because it tries to load to much data. THe expert mode can be used to determine a good value for a given dataset. Default: ```0.01```
- ```client.useCullingMetric```: Whether or not the culling metric should be used initially. Default: ```true```
- ```client.useDistanceMetric```: Whether or not the distance metric should be used initially. Default: ```true```
- ```client.useMinMaxForErrors```: Whether the geom bounds (if available) should be used for the distance metric or not. If not the height of the bounding error volume is based on the current LOD and ```client.estMaxHeight```. Default: ```false```
- ```client.dynamicBinTreeUpdate```: Whether the bin tree creation should terminate earlier during movements to allow updates more often but in lower LoD. Default ```true```
- ```client.dynamicBinTreeUpdateTreeLengthRation```: The ratio of numbers of rendered quadtree between the current and the next rendered terrain triangulation. Default: ```0.75```
- ```client.dynamicBinTreeUpdateNotReadyRatio```: The ratio between number of ready and not ready quadtree nodes before the creation of the bintree will be stopped. Default: ```0.2```
- ```client.maxGpuCache``` Max numbers of texture data that should be cached on the GPU. Note that a too high value might crash the browser (Firefox/Chrome) or cause a reload of the page (Safari). Default: ```200```
- ```client.maxRamCache``` Max numbers of texture data that should be cached in the RAM. Note that a too high value might crash the browser (Firefox/Chrome) or cause a reload of the page (Safari). Default: ```400```
- ```client.colorIsTiff``` Set to true if the color textures are in TIFF format, else png is assumed. Default: ```false```
- ```client.colorIsJpeg``` Set to true if the color textures are in JPEG format, else png is assumed. Default: ```false```
- ```client.heightIsTiff``` Set to true if the height textures are in TIFF format, else png is assumed. Default: ```true```
- ```client.initialCamera``` Defines the initial camera settings, object of the following form: ```{"pos": [0, 0, 10],"target": [10, 0, 0],"up": [0, 0, 1],"sensitivity": 0.5}```. Default: Is derived from the other settings

## Running
To start the server run ```node /path/to/git/exampleProject/server/index.js /path/to/config.json``` (the relative paths could also be used). If no config file is provided it will look for a config file names ```config.json``` in the server folder.

## Bundling the frontend
1. Navigate into the ```raster-core``` folder and run ```npm link```.
2. Navigate into  ```exampleProject/client``` and run ```npm link raster-core```.
1. Navigate into the ```exampleProject/client/[noDrawingBench|minimal|standard|expert]``` directory and run ```npx webpack```, this will bundle the code into a single javascript file and copy it into the public folder. Note that you do not have to install any node-modules because it uses the node modules we already installed in the parent directory.

# raster-core package
This contains the core Raster renderer, it can be used in a normal project (for example ```exampleProject```) like a node modules following these steps:
1. Navigate into the ```raster-core``` folder and run ```npm link```.
2. In your client project folder (where the ```package.json``` is) run ```npm link raster-core```.
In the background npm creates simlinks, all changes made in ```raster-core``` are reflected directly in the projects. Note that the webpack config in the projects still needs to handle the bundling of ```raster-core```.
3. Please note that the three files containing the code for the webworkers must be directly copied from their path in raster core (for example ```./webworkerTiffHeight/workerBundleTiffHeight.js```) in to the public folder of the webserver so that they are handed out as is. An example to configure this using webpack can be found in the exampleProject.

# geomErrorComputation
The node script in this calculates a ```.json``` file that contains the precalculated geomtric min-max bounds. It requires a config file like the one already in the folder. The properties in the config file are similar to the one of the exampleProject. The only additional property is ```asset.minDifference```. This property can be used to minimize the file size of the error file by discarding children of nodes when their height difference is below the set value.

The script can be run with the following command:

```node --max-old-space-size=32768 --expose-gc index```

Note that this command also increases the max memory node will use to 32GB (but it will not use it, lod 7 kPatchBase 65 uses around 3GB). Further note that the script might run sometime depending on the parameters or might fail completely due to restrictions of the node engine regarding memory and callstack size. Additionally it enables the script to manually trigger the garbage collection.

In the same folder a (formatted) example can be found for the produced tree with maxLod 2 and kPatchBase 129

# tifToPng

This is a small helper node program that takes as argument a height TIFF file and converts it to PNG. It converts the height values to float32 so they fit into the 4 bytes per PNG pixel. To run it first install the node modules by running ```npm i``` in the ```tigToPng``` folder. Then you can run the script with ```node index.js /path/to/file```. If you want to batch convert your prepared dataset you can run ```find . -name '*.tif' -exec node /PATH/TO/index.js {} \;``` in the root folder of your dataset. Note that it only creates the PNG files but does not delete the old TIFF files.