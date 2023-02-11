// import Promise from '../promise.js'
import {
  getFullUrlPath,
  objectExtend,
  parseQueryString,
  isUndefined,
  isIosInAppBrowser,
  isLockedDownInAppBrowser,
  isFacebookOwnedInAppBrowser,
  isPlayrggApp,
  isInIframe
} from '../utils.js'

/**
 * OAuth2 popup management class
 *
 * @author Sahat Yalkabov <https://github.com/sahat>
 * @copyright Class mostly taken from https://github.com/sahat/satellizer
 * and adjusted to fit vue-authenticate library
 */
export default class OAuthPopup {
  constructor(url, name, popupOptions) {
    this.popup = null
    this.url = url
    this.name = name
    this.popupOptions = popupOptions

    console.debug('[VA] OAuthPopup constructor: %o | %o | %o', this.url, this.name, this.popupOptions);
  }

  open(redirectUri, skipPooling) {
    try {
      if(isIosInAppBrowser() || isFacebookOwnedInAppBrowser() || isPlayrggApp()) {
        if(isLockedDownInAppBrowser() && isInIframe() && !isPlayrggApp()) {
          // Some in-app browsers block window.location to different URLs when in an iframe
          // For some reason, it doesn't block window.open
          window.open(this.url)
        } else {
          window.location = this.url
        }
      } else {
        this.popup = window.open(this.url, this.name, this._stringifyOptions())
      }

      if (this.popup && this.popup.focus) {
        this.popup.focus()
      }

      if (skipPooling) {
        return Promise.resolve()
      } else {
        return this.pooling(redirectUri)
      }
    } catch(e) {
      return Promise.reject(new Error('OAuth popup error occurred'))
    }
  }

  pooling(redirectUri) {
    return new Promise((resolve, reject) => {
      const redirectUriParser = document.createElement('a')
      redirectUriParser.href = redirectUri
      const redirectUriPath = getFullUrlPath(redirectUriParser)

      console.debug('[VA] redirectUriPath: %o | %o', redirectUriPath, redirectUri)

      let poolingInterval = setInterval(() => {
        console.group('[VA] Popup Poll Loop')
        console.debug('the popup: %o', this.popup)

        if (!this.popup || this.popup.closed || this.popup.closed === undefined) {
          clearInterval(poolingInterval)
          poolingInterval = null
          console.debug('popup is closed, throw error')
          reject(new Error('Auth popup window closed'))
        }

        try {
          const popupWindowPath = getFullUrlPath(this.popup.location)
          console.debug('current popupWindowPath: %o', popupWindowPath)

          if (popupWindowPath === redirectUriPath) {
            console.debug('popup path and redirect path are the same')

            if (this.popup.location.search || this.popup.location.hash) {
              const query = parseQueryString(this.popup.location.search.substring(1).replace(/\/$/, ''));
              const hash = parseQueryString(this.popup.location.hash.substring(1).replace(/[\/$]/, ''));
              let params = objectExtend({}, query);
              params = objectExtend(params, hash)

              if (params.error) {
                reject(new Error(params.error));
              } else {
                resolve(params);
              }
            } else {
              reject(new Error('OAuth redirect has occurred but no query or hash parameters were found.'))
            }

            clearInterval(poolingInterval)
            poolingInterval = null

            console.debug('popup closing')
            this.popup.close()
          } else {
            console.debug('else block')
          }
        } catch(e) {
          console.debug('ignored catch block')
          // Ignore DOMException: Blocked a frame with origin from accessing a cross-origin frame.
        }
        console.groupEnd()
      }, 250)
    })
  }

  _stringifyOptions() {
    let options = []
    for (var optionKey in this.popupOptions) {
      if (!isUndefined(this.popupOptions[optionKey])) {
        options.push(`${optionKey}=${this.popupOptions[optionKey]}`)
      }
    }
    return options.join(',')
  }
}
