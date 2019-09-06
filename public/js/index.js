const init = () => {
  const videoCanvas = document.getElementById('video-canvas')
  // const l = window.location
  // const wsUrl = `${l.protocol === 'https:' ? 'wss://' : 'ws://'}${l.hostname}:${
  //   l.port
  // }/`

  const url = `ws://${window.location.hostname}:${window.location.port}`

  new JSMpeg.Player(url, {
    canvas: videoCanvas
    // audio: false,
    // videoBufferSize: 512 * 1024,
    // preserveDrawingBuffer: true,
    // onPlay: () => {}
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  setTimeout(init, 500)
}
