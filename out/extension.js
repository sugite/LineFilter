"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const expression_parser_1 = require("./expression-parser");
// 每批处理的行数
const BATCH_SIZE = 5000;
// 存储原始内容的Map
const originalContents = new Map();
// 存储当前的恢复命令disposable
let currentRestoreDisposable;
let currentRestoreButton;
const MAX_HISTORY = 10; // 最多保存10条历史记录
let filterHistory = [];
// 记录上次的输入
let lastPattern;
// 从设置中加载历史记录和收藏夹
async function loadHistory(context) {
    filterHistory = context.globalState.get('filterHistory', []);
}
// 保存历史记录和收藏夹到设置
async function saveHistory(context) {
    await context.globalState.update('filterHistory', filterHistory);
}
// 添加新的历史记录
async function addToHistory(pattern, context) {
    // 如果已存在相同的pattern，更新其时间戳
    const existingIndex = filterHistory.findIndex(h => h.pattern === pattern);
    if (existingIndex !== -1) {
        const existing = filterHistory[existingIndex];
        filterHistory.splice(existingIndex, 1);
        filterHistory.unshift({
            ...existing,
            timestamp: Date.now()
        });
    }
    else {
        // 添加新记录
        filterHistory.unshift({
            pattern,
            timestamp: Date.now()
        });
        // 保持历史记录数量在限制内
        if (filterHistory.length > MAX_HISTORY) {
            // 保留收藏的项目
            const favorites = filterHistory.filter(h => h.favorite);
            const nonFavorites = filterHistory.filter(h => !h.favorite);
            filterHistory = [
                ...favorites,
                ...nonFavorites.slice(0, MAX_HISTORY - favorites.length)
            ];
        }
    }
    await saveHistory(context);
}
function activate(context) {
    // 加载历史记录
    loadHistory(context);
    // 创建一个装饰器类型
    const highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 235, 59, 0.3)',
        border: '1px solid rgba(255, 235, 59, 0.7)'
    });
    let disposable = vscode.commands.registerCommand('linefilter.filter', async () => {
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
            const currentFullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
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
        let filterPattern;
        // 显示输入框，带上次输入的值
        filterPattern = await vscode.window.showInputBox({
            prompt: '输入过滤条件 (例如: ("viewDid*" or "*TCP") and "2024")',
            placeHolder: '支持 and/or 运算符，括号，通配符*，模式需要用双引号包裹',
            value: lastPattern // 显示上次的输入
        });
        if (!filterPattern) {
            return;
        }
        // 保存这次的输入
        lastPattern = filterPattern;
        // 添加到历史记录
        await addToHistory(filterPattern, context);
        try {
            // 使用表达式解析器解析条件
            const parser = new expression_parser_1.ExpressionParser();
            const regex = parser.parse(filterPattern);
            // 保存原始内容
            const documentText = editor.document.getText();
            originalContents.set(documentUri, documentText);
            // 创建恢复按钮
            currentRestoreButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            currentRestoreButton.text = "$(discard) 恢复原始内容";
            currentRestoreButton.tooltip = "恢复到过滤前的内容";
            currentRestoreButton.command = 'linefilter.restoreContent';
            currentRestoreButton.show();
            // 注册恢复命令
            currentRestoreDisposable = vscode.commands.registerCommand('linefilter.restoreContent', async () => {
                const originalContent = originalContents.get(documentUri);
                if (originalContent) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "正在恢复原始内容",
                        cancellable: false
                    }, async (progress) => {
                        const restoreEdit = new vscode.WorkspaceEdit();
                        const currentFullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
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
                }
                else {
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
                const matchedRanges = [];
                const filteredLines = [];
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
                                    .replace(/\\"/g, '"') // 处理转义的引号
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
                                }
                                catch (error) {
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
                const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(documentText.length));
                edit.replace(editor.document.uri, fullRange, filteredLines.join('\n'));
                await vscode.workspace.applyEdit(edit);
                // 添加高亮
                editor.setDecorations(highlightDecorationType, matchedRanges);
            });
        }
        catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`过滤出错: ${error.message}`);
            }
            else {
                vscode.window.showErrorMessage('过滤时发生未知错误');
            }
        }
    });
    // 添加一个命令来清除历史记录
    let clearHistoryDisposable = vscode.commands.registerCommand('linefilter.clearFilterHistory', () => {
        filterHistory = [];
        saveHistory(context);
        vscode.window.showInformationMessage('过滤条件历史已清除');
    });
    context.subscriptions.push(disposable, clearHistoryDisposable);
}
exports.activate = activate;
function deactivate() {
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
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map