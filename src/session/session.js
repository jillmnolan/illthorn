const events = require("events")
const m = require("mithril")
const net = require("net")
const Parser = require("../parser")
const State = require("./state")
const Feed = require("./feed")
const Streams = require("./streams")
const Bus = require("../bus")
const History = require("./command-history")

module.exports = class Session extends events.EventEmitter {
  static Sessions = new Map()

  static has_focus(sess) {
    return sess.has_focus()
  }

  static has(id) {
    return Session.Sessions.has(id)
  }

  static set(id, sess) {
    return Session.Sessions.set(id, sess)
  }

  static get(id) {
    return Session.Sessions.get(id)
  }

  static delete(id) {
    return Session.Sessions.delete(id)
  }

  static list() {
    return Array.from(Session.Sessions)
      .map(([_, session]) => session)
      .sort((left, right) => left.port - right.port)
  }

  static select(...args) {
    return Session.list().filter(...args)
  }

  static find(...args) {
    return Session.list().find(...args)
  }

  static fuzzy_find(name) {
    const case_matches = Session.select(
      (sess) => sess.name && ~sess.name.indexOf(name)
    )

    if (case_matches.length) return case_matches

    return Session.select(
      (sess) =>
        sess.name &&
        ~sess.name.toLowerCase().indexOf(name.toLowerCase())
    )
  }

  static get_current_command() {
    const sess = Session.focused()
    if (!sess) return ""
    return sess.history.read()
  }

  static async of(opts) {
    const char = new Session(opts)
    char.rename(char.name || char.port)
    return char
  }

  static focused() {
    return Session.list().filter(Session.has_focus).pop()
  }

  static get current() {
    return Session.focused()
  }

  static send_command(sess, command) {
    return sess.send_command(command)
  }

  constructor({ port, name }) {
    super()
    this.port = port
    this.sock = void 0
    this.history = History.of()
    this.name = name || port
    this.feed = Feed.of({ session: this })
    this.streams = Streams.of({ session: this })
    this.state = State.of(this)
    this.sock = net.connect({ port })
    this.sock.on("data", (data) => this.parse(data))
    this.sock.on("error", (err) => this.emit(err))
  }

  parse(string) {
    Parser.parse(string, (doc) =>
      this.feed.ingestDocument(doc)
    )
  }

  handle_tag(tag) {
    //if (this.has_focus()) console.log("tag:%o", tag)
    // broadcast individual tags
    this.emit(tag.name, tag)
    // route streams
    if (
      tag.name == "stream" &&
      this.streams.wants(tag.id)
    ) {
      return this.streams.insert(tag)
    }
    // route main feed
    this.feed.add(tag)
  }

  close() {
    this.quit()
    if (!this.feed) return
    const pre = document.createElement("pre")
    pre.innerText = "\n*** Connection Closed ***\n"
    const frag = document.createDocumentFragment()
    frag.appendChild(pre)
    this.feed.append(frag)
  }

  destroy() {
    Session.delete(this.name)
    this.quit()
    this.feed.destroy()
    this.feed = this.state = void 0
    Bus.emit(Bus.events.REDRAW)
  }

  quit() {}

  has_focus() {
    return this.feed.has_focus()
  }

  activate() {
    this.feed.activate()
    return this
  }

  idle() {
    this.feed.idle()
    return this
  }

  attach(view) {
    this.activate()
    this.feed.attach_to_dom(view)
    this.streams.redraw()
    this.feed.reattach_head()
    return this
  }

  rename(name) {
    if (this.name && Session.has(this.name))
      Session.delete(this.name)
    this.name = name
    Session.set(this.name, this)
    Bus.emit(Bus.events.REDRAW)
  }

  send_command(cmd, id = "cli") {
    cmd = cmd.toString().trim()
    if (cmd.length == 0) return
    const client = document.createElement("pre")

    m.render(
      client,
      m(
        `span.${id}.sent`,
        this.state.get("prompt.text", ">") + cmd
      )
    )
    this.feed.append(client)
    this.sock.write(`${cmd}\r\n`)
    return this
  }
}
