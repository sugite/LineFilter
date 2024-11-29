import * as vscode from 'vscode';

export class UIManager {
    private restoreButton: vscode.StatusBarItem | undefined;
    private restoreDisposable: vscode.Disposable | undefined;
    private highlightDecorationType!: vscode.TextEditorDecorationType;

    constructor() {
        this.createHighlightDecoration();
    }

    private createHighlightDecoration() {
        this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 235, 59, 0.3)', // 淡黄色背景
            border: '1px solid rgba(255, 235, 59, 0.7)'
        });
    }

    public async showFilterInput(): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt: 'Enter filter pattern (e.g., ("fail*" or "*error") and "2024-01-01")',
            placeHolder: 'Supports and/or operators, parentheses, wildcard *, patterns must be wrapped in double quotes'
        });
    }

    public createRestoreButton(command: string) {
        if (this.restoreButton) {
            this.restoreButton.dispose();
        }
        this.restoreButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.restoreButton.text = "$(discard) Restore Original";
        this.restoreButton.tooltip = "Restore to original content";
        this.restoreButton.command = command;
        this.restoreButton.show();
    }

    public setHighlights(editor: vscode.TextEditor, ranges: vscode.Range[]) {
        // 确保装饰器类型存在
        if (!this.highlightDecorationType) {
            this.createHighlightDecoration();
        }
        editor.setDecorations(this.highlightDecorationType, ranges);
    }

    public clearHighlights(editor: vscode.TextEditor) {
        if (this.highlightDecorationType) {
            editor.setDecorations(this.highlightDecorationType, []);
            this.highlightDecorationType.dispose();
            this.createHighlightDecoration();
        }
    }

    public setRestoreCommand(command: vscode.Disposable) {
        if (this.restoreDisposable) {
            this.restoreDisposable.dispose();
        }
        this.restoreDisposable = command;
    }

    public dispose() {
        if (this.restoreButton) {
            this.restoreButton.dispose();
            this.restoreButton = undefined;
        }
        if (this.restoreDisposable) {
            this.restoreDisposable.dispose();
            this.restoreDisposable = undefined;
        }
    }
}
