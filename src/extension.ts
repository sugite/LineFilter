import * as vscode from 'vscode';
import { FilterManager } from './filter-manager';
import { UIManager } from './ui-manager';

export function activate(context: vscode.ExtensionContext) {
    const filterManager = new FilterManager();
    const uiManager = new UIManager(context);

    let filterCommand = vscode.commands.registerCommand('log-line-filter.filter', async () => {
        // 获取当前活动的文本编辑器或活动文件
        let editor = vscode.window.activeTextEditor;
        let documentText: string;
        let languageId: string;

        if (!editor) {
            // 如果没有获取到 editor，尝试直接读取当前文件
            const activeDoc = vscode.window.tabGroups.activeTabGroup.activeTab?.input; 
            if (activeDoc && typeof activeDoc === 'object' && isObjectWithUri(activeDoc)) {
                const uri = activeDoc.uri;
                const fileContent = await vscode.workspace.fs.readFile(uri);
                documentText = Buffer.from(fileContent).toString('utf-8');
                languageId = 'plaintext'; // 对于大文件，默认使用纯文本模式
            } else {
                vscode.window.showErrorMessage('Open a file first');
                return;
            }
        } else {
            documentText = editor.document.getText();
            languageId = editor.document.languageId;
        }

        // 获取新的过滤条件
        const filterPattern = await uiManager.showFilterInput();
        if (!filterPattern) {
            return;
        }

        // 保存本次使用的模式
        await uiManager.setLastPattern(filterPattern);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Filtering...',
                cancellable: true
            }, async (progress, token) => {
                const result = await filterManager.filterContent(documentText, filterPattern, progress, token);
                if (token.isCancellationRequested) {
                    return;
                }

                // 创建新文档
                const filteredContent = result.filteredLines.join('\n');
                const document = await vscode.workspace.openTextDocument({
                    content: filteredContent,
                    language: languageId
                });

                // 显示新文档
                const newEditor = await vscode.window.showTextDocument(document, {
                    viewColumn: vscode.ViewColumn.Beside, // 在旁边的编辑器组中打开
                    preview: true // 预览模式
                });

                // 在新文档中设置高亮
                uiManager.setHighlights(newEditor, result.matchedRanges);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`过滤错误: ${error}`);
        }
    });
    context.subscriptions.push(filterCommand);
}

function isObjectWithUri(obj: any): obj is { uri: any } {
    return 'uri' in obj;
}

export function deactivate() {}