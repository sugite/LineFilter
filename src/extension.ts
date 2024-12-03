import * as vscode from 'vscode';
import { FilterManager } from './filter-manager';
import { UIManager } from './ui-manager';
import { DocumentManager } from './document-manager';

export function activate(context: vscode.ExtensionContext) {
    const filterManager = new FilterManager();
    const uiManager = new UIManager(context);
    const documentManager = new DocumentManager();

    // 注册恢复命令
    const restoreCommand = vscode.commands.registerCommand('log-line-filter.restoreContent', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const documentUri = editor.document.uri.toString();
        const originalContent = documentManager.getOriginalContent(documentUri);
        if (originalContent) {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Restoring content...',
                cancellable: false
            }, async () => {
                await documentManager.applyEdit(editor, originalContent);
                uiManager.clearHighlights(editor);
                documentManager.deleteOriginalContent(documentUri);
                uiManager.hideRestoreButton();
            });
        }
    });
    context.subscriptions.push(restoreCommand);

    let filterCommand = vscode.commands.registerCommand('log-line-filter.filter', async () => {
        // 获取当前活动的文本编辑器
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Please open a file first');
            return;
        }

        // 获取新的过滤条件
        const filterPattern = await uiManager.showFilterInput();
        if (!filterPattern) {
            return;
        }

        // 保存本次使用的模式
        await uiManager.setLastPattern(filterPattern);

        try {
            const documentUri = editor.document.uri.toString();
            // 如果已经有过滤内容，先恢复
            const existingContent = documentManager.getOriginalContent(documentUri);
            if (existingContent) {
                await documentManager.applyEdit(editor, existingContent);
                uiManager.clearHighlights(editor);
            }

            // 保存原始内容
            const documentText = editor.document.getText();
            documentManager.saveOriginalContent(documentUri, documentText);

            // 显示恢复按钮
            uiManager.createRestoreButton('log-line-filter.restoreContent');

            // 执行过滤
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Filtering...',
                cancellable: true
            }, async (progress, token) => {
                const result = await filterManager.filterContent(documentText, filterPattern, progress, token);
                if (token.isCancellationRequested) {
                    return;
                }
                await documentManager.applyEdit(editor, result.filteredLines.join('\n'));
                uiManager.setHighlights(editor, result.matchedRanges);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Filter error: ${error}`);
        }
    });
    context.subscriptions.push(filterCommand);

    // 监听编辑器切换
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                const documentUri = editor.document.uri.toString();
                if (documentManager.hasOriginalContent(documentUri)) {
                    uiManager.createRestoreButton('log-line-filter.restoreContent');
                    // 恢复高亮
                    uiManager.restoreHighlights(editor);
                } else {
                    uiManager.hideRestoreButton();
                }
            }
        })
    );
}

export function deactivate() {
    // No cleanup needed as all disposables are handled by VSCode
}