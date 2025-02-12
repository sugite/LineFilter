import * as vscode from 'vscode';

export class UIManager {
    private decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private highlightRanges: Map<string, vscode.Range[]> = new Map();
    private context: vscode.ExtensionContext;
    private static readonly LAST_PATTERN_KEY = 'logLineFilter.lastPattern';
    private static readonly HISTORY_PATTERNS_KEY = 'logLineFilter.historyPatterns';
    private static readonly MAX_HISTORY = 10;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private getHighlightDecoration(documentUri: string): vscode.TextEditorDecorationType {
        let decoration = this.decorationTypes.get(documentUri);
        if (!decoration) {
            decoration = vscode.window.createTextEditorDecorationType({
                backgroundColor: 'rgba(255, 235, 59, 0.3)', // Light yellow background
                border: '1px solid rgba(255, 235, 59, 0.7)'
            });
            this.decorationTypes.set(documentUri, decoration);
        }
        return decoration;
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
            input.activeItems = [];
        });
    }

    public async setLastPattern(pattern: string) {
        await this.context.globalState.update(UIManager.LAST_PATTERN_KEY, pattern);
        await this.addToHistory(pattern);
    }

    public setHighlights(editor: vscode.TextEditor, ranges: vscode.Range[]) {
        const documentUri = editor.document.uri.toString();
        const decoration = this.getHighlightDecoration(documentUri);
        editor.setDecorations(decoration, ranges);
        this.highlightRanges.set(documentUri, ranges);
    }

    public dispose() {
        // 清理所有装饰器和高亮范围
        for (const decoration of this.decorationTypes.values()) {
            decoration.dispose();
        }
        this.decorationTypes.clear();
        this.highlightRanges.clear();
    }
}
