import * as vscode from 'vscode';

export class UIManager {
    private restoreButton: vscode.StatusBarItem | undefined;
    private restoreDisposable: vscode.Disposable | undefined;
    private highlightDecorationType!: vscode.TextEditorDecorationType;
    private context: vscode.ExtensionContext;
    private static readonly LAST_PATTERN_KEY = 'logLineFilter.lastPattern';
    private static readonly HISTORY_PATTERNS_KEY = 'logLineFilter.historyPatterns';
    private static readonly MAX_HISTORY = 10;

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

    private async getHistoryPatterns(): Promise<string[]> {
        return this.context.globalState.get<string[]>(UIManager.HISTORY_PATTERNS_KEY, []);
    }

    private async addToHistory(pattern: string) {
        let history = await this.getHistoryPatterns();
        history = history.filter(p => p !== pattern);
        history.unshift(pattern);
        if (history.length > UIManager.MAX_HISTORY) {
            history = history.slice(0, UIManager.MAX_HISTORY);
        }
        await this.context.globalState.update(UIManager.HISTORY_PATTERNS_KEY, history);
    }

    public async showFilterInput(): Promise<string | undefined> {
        const history = await this.getHistoryPatterns();
        const lastPattern = this.context.globalState.get<string>(UIManager.LAST_PATTERN_KEY);

        const input = vscode.window.createQuickPick();
        input.placeholder = 'Enter filter pattern (e.g., ("fail*" or "*error") and "2024-01-01")';
        input.value = lastPattern || '';
        input.items = history.map(pattern => ({ label: pattern }));
        input.keepScrollPosition = true;
        input.ignoreFocusOut = true;

        let userSelectedItem = false;

        return new Promise<string | undefined>((resolve) => {
            // 监听用户手动选择项目
            input.onDidChangeActive(items => {
                if (items.length > 0) {
                    userSelectedItem = true;
                }
            });

            input.onDidChangeValue(() => {
                userSelectedItem = false;
                const searchText = input.value.toLowerCase();
                const filteredItems = history
                    .filter(pattern => pattern.toLowerCase().includes(searchText))
                    .map(pattern => ({ label: pattern }));
                input.items = filteredItems;

                // 强制清除选择
                setTimeout(() => {
                    if (!userSelectedItem) {
                        input.activeItems = [];
                    }
                }, 0);
            });

            input.onDidAccept(() => {
                const value = userSelectedItem && input.activeItems.length > 0
                    ? input.activeItems[0].label
                    : input.value.trim();
                input.hide();
                resolve(value || undefined);
            });

            input.onDidHide(() => {
                input.dispose();
                resolve(undefined);
            });

            input.show();
            // 初始时清除选择
            input.activeItems = [];
        });
    }

    public async setLastPattern(pattern: string) {
        await this.context.globalState.update(UIManager.LAST_PATTERN_KEY, pattern);
        await this.addToHistory(pattern);
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
