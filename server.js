const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const ws = require('ws')
const express = require('express')
const app = express()

const HOST = '0.0.0.0'
const PORT = 3000
const STREAM = 'stream'
const VERBOSE = false

const ipAddress = (() => {
  const interfaces = os.networkInterfaces()
  return Object.keys(interfaces)
    .map(name => {
      const item = interfaces[name].find(item => {
        // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
        if (item.family !== 'IPv4' || item.internal) {
          return false
        }
        return true
      })
      return item ? item.address : false
    })
    .filter(address => address)[0]
})()

app.use(express.static(path.join(__dirname, 'public')))

// Listen to ffmpeg.
app.post(`/${STREAM}`, (req, res) => {
  // Don't timeout, this connection is infinate.
  res.connection.setTimeout(0)

  // Pipe the data to the clients in the WebSocket.
  req.on('data', data => {
    wsServer.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        client.send(data)
      }
    })
  })
})

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

const server = app.listen(PORT, HOST, () => {
  console.log(`Listening at ${ipAddress}:${PORT}`)
})
const wsServer = new ws.Server({ server: server })

// Start ffmpeg.
const ffmpeg = spawn('ffmpeg', [
  '-hide_banner',
  '-i',
  '/dev/video0',
  '-f',
  'mpegts',
  '-input_format',
  // '-codec:v',
  'mpeg1video',
  '-vcodec',
  'copy',
  '-an',
  '-s',
  '640x480',
  '-r',
  '20',
  '-bf',
  '0',
  `http://${HOST}:${PORT}/${STREAM}`
])

ffmpeg.stderr.on('data', data => {
  if (VERBOSE) {
    console.log(data)
  }
})

// Safely fill ffmpeg
const exitHandler = options => {
  if (options.cleanup) {
    ffmpeg.stderr.pause()
    ffmpeg.stdout.pause()
    ffmpeg.stdin.pause()
    ffmpeg.kill()
  }
  if (options.exit) {
    process.exit()
  }
}

process.on('exit', exitHandler.bind(null, { cleanup: true }))
process.on('SIGINT', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))
process.on('uncaughtException', exitHandler.bind(null, { exit: true }))
