const codeInput = document.getElementById('code-input');
const codeHighlight = document.getElementById('code-highlight');
const runBtn = document.getElementById('run-btn');
const newFileBtn = document.getElementById('new-file-btn');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');
const output = document.getElementById('output');
const fileTabs = document.getElementById('file-tabs');
const fileInput = document.getElementById('file-input');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');

let files = [
    { name: 'main.kj', content: 'format "Hello, World"' }
];
let activeFileIndex = 0;

runBtn.addEventListener('click', runCode);
newFileBtn.addEventListener('click', addFile);
importBtn.addEventListener('click', importFiles);
exportBtn.addEventListener('click', exportFiles);
clearBtn.addEventListener('click', clearOutput);
fileInput.addEventListener('change', handleFileImport);
codeInput.addEventListener('input', () => {
    files[activeFileIndex].content = codeInput.value;
    updateHighlight();
});

codeInput.addEventListener('scroll', () => {
    codeHighlight.scrollTop = codeInput.scrollTop;
    codeHighlight.scrollLeft = codeInput.scrollLeft;
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        runCode();
    }
});

initEditor();

function initEditor() {
    renderFileTabs();
    updateEditor();
}

function renderFileTabs() {
    fileTabs.innerHTML = '';
    files.forEach((file, index) => {
        const tab = document.createElement('div');
        tab.className = 'file-tab' + (index === activeFileIndex ? ' active' : '');
        tab.addEventListener('click', () => setActiveFile(index));

        const label = document.createElement('span');
        label.textContent = file.name;
        tab.appendChild(label);

        if (files.length > 1) {
            const closeButton = document.createElement('button');
            closeButton.className = 'close-file';
            closeButton.textContent = '×';
            closeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                closeFile(index);
            });
            tab.appendChild(closeButton);
        }

        fileTabs.appendChild(tab);
    });
}

function setActiveFile(index) {
    activeFileIndex = index;
    renderFileTabs();
    updateEditor();
}

function updateEditor() {
    codeInput.value = files[activeFileIndex].content;
    updateHighlight();
    codeInput.focus();
}

function addFile() {
    const base = 'file';
    let count = 1;
    let newName = `${base}${count}.kj`;
    while (files.some(file => file.name === newName)) {
        count += 1;
        newName = `${base}${count}.kj`;
    }
    files.push({ name: newName, content: '// New Kilju file\n' });
    activeFileIndex = files.length - 1;
    renderFileTabs();
    updateEditor();
}

function closeFile(index) {
    if (files.length === 1) {
        return;
    }
    files.splice(index, 1);
    if (activeFileIndex >= files.length) {
        activeFileIndex = files.length - 1;
    }
    renderFileTabs();
    updateEditor();
}

function importFiles() {
    fileInput.value = '';
    fileInput.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        if (file.type === 'application/json' || file.name.endsWith('.json')) {
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    files = parsed.map(item => ({
                        name: item.name || 'imported.kj',
                        content: item.content || ''
                    }));
                } else if (parsed.name && parsed.content !== undefined) {
                    files = [{ name: parsed.name, content: parsed.content }];
                } else {
                    throw new Error('Invalid JSON file format');
                }
            } catch (err) {
                output.textContent = 'Error: ' + err.message;
                return;
            }
        } else {
            files = [{ name: file.name, content: text }];
        }
        activeFileIndex = 0;
        renderFileTabs();
        updateEditor();
        output.textContent = 'Imported ' + file.name;
    };
    reader.readAsText(file);
}

function exportFiles() {
    const payload = files.length === 1 ? files[0] : files;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = files.length === 1 ? files[0].name.replace(/\.[^/.]+$/, '') + '.json' : 'kilju-files.json';
    anchor.click();
    URL.revokeObjectURL(url);
}

function runCode() {
    const code = files[activeFileIndex].content;
    if (!code.trim()) {
        output.classList.remove('error');
        output.innerHTML = '<span class="hint">Please write some Kilju code first</span>';
        return;
    }

    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    output.classList.remove('error');
    output.textContent = 'Executing...';

    const result = runLocalCode(code);
    if (result.success) {
        output.classList.remove('error');
        output.textContent = result.output || '<no output>';
    } else {
        output.classList.add('error');
        output.textContent = 'Error: ' + result.error;
    }

    runBtn.disabled = false;
    runBtn.textContent = 'Run';
}

function runLocalCode(code) {
    try {
        const program = parseSource(code);
        const interpreter = new KiljuInterpreter();
        interpreter.execute(program);
        return { success: true, output: interpreter.output.join('\n') };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

const TokenKind = {
    KEYWORD: 'KEYWORD',
    IDENTIFIER: 'IDENTIFIER',
    NUMBER: 'NUMBER',
    STRING: 'STRING',
    OPERATOR: 'OPERATOR',
    PUNCTUATION: 'PUNCTUATION',
    INDENT: 'INDENT',
    DEDENT: 'DEDENT',
    NEWLINE: 'NEWLINE',
    EOF: 'EOF',
};

const keywords = new Set([
    'into', 'import', 'format', 'fnc', 'mut', 'if', 'else', 'while', 'loop', 'null', 'start', 'end',
]);

class Token {
    constructor(kind, value = null) {
        this.kind = kind;
        this.value = value;
    }
}

class Program {
    constructor(body) {
        this.body = body;
    }
}

class ImportStmt {
    constructor(module) {
        this.module = module;
    }
}

class FormatStmt {
    constructor(args) {
        this.args = args;
    }
}

class VarDecl {
    constructor(name, mutable, value) {
        this.name = name;
        this.mutable = mutable;
        this.value = value;
    }
}

class Assign {
    constructor(target, value) {
        this.target = target;
        this.value = value;
    }
}

class FncDef {
    constructor(name, params, body) {
        this.name = name;
        this.params = params;
        this.body = body;
    }
}

class IfStmt {
    constructor(cond, thenBlock, elseBlock) {
        this.cond = cond;
        this.thenBlock = thenBlock;
        this.elseBlock = elseBlock;
    }
}

class WhileStmt {
    constructor(cond, body) {
        this.cond = cond;
        this.body = body;
    }
}

class LoopStmt {
    constructor(body) {
        this.body = body;
    }
}

class IntoStmt {
    constructor(value, target) {
        this.value = value;
        this.target = target;
    }
}

class Expr {}

class NumberLiteral extends Expr {
    constructor(value) {
        super();
        this.value = value;
    }
}

class StringLiteral extends Expr {
    constructor(value) {
        super();
        this.value = value;
    }
}

class Identifier extends Expr {
    constructor(name) {
        super();
        this.name = name;
    }
}

class BinaryOp extends Expr {
    constructor(left, op, right) {
        super();
        this.left = left;
        this.op = op;
        this.right = right;
    }
}

class Call extends Expr {
    constructor(callee, args) {
        super();
        this.callee = callee;
        this.args = args;
    }
}

class NullLiteral extends Expr {
    constructor() {
        super();
    }
}

function tokenize(source) {
    source = source.replace(/\r\n/g, '\n').replace(/\t/g, '    ');
    const lines = source.split('\n');
    const tokens = [];
    const indentStack = [0];

    for (const rawLine of lines) {
        const indentMatch = rawLine.match(/^( *)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        const trimmed = rawLine.trim();

        if (trimmed === '' || trimmed.startsWith('//')) {
            tokens.push(new Token(TokenKind.NEWLINE));
            continue;
        }

        if (indent > indentStack[indentStack.length - 1]) {
            indentStack.push(indent);
            tokens.push(new Token(TokenKind.INDENT));
        }
        while (indent < indentStack[indentStack.length - 1]) {
            indentStack.pop();
            tokens.push(new Token(TokenKind.DEDENT));
        }
        if (indent !== indentStack[indentStack.length - 1]) {
            throw new Error('Indentation error');
        }

        let i = 0;
        while (i < trimmed.length) {
            const ch = trimmed[i];
            if (ch === ' ') {
                i += 1;
                continue;
            }
            if (ch === '"' || ch === "'") {
                const quote = ch;
                let value = '';
                i += 1;
                while (i < trimmed.length && trimmed[i] !== quote) {
                    if (trimmed[i] === '\\' && i + 1 < trimmed.length) {
                        value += trimmed[i + 1];
                        i += 2;
                    } else {
                        value += trimmed[i];
                        i += 1;
                    }
                }
                if (trimmed[i] !== quote) {
                    throw new Error('Unterminated string');
                }
                i += 1;
                tokens.push(new Token(TokenKind.STRING, value));
                continue;
            }
            const identMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(trimmed.slice(i));
            if (identMatch) {
                const word = identMatch[0];
                tokens.push(new Token(keywords.has(word) ? TokenKind.KEYWORD : TokenKind.IDENTIFIER, word));
                i += word.length;
                continue;
            }
            const numMatch = /^\d+(?:\.\d+)?/.exec(trimmed.slice(i));
            if (numMatch) {
                tokens.push(new Token(TokenKind.NUMBER, numMatch[0]));
                i += numMatch[0].length;
                continue;
            }
            const twoChar = trimmed.slice(i, i + 2);
            if (['==', '!=', '<=', '>='].includes(twoChar)) {
                tokens.push(new Token(TokenKind.OPERATOR, twoChar));
                i += 2;
                continue;
            }
            if ('+-*/%><='.includes(ch)) {
                tokens.push(new Token(TokenKind.OPERATOR, ch));
                i += 1;
                continue;
            }
            if ('(),~'.includes(ch)) {
                tokens.push(new Token(TokenKind.PUNCTUATION, ch));
                i += 1;
                continue;
            }
            throw new Error('Unexpected character: ' + ch);
        }
        tokens.push(new Token(TokenKind.NEWLINE));
    }

    while (indentStack.length > 1) {
        indentStack.pop();
        tokens.push(new Token(TokenKind.DEDENT));
    }
    tokens.push(new Token(TokenKind.EOF));
    return tokens;
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    peek() {
        return this.tokens[this.pos];
    }
    advance() {
        return this.tokens[this.pos++];
    }
    expect(kind, value = null) {
        const tok = this.peek();
        if (tok.kind !== kind || (value !== null && tok.value !== value)) {
            throw new Error(`Expected ${kind} ${value !== null ? value : ''} but got ${tok.kind} ${tok.value}`);
        }
        return this.advance();
    }
    skipNewlines() {
        while (this.peek().kind === TokenKind.NEWLINE) {
            this.advance();
        }
    }
    parse() {
        const body = [];
        this.skipNewlines();
        while (this.peek().kind !== TokenKind.EOF) {
            let stmt = this.parseStatement();
            this.skipNewlines();
            if (stmt instanceof Expr && this._peekBlockIsSimpleInto()) {
                const target = this._consumeIndentedIntoTarget();
                stmt = new IntoStmt(stmt, target);
            }
            body.push(stmt);
            this.skipNewlines();
        }
        return new Program(body);
    }
    parseStatement() {
        const tok = this.peek();
        if (tok.kind === TokenKind.KEYWORD) {
            switch (tok.value) {
                case 'into': return this.parseIntoStatement();
                case 'import': return this.parseImport();
                case 'format': return this.parseFormat();
                case 'fnc': return this.parseFnc();
                case 'if': return this.parseIf();
                case 'while': return this.parseWhile();
                case 'loop': return this.parseLoop();
            }
        }
        if (tok.kind === TokenKind.PUNCTUATION && tok.value === '~') {
            return this.parseVarDecl();
        }
        if (tok.kind === TokenKind.IDENTIFIER) {
            if (this.tokens[this.pos + 1] && this.tokens[this.pos + 1].kind === TokenKind.OPERATOR && this.tokens[this.pos + 1].value === '=') {
                return this.parseAssign();
            }
            const expr = this.parseExpression();
            if (this.peek().kind === TokenKind.KEYWORD && this.peek().value === 'into') {
                return this.parseIntoAfterExpr(expr);
            }
            return expr;
        }
        throw new Error(`Unexpected token at statement: ${tok.kind} ${tok.value}`);
    }
    parseImport() {
        this.expect(TokenKind.KEYWORD, 'import');
        const tok = this.expect(TokenKind.STRING);
        return new ImportStmt(tok.value);
    }
    parseFormat() {
        this.expect(TokenKind.KEYWORD, 'format');
        const args = [];
        while (true) {
            args.push(this.parseExpression());
            if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === ',') {
                this.advance();
                continue;
            }
            break;
        }
        return new FormatStmt(args);
    }
    parseVarDecl() {
        this.expect(TokenKind.PUNCTUATION, '~');
        this.expect(TokenKind.PUNCTUATION, '(');
        const mutTok = this.expect(TokenKind.KEYWORD);
        const mutable = mutTok.value === 'mut';
        this.expect(TokenKind.PUNCTUATION, ')');
        const nameTok = this.expect(TokenKind.IDENTIFIER);
        const name = nameTok.value;
        this.expect(TokenKind.OPERATOR, '=');
        const value = this.parseExpression();
        if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === '~') {
            this.advance();
        }
        return new VarDecl(name, mutable, value);
    }
    parseIntoStatement() {
        this.expect(TokenKind.KEYWORD, 'into');
        let name;
        if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === '(') {
            this.advance();
            name = this.expect(TokenKind.IDENTIFIER).value;
            this.expect(TokenKind.PUNCTUATION, ')');
        } else {
            name = this.expect(TokenKind.IDENTIFIER).value;
        }
        return new IntoStmt(new Identifier('__LAST__'), name);
    }
    parseIntoAfterExpr(expr) {
        this.expect(TokenKind.KEYWORD, 'into');
        let name;
        if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === '(') {
            this.advance();
            name = this.expect(TokenKind.IDENTIFIER).value;
            this.expect(TokenKind.PUNCTUATION, ')');
        } else {
            name = this.expect(TokenKind.IDENTIFIER).value;
        }
        return new IntoStmt(expr, name);
    }
    parseAssign() {
        const name = this.expect(TokenKind.IDENTIFIER).value;
        this.expect(TokenKind.OPERATOR, '=');
        const value = this.parseExpression();
        return new Assign(name, value);
    }
    parseFnc() {
        this.expect(TokenKind.KEYWORD, 'fnc');
        const name = this.expect(TokenKind.IDENTIFIER).value;
        this.expect(TokenKind.PUNCTUATION, '(');
        const params = [];
        if (this.peek().kind === TokenKind.IDENTIFIER) {
            params.push(this.expect(TokenKind.IDENTIFIER).value);
            while (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === ',') {
                this.advance();
                params.push(this.expect(TokenKind.IDENTIFIER).value);
            }
        }
        this.expect(TokenKind.PUNCTUATION, ')');
        this.expect(TokenKind.KEYWORD, 'start');
        const body = this.parseBlock(true, ['end', 'fnc']);
        return new FncDef(name, params, body);
    }
    parseIf() {
        this.expect(TokenKind.KEYWORD, 'if');
        const cond = this.parseExpression();
        const thenBlock = this.parseBlock();
        let elseBlock = null;
        if (this.peek().kind === TokenKind.KEYWORD && this.peek().value === 'else') {
            this.advance();
            elseBlock = this.parseBlock();
        }
        return new IfStmt(cond, thenBlock, elseBlock);
    }
    parseWhile() {
        this.expect(TokenKind.KEYWORD, 'while');
        const cond = this.parseExpression();
        const body = this.parseBlock();
        return new WhileStmt(cond, body);
    }
    parseLoop() {
        this.expect(TokenKind.KEYWORD, 'loop');
        const body = this.parseBlock(true, ['end', 'loop']);
        return new LoopStmt(body);
    }
    parseBlock(allowEndKeyword = false, endKeywordPair = null) {
        const stmts = [];
        this.skipNewlines();
        if (allowEndKeyword && endKeywordPair) {
            const [end1, end2] = endKeywordPair;
            if (this.peek().kind === TokenKind.INDENT) {
                this.advance();
                this.skipNewlines();
            }
            while (!(this.peek().kind === TokenKind.KEYWORD && this.peek().value === end1)) {
                if (this.peek().kind === TokenKind.EOF) throw new Error('Unterminated block, expected end keyword');
                if (this.peek().kind === TokenKind.DEDENT) {
                    this.advance();
                    this.skipNewlines();
                    continue;
                }
                stmts.push(this.parseStatement());
                this.skipNewlines();
            }
            this.expect(TokenKind.KEYWORD, end1);
            this.expect(TokenKind.KEYWORD, end2);
            return stmts;
        }
        if (this.peek().kind === TokenKind.INDENT) {
            this.advance();
            while (this.peek().kind !== TokenKind.DEDENT && this.peek().kind !== TokenKind.EOF) {
                stmts.push(this.parseStatement());
                this.skipNewlines();
            }
            if (this.peek().kind === TokenKind.DEDENT) this.advance();
            return stmts;
        }
        while (this.peek().kind !== TokenKind.DEDENT && this.peek().kind !== TokenKind.EOF && this.peek().kind !== TokenKind.KEYWORD) {
            stmts.push(this.parseStatement());
            this.skipNewlines();
            if (this.peek().kind === TokenKind.NEWLINE) this.advance();
        }
        return stmts;
    }
    parseExpression(minPrecedence = 0) {
        let left = this.parsePrimary();
        while (true) {
            const tok = this.peek();
            if (tok.kind !== TokenKind.OPERATOR) break;
            const prec = this._precedence(tok.value);
            if (prec < minPrecedence) break;
            const op = tok.value;
            this.advance();
            const right = this.parseExpression(prec + 1);
            if (op === '>') {
                if (right instanceof Identifier) {
                    left = new Call(right, [left]);
                } else if (right instanceof Call) {
                    left = new Call(right.callee, [left, ...right.args]);
                } else {
                    left = new Call(right, [left]);
                }
            } else {
                left = new BinaryOp(left, op, right);
            }
        }
        return left;
    }
    _precedence(op) {
        if (['*', '/', '%'].includes(op)) return 20;
        if (['+', '-'].includes(op)) return 10;
        if (['==', '!=', '<', '>', '<=', '>='].includes(op)) return 5;
        return 0;
    }
    parsePrimary() {
        const tok = this.peek();
        if (tok.kind === TokenKind.NUMBER) {
            this.advance();
            return new NumberLiteral(tok.value);
        }
        if (tok.kind === TokenKind.STRING) {
            this.advance();
            return new StringLiteral(tok.value);
        }
        if (tok.kind === TokenKind.KEYWORD && tok.value === 'null') {
            this.advance();
            return new NullLiteral();
        }
        if (tok.kind === TokenKind.IDENTIFIER) {
            this.advance();
            let node = new Identifier(tok.value);
            if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === '(') {
                this.advance();
                const args = [];
                if (!(this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === ')')) {
                    while (true) {
                        args.push(this.parseExpression());
                        if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === ',') {
                            this.advance();
                            continue;
                        }
                        break;
                    }
                }
                this.expect(TokenKind.PUNCTUATION, ')');
                node = new Call(node, args);
            }
            return node;
        }
        if (tok.kind === TokenKind.PUNCTUATION && tok.value === '(') {
            this.advance();
            const expr = this.parseExpression();
            this.expect(TokenKind.PUNCTUATION, ')');
            return expr;
        }
        throw new Error(`Unexpected token in expression: ${tok.kind} ${tok.value}`);
    }
    _peekBlockIsSimpleInto() {
        let pos = this.pos;
        if (pos >= this.tokens.length) return false;
        if (this.tokens[pos].kind !== TokenKind.INDENT) return false;
        pos += 1;
        while (pos < this.tokens.length && this.tokens[pos].kind === TokenKind.NEWLINE) pos += 1;
        if (pos >= this.tokens.length) return false;
        if (this.tokens[pos].kind !== TokenKind.KEYWORD || this.tokens[pos].value !== 'into') return false;
        pos += 1;
        if (pos < this.tokens.length && this.tokens[pos].kind === TokenKind.PUNCTUATION && this.tokens[pos].value === '(') {
            pos += 1;
            if (pos < this.tokens.length && this.tokens[pos].kind === TokenKind.IDENTIFIER) {
                pos += 1;
                if (pos < this.tokens.length && this.tokens[pos].kind === TokenKind.PUNCTUATION && this.tokens[pos].value === ')') {
                    return true;
                }
                return false;
            }
            return false;
        }
        if (pos < this.tokens.length && this.tokens[pos].kind === TokenKind.IDENTIFIER) return true;
        return false;
    }
    _consumeIndentedIntoTarget() {
        this.expect(TokenKind.INDENT);
        this.skipNewlines();
        this.expect(TokenKind.KEYWORD, 'into');
        let name;
        if (this.peek().kind === TokenKind.PUNCTUATION && this.peek().value === '(') {
            this.advance();
            name = this.expect(TokenKind.IDENTIFIER).value;
            this.expect(TokenKind.PUNCTUATION, ')');
        } else {
            name = this.expect(TokenKind.IDENTIFIER).value;
        }
        while (this.peek().kind !== TokenKind.DEDENT) {
            if (this.peek().kind === TokenKind.NEWLINE) {
                this.advance();
                continue;
            }
            break;
        }
        if (this.peek().kind === TokenKind.DEDENT) this.advance();
        return name;
    }
}

function parseSource(source) {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    return parser.parse();
}

class Environment {
    constructor(parent = null) {
        this.store = {};
        this.mutable = {};
        this.parent = parent;
    }
    declare(name, value, mutable = false) {
        this.store[name] = value;
        this.mutable[name] = mutable;
    }
    lookup(name) {
        if (name in this.store) return this.store[name];
        if (this.parent) return this.parent.lookup(name);
        throw new Error('Undefined variable: ' + name);
    }
    assign(name, value) {
        if (name in this.store) {
            if (!this.mutable[name]) throw new Error('Cannot assign to immutable variable: ' + name);
            this.store[name] = value;
            return;
        }
        if (this.parent) {
            this.parent.assign(name, value);
            return;
        }
        throw new Error('Undefined variable: ' + name);
    }
}

class FunctionValue {
    constructor(params, body, env) {
        this.params = params;
        this.body = body;
        this.env = env;
    }
}

class KiljuInterpreter {
    constructor() {
        this.globalEnv = new Environment();
        this.currentEnv = this.globalEnv;
        this.output = [];
        this.lastValue = null;
        this.globalEnv.declare('localtime', {
            getComputerDate: () => new Date(),
        }, false);
    }
    execute(program) {
        for (const stmt of program.body) {
            this.evalStatement(stmt);
        }
    }
    evalStatement(node) {
        if (node instanceof Expr) {
            this.lastValue = this.evalExpr(node);
            return this.lastValue;
        }
        if (node instanceof ImportStmt) {
            const module = this.importModule(node.module);
            this.currentEnv.declare(node.module, module, false);
            return null;
        }
        if (node instanceof FormatStmt) {
            const values = node.args.map(arg => this.evalExpr(arg));
            this.output.push(values.map(v => v === null ? 'null' : String(v)).join(' '));
            return null;
        }
        if (node instanceof VarDecl) {
            const value = node.value ? this.evalExpr(node.value) : null;
            this.currentEnv.declare(node.name, value, node.mutable);
            return null;
        }
        if (node instanceof Assign) {
            const value = this.evalExpr(node.value);
            this.currentEnv.assign(node.target, value);
            return value;
        }
        if (node instanceof FncDef) {
            const value = new FunctionValue(node.params, node.body, this.currentEnv);
            this.currentEnv.declare(node.name, value, false);
            return null;
        }
        if (node instanceof IfStmt) {
            if (this.isTruthy(this.evalExpr(node.cond))) {
                this.executeBlock(node.thenBlock);
            } else if (node.elseBlock) {
                this.executeBlock(node.elseBlock);
            }
            return null;
        }
        if (node instanceof WhileStmt) {
            while (this.isTruthy(this.evalExpr(node.cond))) {
                this.executeBlock(node.body);
            }
            return null;
        }
        if (node instanceof LoopStmt) {
            let count = 0;
            while (true) {
                if (count++ > 10000) throw new Error('Infinite loop detected');
                this.executeBlock(node.body);
            }
        }
        if (node instanceof IntoStmt) {
            let value;
            if (node.value instanceof Identifier && node.value.name === '__LAST__') {
                value = this.lastValue;
            } else {
                value = this.evalExpr(node.value);
            }
            this.currentEnv.assign(node.target, value);
            return value;
        }
        return null;
    }
    executeBlock(body) {
        const parent = this.currentEnv;
        this.currentEnv = new Environment(parent);
        for (const stmt of body) {
            this.evalStatement(stmt);
        }
        this.currentEnv = parent;
    }
    evalExpr(node) {
        if (node instanceof NumberLiteral) {
            return node.value.includes('.') ? parseFloat(node.value) : parseInt(node.value, 10);
        }
        if (node instanceof StringLiteral) {
            return node.value;
        }
        if (node instanceof NullLiteral) {
            return null;
        }
        if (node instanceof Identifier) {
            return this.currentEnv.lookup(node.name);
        }
        if (node instanceof BinaryOp) {
            if (node.op === '>') {
                return this.evalPipeline(this.evalExpr(node.left), node.right);
            }
            const left = this.evalExpr(node.left);
            const right = this.evalExpr(node.right);
            switch (node.op) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/': return left / right;
                case '%': return left % right;
                case '==': return left == right;
                case '!=': return left != right;
                case '<': return left < right;
                case '>': return left > right;
                case '<=': return left <= right;
                case '>=': return left >= right;
            }
        }
        if (node instanceof Call) {
            const args = node.args.map(arg => this.evalExpr(arg));
            if (node.callee instanceof Identifier && args.length > 0 && typeof args[0] === 'object' && args[0] !== null && node.callee.name in args[0] && typeof args[0][node.callee.name] === 'function') {
                return args[0][node.callee.name](...args.slice(1));
            }
            const callee = this.resolveCallee(node.callee);
            if (callee instanceof FunctionValue) {
                return this.callFunction(callee, args);
            }
            if (typeof callee === 'function') {
                return callee(...args);
            }
        }
        throw new Error('Unsupported expression');
    }
    evalPipeline(left, right) {
        if (right instanceof Call && right.callee instanceof Identifier && typeof left === 'object' && left !== null && right.callee.name in left && typeof left[right.callee.name] === 'function') {
            const args = right.args.map(arg => this.evalExpr(arg));
            return left[right.callee.name](...args);
        }
        if (right instanceof Call) {
            const callee = this.resolveCallee(right.callee, left);
            const args = right.args.map(arg => this.evalExpr(arg));
            if (callee instanceof FunctionValue) {
                return this.callFunction(callee, [left, ...args]);
            }
            if (typeof callee === 'function') {
                return callee(left, ...args);
            }
        }
        if (right instanceof Identifier) {
            if (typeof left === 'object' && left !== null && right.name in left && typeof left[right.name] === 'function') {
                return left[right.name]();
            }
            const callee = this.resolveCallee(right);
            if (callee instanceof FunctionValue) {
                return this.callFunction(callee, [left]);
            }
            if (typeof callee === 'function') {
                return callee(left);
            }
        }
        return this.evalExpr(right);
    }
    resolveCallee(node, moduleContext = null) {
        if (node instanceof Identifier) {
            try {
                return this.currentEnv.lookup(node.name);
            } catch (error) {
                if (moduleContext && typeof moduleContext === 'object' && node.name in moduleContext) {
                    return moduleContext[node.name];
                }
                throw error;
            }
        }
        return this.evalExpr(node);
    }
    callFunction(fn, args) {
        const env = new Environment(fn.env);
        fn.params.forEach((name, index) => {
            env.declare(name, args[index], true);
        });
        const oldEnv = this.currentEnv;
        this.currentEnv = env;
        this.lastValue = null;
        for (const stmt of fn.body) {
            this.evalStatement(stmt);
        }
        this.currentEnv = oldEnv;
        return this.lastValue;
    }
    importModule(name) {
        if (name === 'localtime') {
            return { getComputerDate: () => new Date() };
        }
        throw new Error('Unknown module: ' + name);
    }
    isTruthy(value) {
        return Boolean(value);
    }
}

function clearOutput() {
    output.classList.remove('error');
    output.innerHTML = '<span class="hint">Output cleared</span>';
}

function showExamples() {
    const examples = {
        'Hello World': 'format "Hello, World"',
        'Variables': '~(mut) x = 5\nformat x',
        'Loop': '~(mut) i = 0\nwhile i < 5\n    format i\n    i + 1 into i',
        'Function': 'fnc HelloWorldLoop() start\n    format "Hello! This will never end"\nend fnc\n\nHelloWorldLoop()',
        'Conditional': 'if 5 > 3\n    format "Five is greater"\nelse\n    format "Not greater"\nend if'
    };

    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gap = '15px';

    for (const [name, code] of Object.entries(examples)) {
        const card = document.createElement('div');
        card.style.border = '1px solid #ddd';
        card.style.padding = '10px';
        card.style.borderRadius = '4px';

        const title = document.createElement('h3');
        title.textContent = name;
        card.appendChild(title);

        const pre = document.createElement('pre');
        pre.style.background = '#f5f5f5';
        pre.style.padding = '10px';
        pre.style.borderRadius = '4px';
        pre.style.overflowX = 'auto';
        pre.textContent = code;
        card.appendChild(pre);

        const button = document.createElement('button');
        button.className = 'btn btn-primary';
        button.style.marginTop = '10px';
        button.textContent = 'Use This';
        button.addEventListener('click', () => insertExample(code));
        card.appendChild(button);

        container.appendChild(card);
    }

    modalTitle.textContent = 'Examples';
    modalBody.innerHTML = '';
    modalBody.appendChild(container);
    modal.classList.remove('hidden');
}

function showDocs() {
    const docs = `
<h3>Kilju Language Reference</h3>
<p><strong>Output:</strong> <code>format "text", variable</code></p>
<p><strong>Variables:</strong> <code>~(mut) name = value ~</code> (mut for mutable)</p>
<p><strong>Assignment:</strong> <code>value into name</code></p>
<p><strong>Functions:</strong> <code>fnc name(params) start ... end fnc</code></p>
<p><strong>Conditionals:</strong> <code>if condition ... else ... end if</code></p>
<p><strong>Loops:</strong> <code>while condition ... end while</code> or <code>loop ... end loop</code></p>
<p><strong>Operators:</strong> <code>+ - * / % == != < > <= >=</code></p>
<p><strong>Pipeline:</strong> <code>value > function(args)</code></p>
<p><strong>Import:</strong> <code>import "module"</code></p>
    `;

    modalTitle.textContent = 'Documentation';
    modalBody.innerHTML = docs;
    modal.classList.remove('hidden');
}

function insertExample(code) {
    codeInput.value = code;
    closeModal();
    codeInput.focus();
}

function closeModal() {
    modal.classList.add('hidden');
}

function escapeHtml(text, forAttr = false) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    let escaped = text.replace(/[&<>"']/g, m => map[m]);
    if (forAttr) {
        escaped = escaped.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
    return escaped;
}

function updateHighlight() {
    const code = codeInput.value;
    const escaped = escapeHtml(code)
        .replace(/(\/\/.*)/g, '<span class="token-comment">$1</span>')
        .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, '<span class="token-string">$1</span>')
        .replace(/\b(?:into|import|format|fnc|mut|if|else|while|loop|null|start|end)\b/g, '<span class="token-keyword">$&</span>')
        .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="token-number">$&</span>')
        .replace(/([+\-*/%<>!=]=?|[()~,])/g, '<span class="token-operator">$1</span>')
        .replace(/\t/g, '    ');
    codeHighlight.innerHTML = escaped;
}

window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}

codeInput.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 1;
    }
});

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        runCode();
    }
});
