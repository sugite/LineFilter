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
                    // 从搜索模式中提取所有引号内的模式
                    const patterns = this.extractPatterns(filterPattern);

                    // 为每个模式创建高亮
                    for (const pattern of patterns) {
                        try {
                            const highlightRegex = new RegExp(pattern, 'gi');
                            const matches = Array.from(line.matchAll(highlightRegex));
                            
                            for (const match of matches) {
                                if (match.index !== undefined) {
                                    const startPos = new vscode.Position(currentLineNumber, match.index);
                                    const endPos = new vscode.Position(currentLineNumber, match.index + match[0].length);
                                    matchedRanges.push(new vscode.Range(startPos, endPos));
                                }
                            }
                        } catch (error) {
                            console.error('Pattern highlighting error:', pattern, error);
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
            // 提取引号内的内容并转换为高亮模式
            let pattern = match[1]
                .replace(/\\"/g, '"')  // 处理转义的引号
                .replace(/\\\\/g, '\\') // 处理转义的反斜杠
                .replace(/\*/g, '[^]*?'); // 将通配符转换为非贪婪模式
            patterns.push(pattern);
        }

        return patterns;
    }
}
