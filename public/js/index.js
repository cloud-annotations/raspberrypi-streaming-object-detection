/* global tf, fetch, JSMpeg, requestAnimationFrame */

const modelUrl = '/model_web/model.json'
const labelsUrl = '/model_web/labels.json'

let videoCanvas
let annotatedCanvas
let annotatedCanvasCtx

let model
let inputTensor
let labels

let player

let runPrediction = false

/**
 * load the TensorFlow.js model
 */
const loadModel = async function() {
  message('loading model...')

  let start = new Date().getTime()

  // https://js.tensorflow.org/api/1.1.2/#loadGraphModel
  model = await tf.loadGraphModel(modelUrl)

  let end = new Date().getTime()

  message(model.modelUrl)
  message(`model loaded in ${(end - start) / 1000} secs`, true)
}

const updateVideoPrediction = async function() {
  let detected = null

  if (runPrediction) {
    const prediction = await runModel(videoCanvas)
    detected = await processOutput(prediction)
  }

  annotatedCanvasCtx.drawImage(
    videoCanvas,
    0,
    0,
    annotatedCanvas.width,
    annotatedCanvas.height
  )

  if (detected) {
    renderPredictions(detected)
  }

  requestAnimationFrame(updateVideoPrediction)
}

/**
 * run the model using an image and get a prediction
 */
const runModel = async function(element) {
  if (!model) {
    message('model not loaded')
  } else {
    const inputElement = element
    if (!inputElement) {
      message('no image available', true)
    } else {
      inputTensor = preprocessInput(inputElement)
      // https://js.tensorflow.org/api/latest/#tf.GraphModel.executeAsync
      const output = await model.executeAsync({
        image_tensor: inputTensor
      })

      return output
    }
  }
}

/**
 * convert image to Tensor input required by the model
 *
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} imageInput - the image element
 */
function preprocessInput(imageInput) {
  return tf.tidy(() => {
    return tf.browser.fromPixels(imageInput).expandDims()
  })
}

/**
 * convert model Tensor output to desired data
 *
 * @param {Tensor} result - the model prediction result
 */
async function processOutput(result) {
  const scores = result[0].dataSync()
  const boxes = result[1].dataSync()

  // clean the webgl tensors
  inputTensor.dispose()
  tf.dispose(result)

  const [maxScores, classes] = calculateMaxScores(
    scores,
    result[0].shape[1],
    result[0].shape[2]
  )

  const boxes2 = tf.tensor2d(boxes, [result[1].shape[1], result[1].shape[3]])
  const indexTensor = await tf.image.nonMaxSuppressionAsync(
    boxes2,
    maxScores,
    20, // maxNumBoxes
    0.5, // iou_threshold
    0.5 // score_threshold
  )

  const indexes = indexTensor.dataSync()
  boxes2.dispose()
  indexTensor.dispose()

  const height = inputTensor.shape[1]
  const width = inputTensor.shape[2]

  return buildDetectedObjects(width, height, boxes, maxScores, indexes, classes)
}

const calculateMaxScores = (scores, numBoxes, numClasses) => {
  const maxes = []
  const classes = []
  for (let i = 0; i < numBoxes; i++) {
    let max = Number.MIN_VALUE
    let index = -1
    for (let j = 0; j < numClasses; j++) {
      if (scores[i * numClasses + j] > max) {
        max = scores[i * numClasses + j]
        index = j
      }
    }
    maxes[i] = max
    classes[i] = index
  }
  return [maxes, classes]
}

const buildDetectedObjects = function(
  width,
  height,
  boxes,
  scores,
  indexes,
  classes
) {
  const count = indexes.length
  const objects = []
  for (let i = 0; i < count; i++) {
    const bbox = []
    for (let j = 0; j < 4; j++) {
      bbox[j] = boxes[indexes[i] * 4 + j]
    }
    const minY = bbox[0] * height
    const minX = bbox[1] * width
    const maxY = bbox[2] * height
    const maxX = bbox[3] * width
    bbox[0] = minX
    bbox[1] = minY
    bbox[2] = maxX - minX
    bbox[3] = maxY - minY
    objects.push({
      bbox: bbox,
      class: classes[indexes[i]],
      score: scores[indexes[i]]
    })
  }
  return objects
}

const renderPredictions = function(predictions) {
  // const context = this.canvasRef.current.getContext('2d')
  // context.clearRect(0, 0, context.canvas.width, context.canvas.height)
  // Font options.
  // console.log('render', predictions.length)
  const font = '16px sans-serif'
  annotatedCanvasCtx.font = font
  annotatedCanvasCtx.textBaseline = 'top'
  predictions.forEach(prediction => {
    const x = prediction.bbox[0]
    const y = prediction.bbox[1]
    const width = prediction.bbox[2]
    const height = prediction.bbox[3]
    // Draw the bounding box.
    annotatedCanvasCtx.strokeStyle = '#00FFFF'
    annotatedCanvasCtx.lineWidth = 1
    annotatedCanvasCtx.strokeRect(x, y, width, height)
    // Draw the label background.
    // const label = labels[parseInt(prediction.class)]
    // context.fillStyle = '#00FFFF'
    // const textWidth = context.measureText(label).width
    // const textHeight = parseInt(font, 10) // base 10
    // context.fillRect(x, y, textWidth + 4, textHeight + 4)
  })

  predictions.forEach(prediction => {
    const x = prediction.bbox[0]
    const y = prediction.bbox[1]
    const height = prediction.bbox[3]
    const label = labels[parseInt(prediction.class)]
    // Draw the text last to ensure it's on top.
    annotatedCanvasCtx.fillStyle = '#000000'
    annotatedCanvasCtx.fillText(label, x, y - height / 2)
  })
}

function message(msg, highlight) {
  let mark = null
  if (highlight) {
    mark = document.createElement('mark')
    mark.innerText = msg
  }

  const node = document.createElement('div')
  if (mark) {
    node.appendChild(mark)
  } else {
    node.innerText = msg
  }

  document.getElementById('message').appendChild(node)
}

async function init() {
  document.getElementById('message').innerHTML = ''
  message(`tfjs version: ${tf.version.tfjs}`, true)
  await loadModel()
  const res = await fetch(labelsUrl)
  labels = await res.json()
  message(`labels: ${JSON.stringify(labels)}`)

  videoCanvas = document.getElementById('video-canvas')
}

const wsConnect = async function() {
  const l = window.location
  wsUrl = `${l.protocol === 'https:' ? 'wss://' : 'ws://'}${l.hostname}:${
    l.port
  }/`

  player = new JSMpeg.Player(wsUrl, {
    canvas: videoCanvas,
    audio: false,
    videoBufferSize: 512 * 1024,
    preserveDrawingBuffer: true,
    onPlay: p => {
      togglePrediction()
      annotatedCanvas = document.getElementById('annoted-canvas')
      annotatedCanvas.width = 640
      annotatedCanvas.height = 480
      annotatedCanvasCtx = annotatedCanvas.getContext('2d')
      updateVideoPrediction()
    }
  })
}

// ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  setTimeout(init, 500)
}
