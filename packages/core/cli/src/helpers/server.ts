import os from 'node:os'
import { MARKEE } from '../constants.js'

export const ServerHelpers = {
  getExternalIP() {
    let external = '127.0.0.1'
    const interfaces = os.networkInterfaces()
    for (const devName in interfaces) {
      const iface = interfaces[devName]

      for (let i = 0; i < iface!.length; i++) {
        const alias = iface![i]
        if (
          alias.family === 'IPv4' &&
          alias.address !== '127.0.0.1' &&
          !alias.internal
        ) {
          external = alias.address
          break
        }
      }

      if (external !== '127.0.0.1') {
        break
      }
    }
    return external
  },
  printReadyMessage() {
    if (config.server.host === '0.0.0.0') {
      const external = ServerHelpers.getExternalIP()
      console.log(
        `${MARKEE} server listening on http://localhost:${config.server.port}`,
      )
      console.log(
        `Or on local network: http://${external}:${config.server.port}`,
      )
    } else {
      console.log(
        `${MARKEE} server listening on http://${config.server.host}:${config.server.port}`,
      )
    }
  },
}
