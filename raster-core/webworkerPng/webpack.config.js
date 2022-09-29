const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const webpack = require('webpack');

module.exports = {
  entry: './worker.js',
  output: {
    filename: 'workerBundlePng.js',
    path: path.resolve(__dirname, ''),
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
};