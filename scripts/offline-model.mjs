// CI only: verify the official pinned metadata and download outside tracked files.
// No prompts, credentials, or user data are sent. Model weights never go into Git.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const manifest = JSON.parse(await readFile('public/offline-model.json', 'utf8'))
const metadataUrl = `https://huggingface.co/api/models/${manifest.repo}/revision/${manifest.revision}?blobs=true`
const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(60_000) })
if (!response.ok) throw new Error(`Official model metadata returned HTTP ${response.status}`)
const metadata = await response.json()
const file = metadata.siblings?.find(item => item.rfilename === manifest.filename)
if (metadata.sha !== manifest.revision || file?.lfs?.sha256 !== manifest.sha256 || (file.size || file?.lfs?.size) !== manifest.bytes) throw new Error('Official model metadata does not match the bundled immutable manifest')
if (metadata.cardData?.license && metadata.cardData.license !== 'apache-2.0') throw new Error('Review the official model license before publishing')
console.log(`Official model metadata matches: ${manifest.filename}, ${manifest.bytes} bytes, SHA-256 ${manifest.sha256}`)
if (process.argv.includes('--metadata-only')) process.exit(0)

await mkdir('.arena', { recursive: true })
const target = '.arena/offline-model.gguf'
async function verified(path) {
  try {
    if ((await stat(path)).size !== manifest.bytes) return false
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    return hash.digest('hex') === manifest.sha256
  } catch { return false }
}
if (!await verified(target)) {
  const part = `${target}.part`
  try {
    const download = await fetch(manifest.url, { signal: AbortSignal.timeout(600_000) })
    if (!download.ok || !download.body) throw new Error(`Model download returned HTTP ${download.status}`)
    const hash = createHash('sha256'); let bytes = 0
    const verify = new Transform({ transform(chunk, _encoding, done) {
      bytes += chunk.length
      if (bytes > manifest.bytes) return done(new Error('Model exceeded the expected size'))
      hash.update(chunk); done(null, chunk)
    } })
    await pipeline(Readable.fromWeb(download.body), verify, createWriteStream(part))
    if (bytes !== manifest.bytes || hash.digest('hex') !== manifest.sha256) throw new Error('Downloaded model failed size/SHA-256 verification')
    await rename(part, target)
  } catch (error) { await rm(part, { force: true }); throw error }
}
console.log('::notice title=Official offline model verified::Pinned Qwen Q4_K_M download passed byte-size and SHA-256 checks. No weights will be published in the APK.')
