// Mirror command output and publish a bounded failure summary as a GitHub
// annotation, so CI failures are diagnosable without downloading log archives.
import { spawn } from 'node:child_process'
const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Pass a command to run.')
let tail = ''
const append = chunk => { tail = (tail + chunk.toString()).slice(-16000) }
const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] })
child.stdout.on('data', chunk => { process.stdout.write(chunk); append(chunk) })
child.stderr.on('data', chunk => { process.stderr.write(chunk); append(chunk) })
child.on('error', error => { append(error.message); process.stderr.write(`${error.message}\n`) })
child.on('close', code => {
  if (code !== 0) {
    const summary = tail.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=Command failed (${command})::${summary}`)
    process.exitCode = code || 1
  }
})
