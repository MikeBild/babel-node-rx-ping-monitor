import Rx from 'rx'
import RxNode from 'rx-node'
import { createWriteStream } from 'fs'
import { spawn } from 'child_process'

const hostToMonitor =  process.env.HOST_TO_MONITOR || process.argv[2] || 'www.google.de'
const wstream = createWriteStream('network-monitor.log')

// ping -q -c 1 www.google.com > /dev/null && echo online || echo offline
const pingStream = Rx.Observable.create(function (observer) {
  let status = ''
  const ping = spawn('ping', ['-q', '-c', '1', hostToMonitor])
  ping.stdout.on('data', buf => status = 'online')
  ping.stderr.on('data', buf => status = 'offline')    
  ping.stdout.on('close', _ => {    
    observer.onNext(status)
    observer.onCompleted()
  })
})

const monitorStream = Rx.Observable
  .interval(2000)
  .map(x => pingStream)
  .mergeAll()
  .scan((state, next) => ({
    failure: next === 'offline' ? state.failure + 1 : state.failure,
    success: next === 'online' ? state.success + 1 : state.success,
  }), {failure: 0, success: 0})

const logStream = monitorStream
          .map(x => ({...x, ts: new Date().toISOString()}))
          .map(x => JSON.stringify(x, null, 4))

RxNode
  .writeToStream(logStream, wstream, 'utf8')

monitorStream
  .do(console.log)
  .subscribe()