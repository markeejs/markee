const DEBUG_NO_CACHE = false

const openCache = indexedDB.open('markee::kroki', 1)
openCache.promise = new Promise((resolve, reject) => {
  openCache.onupgradeneeded = () => {
    if (!openCache.result.objectStoreNames.contains('cache')) {
      openCache.result.createObjectStore('cache', { keyPath: 'content' })
    }
  }
  openCache.onsuccess = () => {
    resolve()
  }
  openCache.onerror = (err) => {
    reject(err)
  }
}).then(() => openCache.result)

export async function readCache(key) {
  /* v8 ignore next */
  if (DEBUG_NO_CACHE) throw new Error()

  const cache = await openCache.promise
  const readTx = cache.transaction('cache', 'readonly')
  const request = readTx.objectStore('cache').get(key)

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      if (!request.result) {
        return reject()
      }
      resolve(request.result.value)
    }
    request.onerror = (err) => reject(err)
  })
}

export async function writeCache(key, value) {
  const cache = await openCache.promise
  const writeTx = cache.transaction('cache', 'readwrite')
  const request = writeTx.objectStore('cache').add({ content: key, value })

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve()
    request.onerror = (err) => reject(err)
  })
}

export const valueCache = new Map()
