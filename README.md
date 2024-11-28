# Line Filter

A powerful VS Code extension for filtering text with advanced regex patterns and logical expressions.

## Features

- Filter lines using complex search patterns
- Support for AND/OR logical operators
- Regex pattern matching
- Wildcard (*) support
- Real-time highlighting
- Automatic content restoration
- Remember last used pattern

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

## License

MIT License - see the [LICENSE](LICENSE) file for details
