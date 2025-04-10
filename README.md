# Line Filter

A powerful VS Code extension for filtering text with advanced regex patterns and logical expressions.

## Demo

![Line Filter Demo](images/demo.gif)

Watch how Line Filter helps you:
- Filter log files with complex patterns
- Use AND/OR operators for precise filtering
- Quick access to pattern history

## Features

- Filter lines using complex search patterns
- Support for AND/OR logical operators
- Wildcard (*) support
- Real-time highlighting
- Pattern history with quick access to recent filters
- Multi-file support with persistent highlights

## Usage

1. Open any text file in VS Code
2. Click the filter icon in the editor title bar or use the command palette to run "Line Filter"
3. Enter your filter pattern using the following syntax:

```
Basic pattern:
    "pattern"                    - Matches lines containing "pattern"

Wildcards:
    "test*"                     - Matches lines containing text starting with "test"
    "*test"                     - Matches lines containing text ending with "test"
    "*test*"                    - Matches lines containing "test" anywhere

Logical operators:
    "pattern1" and "pattern2"   - Matches lines containing both patterns
    "pattern1" or "pattern2"    - Matches lines containing either pattern

Complex expressions:
    ("error*" or "*failed") and "2024"   - Matches lines from 2024 containing either
                                          text starting with "error" or ending with "failed"
```

## Examples

- `"error"` - Find lines containing "error"
- `"*ERROR*" or "*WARN*"` - Find lines containing ERROR or WARN
- `"2024-01*" and "ERROR"` - Find error lines from January 2024
- `("HTTP*" or "TCP*") and "*failed*"` - Find failed HTTP or TCP related lines

## Requirements

VS Code version 1.60.0 or higher

## Changelog

### 1.1.5
- Update README

### 1.1.4
- Modified the filtering functionality to support displaying results in a new editor.
- Resolved an issue where documents were not loaded correctly in certain cases.

### 1.1.3
- Added demo GIF to showcase extension features
- Updated documentation for pattern history feature

### 1.1.2
- Improved multi-file filtering experience
- Fixed highlight restoration when switching editors
- Enhanced decoration management
- Added progress notifications

### 1.1.0
- Initial release with basic filtering functionality
- Support for regex patterns and logical expressions
- Real-time highlighting
- Pattern history

## License

MIT License - see the [LICENSE](LICENSE) file for details
