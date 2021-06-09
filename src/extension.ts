// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process';

function workspaceFolders(): string[] {
	return (vscode.workspace.workspaceFolders || []).map((f) => f.uri.path);
}

// Lines should look like this:
// /path/to/file:line:col: Any text here....
function parseLocation(line: string): vscode.Location | undefined {
	line = line.trim();
	let parts = line.split(':');
	if (parts.length < 2) return undefined;
	const column = parts.length < 3 ? 0 : parseInt(parts[2]) - 1;
	return new vscode.Location(vscode.Uri.file(parts[0]), new vscode.Position(parseInt(parts[1]) - 1, column));
}

class DefSubprocess {
	proc: child_process.ChildProcessWithoutNullStreams | undefined;
	stdout: string[] = [];
	private stdErrLogCount = 0;
	result: string[] = [];
	constructor(private logOut: vscode.OutputChannel, private command: string, private onDone: () => void) { }

	start(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
		token.onCancellationRequested(() => this.dispose());
		const lineText = document.lineAt(position.line).text;

		let findToken = "<?>";
		let regexp = /\b[a-zA-Z_0-9]+\b/g;
		let match;
		while ((match = regexp.exec(lineText)) !== null) {
			if (match.index <= position.character && regexp.lastIndex > position.character) {
				findToken = match[0];
				break;
			}
		}
		const args = [
			document.uri.path,
			findToken,
			'' + position.line,
			'' + position.character,
			document.lineAt(position.line).text,
		].concat(workspaceFolders())
		this.proc = child_process.spawn(this.command, args);
		this.logOut.appendLine('Running: ' + this.command + ' ' + JSON.stringify(args));
		this.proc.stdout.on('data', (data) => {
			this.stdout.push(data);
		});

		this.proc.stderr.on('data', (data) => {
			++this.stdErrLogCount;
			if (this.stdErrLogCount < 4) {
				this.logOut.appendLine(data);
			}
		});
		this.proc.on('exit', (exitCode) => {
			this.logOut.appendLine('subprocess exited with code ' + exitCode);
			this.result = this.stdout.join('').split('\n');
			// Don't allow too many matches, it can grind the system to a halt.
			if (this.result.length > 100) {
				this.result = this.result.slice(0, 100);
			}
			this.onDone();
		});
	}

	dispose() {
		try {
			if (this.proc) {
				this.proc.kill();
			}
		} catch (error) { }
	}
}


class DefProvider implements vscode.DefinitionProvider {
	constructor(private logOut: vscode.OutputChannel, private command: string) { }

	provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
		this.logOut.appendLine('provideDefinition called');

		return new Promise((resolve, reject) => {
			let proc: DefSubprocess;
			let locations: vscode.Location[] = [];
			proc = new DefSubprocess(this.logOut, this.command, () => {
				for (let line of proc.result) {
					let loc = parseLocation(line);
					if (loc) {
						locations.push(loc);
					}
				}
				resolve(locations);
			});
			proc.start(document, position, token);
		});
	}
}

class Controller {
	private subscriptions: vscode.Disposable[] = [];

	restart() {
		this.dispose();

		let logOut = vscode.window.createOutputChannel("custom-definition-provider");
		this.subscriptions.push(logOut);

		const filePatterns = vscode.workspace.getConfiguration().get('customDefinitionProvider.filePatterns') as string[];
		const command = vscode.workspace.getConfiguration().get('customDefinitionProvider.definitionCommand') as string;

		if (command) {
			this.subscriptions.push(
				vscode.languages.registerDefinitionProvider(filePatterns.map((pattern) => {
					return { pattern: pattern };
				}),
					new DefProvider(logOut, command)));
		} else {
			logOut.appendLine('definitionCommand not set');
		}
	}
	dispose() {
		while (this.subscriptions.length) {
			this.subscriptions.pop()?.dispose();
		}
	}
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let controller = new Controller();
	context.subscriptions.push(controller);
	controller.restart();
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			console.log("config changed");
			if (event.affectsConfiguration('customDefinitionProvider')) {
				controller.restart();
			}
		}));

}

// this method is called when your extension is deactivated
export function deactivate() { }
