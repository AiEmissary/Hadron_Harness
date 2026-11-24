'use strict'
/**
 * Hadron's OCR worker thread (bundled by electron/esbuild.main.mjs into electron/ocrWorker.cjs).
 * Same message protocol as tesseract.js's own Node worker, but the WebAssembly engine is
 * embedded in the bundle and downloads are impossible: language data is read only from the
 * local folder Hadron passes in.
 */
const { parentPort } = require('worker_threads')
const worker = require('tesseract.js/src/worker-script/index.js')
const gunzip = require('tesseract.js/src/worker-script/node/gunzip.js')
const cache = require('tesseract.js/src/worker-script/node/cache.js')

let core = null
const getCore = async () => {
  // Electron's Node always supports WebAssembly SIMD; this build has the engine inlined.
  core = core || require('tesseract.js-core/tesseract-core-simd-lstm.wasm.js')
  return core
}
const fetch = async () => { throw Error('Hadron OCR reads language data from the app only') }

parentPort.on('message', packet => worker.dispatchHandlers(packet, obj => parentPort.postMessage(obj)))
worker.setAdapter({ getCore, gunzip, fetch, ...cache })
