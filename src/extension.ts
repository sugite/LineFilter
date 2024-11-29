import * as vscode from 'vscode';
import { FilterManager } from './filter-manager';
import { UIManager } from './ui-manager';
import { DocumentManager } from './document-manager';

export function activate(context: vscode.ExtensionContext) {
    const filterManager = new FilterManager();
    const uiManager = new UIManager();
    const documentManager = new DocumentManager();

    let disposable = vscode.commands.registerCommand('log-line-filter.filter', async () => {
        // 获取当前活动的文本编辑器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Please open a file first');
            return;
        }

        // 如果有原始内容，先恢复
        const documentUri = editor.document.uri.toString();
        const originalContent = documentManager.getOriginalContent(documentUri);
        if (originalContent) {
            await documentManager.applyEdit(editor, originalContent);
            uiManager.clearHighlights(editor);
            documentManager.deleteOriginalContent(documentUri);
            uiManager.dispose();
        }

        // 获取新的过滤条件
        const filterPattern = await uiManager.showFilterInput();
        if (!filterPattern) {
            return;
        }

        try {
            // 保存原始内容
            const documentText = editor.document.getText();
            documentManager.saveOriginalContent(documentUri, documentText);

            // 创建恢复按钮
            uiManager.createRestoreButton('log-line-filter.restoreContent');

            // 注册恢复命令
            const restoreCommand = vscode.commands.registerCommand('log-line-filter.restoreContent', async () => {
                const originalContent = documentManager.getOriginalContent(documentUri);
                if (originalContent) {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Restoring original content",
                        cancellable: false
                    }, async () => {
                        await documentManager.applyEdit(editor, originalContent);
                        uiManager.clearHighlights(editor);
                        documentManager.deleteOriginalContent(documentUri);
                        uiManager.dispose();
                    });
                } else {
                    vscode.window.showErrorMessage('Cannot restore: original content not found');
                }
            });

            uiManager.setRestoreCommand(restoreCommand);

            // 开始批量处理
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Filtering log",
                cancellable: true
            }, async (progress, token) => {
                const result = await filterManager.filterContent(
                    documentText,
                    filterPattern,
                    progress,
                    token
                );

                if (token.isCancellationRequested) {
                    return;
                }

                // 应用过滤结果
                await documentManager.applyEdit(editor, result.filteredLines.join('\n'));
                uiManager.setHighlights(editor, result.matchedRanges);
            });
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Filter error: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred while filtering');
            }
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // No cleanup needed as all disposables are handled by VSCode
}