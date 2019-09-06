const wsConnect = async function() {
  const videoCanvas = document.getElementById('video-canvas')
  const l = window.location
  const wsUrl = `${l.protocol === 'https:' ? 'wss://' : 'ws://'}${l.hostname}:${
    l.port
  }/`

  new JSMpeg.Player(wsUrl, {
    canvas: videoCanvas,
    audio: false,
    videoBufferSize: 512 * 1024,
    preserveDrawingBuffer: true,
    onPlay: () => {}
  })
}
