# custom-definition-provider README

This is a custom Definition provider. It provides Go To Definition suggestions
by running a user-defined command. This is useful if you want to write your own
script to find definitions, but don't want to author an extension!

## Features

First, configure the extension in settings:

* customDefinitionProvider.definitionCommand

This is the path to a binary which runs when you invoke the Go To Definition command.

* customDefinitionProvider.filePatterns

A list of file patters for which your binary supports. This extension will not
try to provide Go To Definition suggestions for other files types.

## Search Example Script

This is an example bash script which searches for any match of the identifier.
If there are fewer than 10 matches, it prints them. These are forwarded by
this extension as Go To Definition suggestions.
If there are 10 or more matches, it prints nothing - providing no suggestions.

```sh
#!/usr/bin/bash
# /home/me/my_go_to_def.sh

# Use ripgrep to find instances of the search token.
# $2 is the identifier being searched.
query="\\bclass $2\\b"
# Ignore all other parameters, $6+, which are the workspace directories.
shift 5
RESULTS="$(rg -n --column --no-config --no-heading "$query" $* | head -n11)"

# Don't print any results if there are too many.
if [[ "$(echo "$RESULTS" | wc -l)" -lt 10 ]]; then
    echo "$RESULTS"
fi
```

## Search Script Interface

### Parameters

1. Path to the current file. e.g. "/the/full/path/myfile.cc"
2. The identifier being searched. e.g. "MyNiceFunction"
3. Cursor line number. e.g. 10
4. Cursor column number. e.g. 15
5. Current line text. e.g. "  int x = MyNiceFunction(...);"

Remaining args: A list of workspace root folders.

Note that the identifier being searched is deduced by the cursor position
and line text, using word boundaries.

### Output

The script should output one line per suggestion, in the following format:
/full/path/to/file.txt:123:22:any text here is ignored

## Debugging

If it's not working as expected, this extension logs some information to
an output panel.

## Known Issues

It's rudimentary. You need to provide the logic in your script.

## Release Notes

### 1.0.0

Initial release.
