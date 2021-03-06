const m = require("mithril")
const Session = require("../../session")
const Bus = require("../../bus")

module.exports = class SessionsList {
  static tab(session, idx) {
    return m(
      `li.${session.has_focus() ? "on" : "off"}`,
      {
        key: name,
        onclick: Bus.emit.bind(
          Bus,
          Bus.events.FOCUS,
          session
        ),
        title: session.name,
      },
      m("span.alt-numeric", { data: idx }, idx + 1),
      m("span.session-name", session.name[0])
    )
  }

  view() {
    return m("ol", Session.list().map(SessionsList.tab))
  }
}
