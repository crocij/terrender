const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'public'),
  },

  // Exclude built in node functionalities if imported (from GeoTiff.js)
  resolve: {
    fallback: {
      http: false,
      https: false,
      buffer: false,
      url: false,
    }
  },
  module: {
    rules: [
      {
        test: /\.frag/,
        use: 'webpack-glsl-loader'
      },
      {
        test: /\.vert/,
        use: 'webpack-glsl-loader'
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|tif)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.xyz/,
        use: 'raw-loader'
      }
    ]
  },
  mode: 'development',
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: './src/index.html' },
        { from: require.resolve('raster-core/webworkerPng/workerBundlePng.js')},
        { from: require.resolve('raster-core/webworkerTiffHeight/workerBundleTiffHeight.js')},
        { from: require.resolve('raster-core/webworkerTiffColor/workerBundleTiffColor.js')}
      ]
    }),
  ],
};