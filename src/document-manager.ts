import * as vscode from 'vscode';

export class DocumentManager {
    private originalContents = new Map<string, string>();

    public saveOriginalContent(uri: string, content: string) {
        this.originalContents.set(uri, content);
    }

    public getOriginalContent(uri: string): string | undefined {
        return this.originalContents.get(uri);
    }

    public deleteOriginalContent(uri: string) {
        this.originalContents.delete(uri);
    }

    public clear() {
        this.originalContents.clear();
    }

    public hasOriginalContent(uri: string): boolean {
        return this.originalContents.has(uri);
    }

    public async applyEdit(editor: vscode.TextEditor, newContent: string): Promise<boolean> {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length)
        );
        edit.replace(editor.document.uri, fullRange, newContent);
        return await vscode.workspace.applyEdit(edit);
    }
}
