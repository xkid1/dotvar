# Accessibility

dotvar is a library: it renders no user interface. Accessibility here covers three
things: the output it produces (errors and warnings that developers read, and that apps
may show to users), its documentation, and the way people take part in the project.

## Output from the library

- **Plain-text messages.** Errors and warnings are plain English sentences. They use no
  colour, emoji, ASCII art or terminal escape codes, so they read correctly in screen
  readers, log viewers, CI logs and error trackers.
- **Information is never conveyed by formatting alone.** Every problem names the
  variable and states the requirement in words, for example
  `PORT: must be a port number between 1 and 65535`.
- **Structured data for your own UI.** Don't parse message strings. Every error has a
  stable `code`, `EnvValidationError` has an `issues` array of `{ key, message }`, and
  `EnvParseError` has `line` and `file`. Apps can use them to render accessible,
  localised messages (for example a list linked to form fields, or an `aria-live`
  region in a settings screen).
- **Everything at once.** `createEnv()` reports every invalid variable in one error, so
  people using assistive technology don't have to fix-and-rerun one problem at a time.
- **No surprises at runtime.** dotvar never writes to the console, opens dialogs or
  changes the page. It only returns values or throws errors your app controls.

## Documentation

The README, SECURITY.md and other docs aim to follow
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) where it applies to written content:

- A logical heading hierarchy (one `#` per page, no skipped levels), so screen-reader
  users can navigate by heading.
- Descriptive link text instead of "click here", and alt text on every image and badge.
- Code samples in fenced blocks with a language tag. Comments explain meaning instead of
  relying on syntax highlighting.
- Tables with header rows, used only for tabular data.
- Plain language, short sentences, and abbreviations spelled out on first use.

## Contributing

- Issue and pull-request templates are GitHub forms that work with keyboard and screen
  readers. Any field can be answered in plain text.
- Contributions are welcome in whatever form works for you. If a template, tool or
  process gets in your way, say so in an issue, or ask a maintainer to help you file it.
- Community standards are in the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting an accessibility problem

If something in the library's output or the documentation is hard to use with
assistive technology, or is unclear, please
[open an issue](https://github.com/xkid1/dotvar/issues/new/choose) and add the
`accessibility` label if you can. Include what you were trying to do, the tool you used
(for example the screen reader, browser or terminal) and what went wrong. Accessibility
issues are treated as bugs.
