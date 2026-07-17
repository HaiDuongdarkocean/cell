# Category Map — task construct → convention categories

Index of the index. Read this first in APPLY mode to find which categories to grep in the JSONs.

## HTML/CSS constructs → `htmlcss-style-guide.json`

| Task construct | Categories |
|---|---|
| HTML document structure, doctype, meta | `html`, `general` |
| HTML semantics, elements, tags | `html` |
| HTML attributes (id, class, type, quotes) | `html` |
| HTML formatting, line wrapping | `html` |
| CSS selectors, class names, IDs | `css`, `naming` |
| CSS properties, values, units, shorthand | `css` |
| CSS formatting (braces, semicolons, indentation) | `css` |
| CSS colors, hex, quotes | `css` |
| BEM naming (block, element, modifier, js- hooks) | `naming` |
| Multimedia, images, alt text | `html` |
| Separation of structure/presentation/behavior | `html` |
| Encoding, indentation, whitespace, comments, TODOs | `general` |

## TypeScript constructs → `typescript-style-guide.json`

| Task construct | Categories |
|---|---|
| File structure, encoding, copyright, @fileoverview | `sourceFile` |
| Imports, exports, modules, namespaces | `imports`, `exports` |
| Variables, const/let, arrays, objects, destructuring | `types` |
| Classes, constructors, fields, getters/setters, visibility | `classes` |
| Functions, arrow functions, callbacks, parameters, this | `functions` |
| Control flow, loops, for-in, for-of, blocks | `controlFlow` |
| Errors, try/catch, switch, equality, type assertions | `errorHandling` |
| Decorators, eval, ASI, const enum, debugger, builtins | `languageFeatures` |
| Naming: identifiers, camelCase, CONSTANT_CASE, $, _ | `naming` |
| Type annotations, inference, interfaces, any, unknown, {} | `typeAnnotations` |
| Comments (// vs /* */, multi-line) | `comments` |
| JSDoc, @param, @return, @deprecated, markdown in JSDoc | `jsdoc` |
| Reformatting existing code, generated code, deprecation | `misc` |

## How to use

1. Identify the construct(s) your task touches (e.g. "writing a hook" → `functions` + `naming` + `types` + `typeAnnotations`).
2. Grep the JSON by category: `grep '"category": "functions"' conventions/typescript-style-guide.json`.
3. Read the matching rule objects. Each has `severity`, `trigger`, `rule`, optional `example`, and `sourceAnchor` (link to the original Google guide section).
