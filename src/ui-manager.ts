import * as vscode from 'vscode';

export class UIManager {
    private restoreButton: vscode.StatusBarItem | undefined;
    private restoreDisposable: vscode.Disposable | undefined;
    private highlightDecorationType!: vscode.TextEditorDecorationType;
    private context: vscode.ExtensionContext;
    private static readonly LAST_PATTERN_KEY = 'logLineFilter.lastPattern';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.createHighlightDecoration();
    }

    private createHighlightDecoration() {
        this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 235, 59, 0.3)', // Light yellow background
            border: '1px solid rgba(255, 235, 59, 0.7)'
        });
    }

    public async showFilterInput(): Promise<string | undefined> {
        const lastPattern = this.context.globalState.get<string>(UIManager.LAST_PATTERN_KEY);
        return await vscode.window.showInputBox({
            prompt: 'Enter filter pattern (e.g., ("fail*" or "*error") and "2024-01-01")',
            placeHolder: 'Supports and/or operators, parentheses, wildcard *, patterns must be wrapped in double quotes',
            value: lastPattern // Show last used pattern from persistent storage
        });
    }

    public async setLastPattern(pattern: string) {
        await this.context.globalState.update(UIManager.LAST_PATTERN_KEY, pattern);
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
        // Ensure decoration type exists
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
