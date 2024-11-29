import * as vscode from 'vscode';
import { ExpressionParser } from './expression-parser';

// 每批处理的行数
const BATCH_SIZE = 5000;

// 存储原始内容的Map
const originalContents = new Map<string, string>();

// 存储当前的恢复命令disposable
let currentRestoreDisposable: vscode.Disposable | undefined;
let currentRestoreButton: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
    // 创建一个装饰器类型
    const highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 235, 59, 0.3)', // 淡黄色背景
        border: '1px solid rgba(255, 235, 59, 0.7)'
    });

    let disposable = vscode.commands.registerCommand('log-line-filter.filter', async () => {
        // 获取当前活动的文本编辑器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        // 如果有原始内容，先恢复
        const documentUri = editor.document.uri.toString();
        const originalContent = originalContents.get(documentUri);
        if (originalContent) {
            // 自动恢复原始内容
            const restoreEdit = new vscode.WorkspaceEdit();
            const currentFullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );

            restoreEdit.replace(editor.document.uri, currentFullRange, originalContent);
            await vscode.workspace.applyEdit(restoreEdit);
            
            // 清除高亮和原始内容
            editor.setDecorations(highlightDecorationType, []);
            originalContents.delete(documentUri);

            // 清理恢复按钮和命令
            if (currentRestoreButton) {
                currentRestoreButton.dispose();
                currentRestoreButton = undefined;
            }
            if (currentRestoreDisposable) {
                currentRestoreDisposable.dispose();
                currentRestoreDisposable = undefined;
            }
        }

        // 获取新的过滤条件
        const filterPattern = await vscode.window.showInputBox({
            prompt: 'Enter filter pattern (e.g., ("fail*" or "*error") and "2024-01-01")',
            placeHolder: 'Supports and/or operators, parentheses, wildcard *, patterns must be wrapped in double quotes'
        });

        if (!filterPattern) {
            return;
        }

        try {
            // 使用表达式解析器解析条件
            const parser = new ExpressionParser();
            const regex = parser.parse(filterPattern);

            // 保存原始内容
            const documentText = editor.document.getText();
            originalContents.set(documentUri, documentText);

            // 创建恢复按钮
            currentRestoreButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            currentRestoreButton.text = "$(discard) 恢复原始内容";
            currentRestoreButton.tooltip = "恢复到过滤前的内容";
            currentRestoreButton.command = 'log-line-filter.restoreContent';
            currentRestoreButton.show();

            // 注册恢复命令
            currentRestoreDisposable = vscode.commands.registerCommand('log-line-filter.restoreContent', async () => {
                const originalContent = originalContents.get(documentUri);
                if (originalContent) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "正在恢复原始内容",
                        cancellable: false
                    }, async (progress) => {
                        const restoreEdit = new vscode.WorkspaceEdit();
                        const currentFullRange = new vscode.Range(
                            editor.document.positionAt(0),
                            editor.document.positionAt(editor.document.getText().length)
                        );

                        restoreEdit.replace(editor.document.uri, currentFullRange, originalContent);
                        await vscode.workspace.applyEdit(restoreEdit);
                        
                        // 清除高亮和原始内容
                        editor.setDecorations(highlightDecorationType, []);
                        originalContents.delete(documentUri);

                        // 清理恢复按钮和命令
                        if (currentRestoreButton) {
                            currentRestoreButton.dispose();
                            currentRestoreButton = undefined;
                        }
                        if (currentRestoreDisposable) {
                            currentRestoreDisposable.dispose();
                            currentRestoreDisposable = undefined;
                        }

                        vscode.window.showInformationMessage('已恢复原始内容');
                    });
                } else {
                    vscode.window.showErrorMessage('无法恢复原始内容：未找到保存的内容');
                }
            });

            // 开始批量处理
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "正在过滤日志",
                cancellable: true
            }, async (progress, token) => {
                const lines = documentText.split('\n');
                const totalLines = lines.length;
                const matchedRanges: vscode.Range[] = [];
                const filteredLines: string[] = [];
                let processedLines = 0;
                let currentLineNumber = 0;

                // 批量处理
                for (let i = 0; i < lines.length; i += BATCH_SIZE) {
                    if (token.isCancellationRequested) {
                        return;
                    }

                    const batch = lines.slice(i, Math.min(i + BATCH_SIZE, lines.length));
                    for (let j = 0; j < batch.length; j++) {
                        const line = batch[j];

                        if (regex.test(line)) {
                            // 从搜索模式中提取所有引号内的模式
                            const patterns = [];
                            let match;
                            const patternRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
                            while ((match = patternRegex.exec(filterPattern)) !== null) {
                                // 提取引号内的内容并转换为高亮模式
                                let pattern = match[1]
                                    .replace(/\\"/g, '"')  // 处理转义的引号
                                    .replace(/\\\\/g, '\\') // 处理转义的反斜杠
                                    .replace(/\*/g, '[^]*?'); // 将通配符转换为非贪婪模式
                                patterns.push(pattern);
                            }

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

                    processedLines = Math.min(i + BATCH_SIZE, lines.length);
                    const percentage = (processedLines / totalLines) * 100;
                    progress.report({
                        message: `已处理 ${processedLines}/${totalLines} 行 (${percentage.toFixed(1)}%)`,
                        increment: (BATCH_SIZE / totalLines) * 100
                    });
                }

                if (token.isCancellationRequested) {
                    return;
                }

                // 应用过滤结果
                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(documentText.length)
                );
                edit.replace(editor.document.uri, fullRange, filteredLines.join('\n'));
                await vscode.workspace.applyEdit(edit);

                // 添加高亮
                editor.setDecorations(highlightDecorationType, matchedRanges);
            });
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`过滤出错: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('过滤时发生未知错误');
            }
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // 清除所有保存的原始内容
    originalContents.clear();
    
    // 清理恢复命令和按钮
    if (currentRestoreButton) {
        currentRestoreButton.dispose();
    }
    if (currentRestoreDisposable) {
        currentRestoreDisposable.dispose();
    }
}