const init = () => {
  const videoCanvas = document.getElementById('video-canvas')
  const url = `ws://${window.location.hostname}:${window.location.port}`
  new JSMpeg.Player(url, { canvas: videoCanvas })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  setTimeout(init, 500)
}
