const Archiver = require('hypercore-archiver')
const mkdirp = require('mkdirp')
const encoding = require('dat-encoding')
const hyperdrive = require('hyperdrive')
const ram = require('random-access-memory')
const raf = require('random-access-file')
const Swarm = require('discovery-swarm')
const swarmDefaults = require('datland-swarm-defaults')

module.exports = Dats

function Dats (dir) {
  if (!(this instanceof Dats)) return new Dats(dir)
  mkdirp.sync(dir)
  this.archiver = Archiver({dir: dir, sparse: true, storage: raf})
  this.swarm = createSwarm(this.archiver)
  this.archives = {}
}

Dats.prototype.get = function (key, cb) {
  var self = this
  key = encoding.toStr(key)
  var buf = encoding.toBuf(key)
  self.archiver.add(buf, {content: true}, function (err) {
    if (err) return cb(err)
    self.archiver.get(buf, function (err, metadata, content) {
      if (err) return cb(err)
      if (content) {
        var archive = hyperdrive(ram, buf, {metadata: metadata, content: content})
        return cb(null, archive)
      }
    })
  })
}

Dats.prototype.entries = function (archive, cb) {
  archive.readdir(function (err, entries) {
    if (err) return cb(err)
    cb(null, entries)
  })
}

Dats.prototype.metadata = function (archive, opts, cb) {
  if (typeof opts === 'function') return this.metadata(archive, {}, opts)
  var self = this
  var dat
  if (!archive.content) dat = {}
  else {
    dat = {
      peers: archive.content.peers.length,
      size: archive.content.bytes
    }
  }
  var cancelled = false

  var timeout = setTimeout(function () {
    var msg = 'timed out'
    if (cancelled) return
    cancelled = true
    return cb(new Error(msg), dat)
  }, opts.timeout)

  function done (err, dat) {
    clearTimeout(timeout)
    if (cancelled) return
    cancelled = true
    return cb(err, dat)
  }

  self.entries(archive, function (err, entries) {
    dat.entries = entries
    if (err || cancelled) return done(err, dat)
    var filename = 'dat.json'
    archive.get(filename, function (err, entry) {
      if (err || cancelled) {
        archive.content.get(0, function () {
          return done(err, dat)
        })
      }
      archive.readFile(filename, function (err, metadata) {
        if (err || cancelled) return done(err, dat)
        try {
          dat.metadata = metadata ? JSON.parse(metadata.toString()) : undefined
        } catch (e) {
        }
        dat.size = archive.content.bytes
        return done(null, dat)
      })
    })
  })
}

Dats.prototype.close = function (cb) {
  this.swarm.close(cb)
}

function createSwarm (archiver, opts) {
  if (!archiver) throw new Error('hypercore archiver required')
  if (!opts) opts = {}

  var swarmOpts = swarmDefaults({
    hash: false,
    stream: function () {
      return archiver.replicate()
    }
  })
  var swarm = Swarm(swarmOpts)

  archiver.changes(function (err, feed) {
    if (err) throw err
    swarm.join(feed.discoveryKey)
  })

  archiver.list().on('data', function (key) {
    serveArchive(key)
  })
  archiver.on('add', serveArchive)
  archiver.on('remove', function (key) {
    swarm.leave(archiver.discoveryKey(key))
  })

  return swarm

  function serveArchive (key) {
    var hex = archiver.discoveryKey(key)
    swarm.join(hex)
  }
}
