---
description: Explain  any file in plain language
argument-hint: <filepath>
---

Read and explain the file at @$ARGUMENTS in clear, plain language.

Structure your explanation as:

## Purpose
One paragraph: what this middleware does and why it exists in the request lifecycle.

## How it works
Walk through the code step by step:
- What it checks or transforms on incoming requests
- What conditions cause it to allow, block, or modify a request
- What it adds to the request/response (headers, user info, etc.)
- What it does on errors

## Where it fits
- When in the request lifecycle this runs (before/after which other middleware)
- Which routes or endpoints it applies to
- What other parts of the code depend on its behavior

## Gotchas
- Edge cases that aren't obvious from reading the code
- Common mistakes when modifying it
- Performance or security implications

Assume I'm a developer but new to this codebase. Use real code snippets from the file as examples, not generic ones. If anything is unclear or looks like a bug, flag it.