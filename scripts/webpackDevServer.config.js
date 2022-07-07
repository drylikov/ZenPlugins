const { paths, params } = require('./constants')
const fs = require('fs')
const path = require('path')
const httpProxy = require('http-proxy')
const _ = require('lodash')
const { getTargetUrl, TRANSFERABLE_HEADER_PREFIX, PROXY_TARGET_HEADER, MANUAL_REDIRECT_HEADER } = require('../src/shared')
const { readPluginManifest, readPluginPreferencesSchema } = require('./utils')
const stripBOM = require('strip-bom')
const bodyParser = require('body-parser')
const { URL } = require('url')
const uuid = require('uuid')
const { parseCookies, addCookies } = require('./utils')

const convertErrorToSerializable = (e) => _.pick(e, ['message', 'stack'])

const serializeErrors = (handler) => {
  return function (req, res) {
    try {
      handler.apply(this, arguments)
    } catch (e) {
      res.status(500).json(convertErrorToSerializable(e))
    }
  }
}

const readJsonSync = (file) => {
  const content = readPluginFileSync(file)
  try {
    return JSON.parse(content)
  } catch (e) {
    e.message += ` in ${file}`
    throw e
  }
}

const makeCookieAccessibleToClientSide = (value) => {
  return value
    .replace(/\s?HttpOnly(;|\s*$)/ig, '')
    .replace(/\s?Secure(;|\s*$)/ig, '')
    .replace(/\s?Domain=[^;]*(;|\s*$)/ig, '')
}

const readPluginFileSync = (filepath) => stripBOM(fs.readFileSync(filepath, 'utf8'))

const pluginPreferencesPath = path.join(params.pluginPath, 'zp_preferences.json')
const pluginDataPath = path.join(params.pluginPath, 'zp_data.json')
const pluginCodePath = path.join(params.pluginPath, 'zp_pipe.txt')
const pluginCookiesPath = path.join(params.pluginPath, 'zp_cookies.json')

const ensureFileExists = (filepath, defaultContent) => {
  try {
    fs.writeFileSync(filepath, defaultContent, { encoding: 'utf8', flag: 'wx' })
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e
    }
  }
}

const isWebSocketHeader = (header) => {
  const key = header.toLowerCase()
  return key.startsWith('sec-websocket-') || ['connection', 'upgrade'].indexOf(key) >= 0
}

module.exports = ({ allowedHost, host, https }) => {
  return {
    compress: false,
    clientLogLevel: 'none',
    contentBase: paths.appPublic,
    watchContentBase: true,
    publicPath: '/',
    quiet: true,
    watchOptions: {
      aggregateTimeout: 100,
      poll: false
    },
    hot: true,
    https: https,
    host: host,
    overlay: false,
    public: allowedHost,
    setup (app) {
      app.disable('x-powered-by')

      let cookies = []
      app.get(
        '/zen/manifest',
        serializeErrors((req, res) => {
          cookies = []
          res.set('Content-Type', 'text/xml')
          const manifest = readPluginManifest()
          for (const requiredProp of ['id', 'build', 'files', 'version', 'preferences']) {
            if (!manifest[requiredProp]) {
              throw new Error(`Wrong ZenmoneyManifest.xml: ${requiredProp} prop should be set`)
            }
          }
          res.json(manifest)
        })
      )

      app.get(
        '/zen/zp_preferences.json/schema',
        serializeErrors((req, res) => {
          res.json(readPluginPreferencesSchema())
        })
      )

      app.get(
        '/zen/zp_preferences.json',
        serializeErrors((req, res) => {
          ensureFileExists(pluginPreferencesPath, '{}\n')
          const preferences = _.omit(readJsonSync(pluginPreferencesPath), ['zp_plugin_directory', 'zp_pipe'])
          res.json(preferences)
        })
      )

      app.post(
        '/zen/zp_preferences.json',
        bodyParser.json(),
        serializeErrors((req, res) => {
          fs.writeFileSync(pluginPreferencesPath, JSON.stringify(req.body, null, 4), 'utf8')
          return res.json(true)
        })
      )

      app.get(
        '/zen/zp_data.json',
        serializeErrors((req, res) => {
          ensureFileExists(pluginDataPath, '{}\n')
          const data = readJsonSync(pluginDataPath)
          return res.json(data)
        })
      )

      app.post(
        '/zen/zp_data.json',
        bodyParser.json(),
        serializeErrors((req, res) => {
          console.assert(req.body.newValue, 'newValue should be provided')
          fs.writeFileSync(pluginDataPath, JSON.stringify(req.body.newValue, null, 4), 'utf8')
          return res.json(true)
        })
      )

      app.get(
        '/zen/zp_pipe.txt',
        serializeErrors((req, res) => {
          res.set('Content-Type', 'text/plain')
          ensureFileExists(pluginCodePath, '')
          const content = readPluginFileSync(pluginCodePath)
          res.send(content.replace(/\n$/, ''))
        })
      )

      app.post(
        '/zen/zp_cookies.json',
        bodyParser.text({ type: 'application/json' }),
        serializeErrors((req, res) => {
          fs.writeFileSync(pluginCookiesPath, JSON.stringify(cookies), 'utf8')
          return res.json(true)
        })
      )

      app.get(
        '/zen/zp_cookies.json',
        serializeErrors((req, res) => {
          res.set('Content-Type', 'application/json;charset=utf8')
          ensureFileExists(pluginCookiesPath, '')
          const content = readPluginFileSync(pluginCookiesPath)
          cookies = content ? JSON.parse(content) : []
          res.send(cookies)
        })
      )

      app.post(
        '/zen/cookies',
        bodyParser.text({ type: 'application/json' }),
        serializeErrors((req, res) => {
          cookies = addCookies(req.body, cookies)
          return res.json(true)
        })
      )

      app.get(
        '/zen/cookies',
        serializeErrors((req, res) => {
          res.set('Content-Type', 'application/json;charset=utf8')
          res.send(cookies)
        })
      )

      // eslint-disable-next-line new-cap
      const proxy = new httpProxy.createProxyServer()
      proxy.on('proxyRes', (proxyRes, req, res) => {
        if (proxyRes.headers['set-cookie']) {
          const now = new Date()
          for (const cookieStr of proxyRes.headers['set-cookie']) {
            cookies = addCookies(parseCookies(cookieStr, now), cookies)
          }
          proxyRes.headers[TRANSFERABLE_HEADER_PREFIX + 'set-cookie'] = proxyRes.headers['set-cookie']
          proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(makeCookieAccessibleToClientSide)
        }
        const location = proxyRes.headers.location
        if (req._zpManualRedirect && [301, 302, 303, 307, 308].indexOf(proxyRes.statusCode) >= 0) {
          proxyRes.headers[MANUAL_REDIRECT_HEADER] = `${proxyRes.statusCode} ${proxyRes.statusMessage}`
          proxyRes.statusCode = 200
          proxyRes.statusMessage = 'OK'
        } else if (location && /^https?:\/\//i.test(location)) {
          const { origin, pathname, search } = new URL(location)
          proxyRes.headers.location = pathname + search +
            ((search === '') ? '?' : '&') + PROXY_TARGET_HEADER + '=' + origin
        }
        proxyRes.headers = _.mapValues(proxyRes.headers, value => {
          if (_.isArray(value)) {
            return value.map(value => value.replace(/[^\t\x20-\x7e\x80-\xff]/g, ''))
          } else if (_.isString(value)) {
            return value.replace(/[^\t\x20-\x7e\x80-\xff]/g, '')
          } else {
            throw new Error('unexpected header value type')
          }
        })
      })

      const wsOptions = {}
      const wsResponseResults = {}
      proxy.on('error', (err, req, res) => {
        if (typeof res.status === 'function') {
          res.status(502).json(convertErrorToSerializable(err))
        } else if (req._zpWsOptions) {
          wsResponseResults[req._zpWsOptions.id] = [err, null]
        }
      })
      const cacheWebSocketResponse = (req, res) => {
        const { id, url } = req._zpWsOptions
        wsResponseResults[id] = res.upgrade
          ? [
            null,
            {
              url,
              protocol: `HTTP/${res.httpVersion}`,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: res.headers,
              body: null
            }
          ]
          : [
            new Error('non-upgrade response is not supported yet'),
            null
          ]
      }
      app.post(
        '/zen/ws',
        bodyParser.json(),
        serializeErrors((req, res) => {
          const id = uuid().toString().replace(/-/g, '').toLowerCase().substring(0, 16)
          wsOptions[id] = req.body
          res.json({ id })
        })
      )
      app.get(
        '/zen/ws/:id',
        (req, res) => {
          const id = req.params.id
          const result = wsResponseResults[id]
          delete wsResponseResults[id]
          if (result) {
            const [err, response] = result
            if (response) {
              res.json(response)
            } else {
              res.status(502).json(convertErrorToSerializable(err))
            }
          } else {
            res.status(500).json(convertErrorToSerializable(new Error('Could not found WebSocket response')))
          }
        }
      )
      proxy.on('proxyReqWs', (proxyReq, req) => {
        proxyReq.on('response', (res) => {
          if (res.upgrade) {
            return
          }
          cacheWebSocketResponse(req, res)
        })
        proxyReq.on('upgrade', (res) => {
          if (!res.headers['sec-websocket-protocol'] && req.headers['sec-websocket-protocol'] === 'null') {
            res.headers['sec-websocket-protocol'] = 'null'
          }
          cacheWebSocketResponse(req, res)
        })
      })
      app.on('upgradeRequest', (req, socket, head) => {
        const i = req.url.indexOf(PROXY_TARGET_HEADER)
        const id = i >= 0 ? req.url.substring(i + PROXY_TARGET_HEADER.length + 1) : null
        const options = id ? wsOptions[id] : null
        if (!options) {
          socket.destroy()
          return
        }
        delete wsOptions[id]
        const headers = {}
        if (req.rawHeaders) {
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            const key = req.rawHeaders[i].toLowerCase()
            const value = req.rawHeaders[i + 1]
            if (isWebSocketHeader(key) || key === 'cookie') {
              headers[key] = value
            }
          }
        }
        if (options.headers) {
          _.forOwn(options.headers, (value, header) => {
            const key = header.toLowerCase()
            if (!isWebSocketHeader(key)) {
              headers[key] = value
            }
          })
        }
        const { host, origin, pathname, search } = new URL(options.url)
        const url = `${/^https|wss/.test(options.url) ? 'https' : 'http'}://${host}${pathname}${search}`
        req.url = pathname + search
        req.headers = headers
        req._zpWsOptions = { id, url }
        proxy.ws(req, socket, head, {
          target: origin,
          preserveHeaderKeyCase: true,
          secure: false
        })
      })

      app.all('*', (req, res, next) => {
        const target = getTargetUrl(req.url, req.headers[PROXY_TARGET_HEADER])
        if (!target) {
          next()
          return
        }

        if (req.rawHeaders) {
          const headers = {}
          const isCookieSetExplicitly = Boolean(req.headers[TRANSFERABLE_HEADER_PREFIX + 'cookie'])
          if (req.headers[MANUAL_REDIRECT_HEADER]) {
            req._zpManualRedirect = true
          }
          for (let i = 0; i < req.rawHeaders.length; i += 2) {
            let header = req.rawHeaders[i]
            const key = header.toLowerCase().trim()
            if (key === 'content-length' || (key === 'cookie' && !isCookieSetExplicitly)) {
              // forward header value as it is
            } else if ([PROXY_TARGET_HEADER, MANUAL_REDIRECT_HEADER].indexOf(key) >= 0 || !key.startsWith(TRANSFERABLE_HEADER_PREFIX)) {
              continue
            } else {
              header = header.slice(TRANSFERABLE_HEADER_PREFIX.length)
            }
            const value = req.rawHeaders[i + 1]
            if (headers[header]) {
              headers[header] += ',' + value
            } else {
              headers[header] = value
            }
          }
          req.headers = headers
        } else {
          req.headers = {}
        }

        proxy.web(req, res, {
          target,
          agent: /^https/.test(target) ? require('https').globalAgent : require('http').globalAgent,
          changeOrigin: false,
          preserveHeaderKeyCase: true,
          ignorePath: true,
          secure: false,
          xfwd: false
        })
      })
    }
  }
}
