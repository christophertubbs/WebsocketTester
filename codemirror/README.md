# CodeMirror

### What is it?

[CodeMirror](https://codemirror.net/5/) is an open source HTML based code editor that may be used in just about 
any web browser, both on or offline. CodeMirror version 6+ is currently out, but 5 is used instead since it has 
less reliance on Node.js and is simpler to get up and running, since short function calls can be used instead 
of more advanced object management.

**Requires**

1. `codemirror.js` - Provides the editor functionality and allows scripts to add the editor to the screen
2. `codemirror.css` - Provides the necessary styling to be able to render the editor correctly

The code may be found on [github](https://github.com/codemirror/codemirror5).

### What components are used?

#### Full Screen

The CodeMirror fullscreen functionality allows an editor to take up the entire window. This
is most useful for reading output in real time, but may be used for editing on the other fields.

**Requires**
1. `fullscreen.js` - Provides the functionality to expand the editor to fit the whole screen
2. `fullscreen.css` - Provides the styling to make sure that the editor can correctly fit the whole window

All functionality is provided by CodeMirror. See their [demo](https://codemirror.net/5/demo/fullscreen.html) for more.

#### Javascript

The CodeMirror javascript functionality is used for JSON syntax highlighting. While the module is specifically for 
Javascript, the editors are used for writing and viewing JSON. Using the Javascript functionality allows for proper 
JSON syntax highlighting and linting.

**Requires**

1. `javascript.js`

All functionality is provided by CodeMirror. See their [demo](https://codemirror.net/5/mode/javascript/index.html) 
for more.

#### Brackets

The CodeMirror `closebrackets` and `matchbrackets` modules allow for the highlighting of matching sets of brackets 
and braces. This is useful for identifying member scope while editing.

**Requires**

1. `closebrackets.js`
2. `matchbrackets.js`

All functionality is provided by CodeMirror.

#### Folding

The CodeMirror `foldcode`, `bracefold`, and `foldgutter` modules are used to allow for sections of JSON to be 
collapsed. This is useful for especially long nested sections that can make reading other elements difficult. This 
isn't useful for issuing small requests but comes indespensible for more complex messages requiring nested payloads.

**Requires**

1. `brace-fold.js`
2. `foldcode.js`
3. `foldgutter.js`

All functionality is provided by CodeMirror. See their [demo](https://codemirror.net/5/demo/folding.html) for more.

#### Linting

Several CodeMirror modules are used for linting:

1. `lint.js` - Provides the base functionality for the CodeMirror linting logic
2. `javascript-lint.js` - Adds the specific functionality hooks to the `lint` module to allow for javascript specific linting
3. `json-lint.js` - As with `javascript-lint.js`, adds the specific functionality for also linting JSON input
4. `jshint.js` - Required resource for `javascript-lint.js` used to parse and highlight issues with read javascript
5. `jsonlint.js` - Provides the raw JSON parsing that helps provide the functionality added with `json-lint.js` which is shown via `jshint.js`
6. `lint.css` - Provides the styling rules necessary to render linting messages

All the above is sourced via CodeMirror except [jsonlint.js](https://github.com/zaach/jsonlint), 
which is provided by a developer named [Zach Carter](https://github.com/zaach). See CodeMirror's 
[demo](https://codemirror.net/5/demo/lint.html) for more.