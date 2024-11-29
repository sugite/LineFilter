import * as vscode from 'vscode';
import { ExpressionParser } from './expression-parser';

export interface FilterResult {
    filteredLines: string[];
    matchedRanges: vscode.Range[];
}

export class FilterManager {
    private static readonly BATCH_SIZE = 5000;

    private *getLines(content: string): Generator<string> {
        let start = 0;
        let end = content.indexOf('\n');
        
        while (end !== -1) {
            yield content.slice(start, end);
            start = end + 1;
            end = content.indexOf('\n', start);
        }
        
        if (start < content.length) {
            yield content.slice(start);
        }
    }

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

        // 计算总行数用于进度显示
        const totalLines = (content.match(/\n/g) || []).length + 1;
        const matchedRanges: vscode.Range[] = [];
        const filteredLines: string[] = [];
        let processedLines = 0;
        let currentLineNumber = 0;
        let batchCount = 0;

        // 使用迭代器按需获取行
        const lineIterator = this.getLines(content);
        let currentBatch: string[] = [];

        for (const line of lineIterator) {
            if (token.isCancellationRequested) {
                return { filteredLines, matchedRanges };
            }

            currentBatch.push(line);
            batchCount++;

            // 当累积够一批时处理
            if (batchCount >= FilterManager.BATCH_SIZE) {
                await this.processBatch(currentBatch, regex, highlightRegexes, matchedRanges, filteredLines, currentLineNumber);
                currentLineNumber += currentBatch.length;
                processedLines += currentBatch.length;
                
                const percentage = (processedLines / totalLines) * 100;
                progress.report({
                    message: `Processed ${processedLines}/${totalLines} lines (${percentage.toFixed(1)}%)`,
                    increment: (FilterManager.BATCH_SIZE / totalLines) * 100
                });

                currentBatch = [];
                batchCount = 0;
            }
        }

        // 处理最后一批
        if (currentBatch.length > 0) {
            await this.processBatch(currentBatch, regex, highlightRegexes, matchedRanges, filteredLines, currentLineNumber);
            processedLines += currentBatch.length;
            
            const percentage = (processedLines / totalLines) * 100;
            progress.report({
                message: `Processed ${processedLines}/${totalLines} lines (${percentage.toFixed(1)}%)`,
                increment: (currentBatch.length / totalLines) * 100
            });
        }

        return { filteredLines, matchedRanges };
    }

    private async processBatch(
        batch: string[],
        regex: RegExp,
        highlightRegexes: RegExp[],
        matchedRanges: vscode.Range[],
        filteredLines: string[],
        startLineNumber: number
    ): Promise<void> {
        let currentLineNumber = startLineNumber;
        
        for (const line of batch) {
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
