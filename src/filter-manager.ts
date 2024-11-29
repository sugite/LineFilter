import * as vscode from 'vscode';
import { ExpressionParser } from './expression-parser';

export interface FilterResult {
    filteredLines: string[];
    matchedRanges: vscode.Range[];
}

export class FilterManager {
    private static readonly BATCH_SIZE = 5000;

    public async filterContent(
        content: string,
        filterPattern: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ): Promise<FilterResult> {
        const parser = new ExpressionParser();
        const regex = parser.parse(filterPattern);
        // 预编译所有高亮模式的正则表达式
        const highlightRegexes = this.extractPatterns(filterPattern).map(pattern => new RegExp(pattern, 'gi'));

        const lines = content.split('\n');
        const totalLines = lines.length;
        const matchedRanges: vscode.Range[] = [];
        const filteredLines: string[] = [];
        let processedLines = 0;
        let currentLineNumber = 0;

        // 批量处理
        for (let i = 0; i < lines.length; i += FilterManager.BATCH_SIZE) {
            if (token.isCancellationRequested) {
                return { filteredLines, matchedRanges };
            }

            const batch = lines.slice(i, Math.min(i + FilterManager.BATCH_SIZE, lines.length));
            for (let j = 0; j < batch.length; j++) {
                const line = batch[j];

                if (regex.test(line)) {
                    // 使用预编译的正则表达式进行高亮匹配
                    for (const highlightRegex of highlightRegexes) {
                        try {
                            const matches = Array.from(line.matchAll(highlightRegex));
                            for (const match of matches) {
                                if (match.index !== undefined) {
                                    const startPos = new vscode.Position(currentLineNumber, match.index);
                                    const endPos = new vscode.Position(currentLineNumber, match.index + match[0].length);
                                    matchedRanges.push(new vscode.Range(startPos, endPos));
                                }
                            }
                        } catch (error) {
                            console.error('Pattern highlighting error:', highlightRegex, error);
                        }
                    }

                    filteredLines.push(line);
                    currentLineNumber++;
                }
            }

            processedLines = Math.min(i + FilterManager.BATCH_SIZE, lines.length);
            const percentage = (processedLines / totalLines) * 100;
            progress.report({
                message: `Processed ${processedLines}/${totalLines} lines (${percentage.toFixed(1)}%)`,
                increment: (FilterManager.BATCH_SIZE / totalLines) * 100
            });
        }

        return { filteredLines, matchedRanges };
    }

    private extractPatterns(filterPattern: string): string[] {
        const patterns: string[] = [];
        const patternRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
        let match;

        while ((match = patternRegex.exec(filterPattern)) !== null) {
            let pattern = match[1]
                .replace(/\\"/g, '"')  // Handle escaped quotes
                .replace(/\\\\/g, '\\') // Handle escaped backslashes
                .replace(/\*/g, '[^]*?'); // Convert wildcards to non-greedy pattern
            patterns.push(pattern);
        }

        return patterns;
    }
}
