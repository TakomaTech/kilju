const codeInput = document.getElementById('code-input');
const runBtn = document.getElementById('run-btn');
const clearBtn = document.getElementById('clear-btn');
const output = document.getElementById('output');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');

runBtn.addEventListener('click', runCode);
clearBtn.addEventListener('click', clearOutput);

function runCode() {
    const code = codeInput.value;
    if (!code.trim()) {
        output.innerHTML = '<span class="hint">Please write some Kilju code first</span>';
        return;
    }

    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    output.textContent = 'Executing...';

    const result = runLocalCode(code);
    if (result.success) {
        output.textContent = result.output;
    } else {
        output.textContent = 'Error: ' + result.error;
    }

    runBtn.disabled = false;
    runBtn.textContent = 'Run Code';
}

function runLocalCode(code) {
    const state = {
        vars: {},
        output: []
    };

    const lines = code.replace(/\r\n/g, '\n').split('\n');

    try {
        executeBlock(lines, 0, state, null);
        return { success: true, output: state.output.join('\n') };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function executeBlock(lines, startIndex, state, endToken) {
    for (let i = startIndex; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('//')) continue;

        if (endToken && line === endToken) {
            return i;
        }

        if (line.startsWith('format ')) {
            const args = parseArgs(line.slice(7));
            const values = args.map(arg => evaluateExpression(arg, state));
            state.output.push(values.join(' '));
            continue;
        }

        if (line.startsWith('~(mut) ')) {
            const assign = line.slice(7).trim();
            const [left, right] = assign.split(/\s*=\s*/);
            if (!left || right === undefined) {
                throw new Error('Invalid assignment syntax');
            }
            state.vars[left.trim()] = evaluateExpression(right, state);
            continue;
        }

        if (line.includes(' into ')) {
            const parts = line.split(/\s+into\s+/);
            if (parts.length !== 2) {
                throw new Error('Invalid into assignment');
            }
            const value = evaluateExpression(parts[0], state);
            const name = parts[1].trim();
            state.vars[name] = value;
            continue;
        }

        if (line.startsWith('if ')) {
            const condition = line.slice(3).trim();
            const thenStart = i + 1;
            let elseIndex = null;
            let endIf = null;
            for (let j = thenStart; j < lines.length; j++) {
                const trimmed = lines[j].trim();
                if (trimmed === 'else') {
                    elseIndex = j;
                }
                if (trimmed === 'end if') {
                    endIf = j;
                    break;
                }
            }
            if (endIf === null) throw new Error('Missing end if');
            const conditionValue = evaluateExpression(condition, state);
            if (conditionValue) {
                executeBlock(lines, thenStart, state, elseIndex || 'end if');
            } else if (elseIndex !== null) {
                executeBlock(lines, elseIndex + 1, state, 'end if');
            }
            i = endIf;
            continue;
        }

        if (line.startsWith('while ')) {
            const condition = line.slice(6).trim();
            const bodyStart = i + 1;
            let endWhile = null;
            for (let j = bodyStart; j < lines.length; j++) {
                if (lines[j].trim() === 'end while') {
                    endWhile = j;
                    break;
                }
            }
            if (endWhile === null) throw new Error('Missing end while');
            while (evaluateExpression(condition, state)) {
                executeBlock(lines, bodyStart, state, 'end while');
            }
            i = endWhile;
            continue;
        }

        if (line.startsWith('loop')) {
            const bodyStart = i + 1;
            let endLoop = null;
            for (let j = bodyStart; j < lines.length; j++) {
                if (lines[j].trim() === 'end loop') {
                    endLoop = j;
                    break;
                }
            }
            if (endLoop === null) throw new Error('Missing end loop');
            const loopLimit = 1000;
            let count = 0;
            while (true) {
                if (count++ > loopLimit) throw new Error('Infinite loop detected');
                executeBlock(lines, bodyStart, state, 'end loop');
            }
        }

        if (line.startsWith('import ')) {
            continue;
        }

        throw new Error('Unsupported Kilju statement: ' + line);
    }
    return lines.length;
}

function parseArgs(text) {
    const args = [];
    let current = '';
    let inString = false;
    let quoteChar = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if ((ch === '"' || ch === "'") && text[i - 1] !== '\\') {
            if (inString && ch === quoteChar) {
                inString = false;
            } else if (!inString) {
                inString = true;
                quoteChar = ch;
            }
        }
        if (ch === ',' && !inString) {
            args.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) args.push(current.trim());
    return args;
}

function evaluateExpression(expr, state) {
    expr = expr.trim();
    if (/^".*"$/s.test(expr) || /^'.*'$/s.test(expr)) {
        return expr.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
        return Number(expr);
    }
    const transformed = expr.replace(/([A-Za-z_][A-Za-z0-9_]*)/g, (name) => {
        if (name === 'true' || name === 'false' || name === 'null') return name;
        if (Object.prototype.hasOwnProperty.call(state.vars, name)) {
            return JSON.stringify(state.vars[name]);
        }
        throw new Error('Unknown variable: ' + name);
    });
    if (/[^0-9A-Za-z_\s\+\-\*\/\%\(\)\=\!\<\>\&\|\"\'\,\.]/.test(transformed)) {
        throw new Error('Invalid expression: ' + expr);
    }
    try {
        return Function('return (' + transformed + ');')();
    } catch (error) {
        throw new Error('Error evaluating expression: ' + expr);
    }
}

function clearOutput() {
    output.innerHTML = '<span class="hint">Output cleared</span>';
}

function showExamples() {
    const examples = {
        'Hello World': 'format "Hello, World"',
        'Variables': '~(mut) x = 5\nformat x',
        'Loop': '~(mut) i = 0\nwhile i < 5\n    format i\n    i + 1 into i',
        'Function': 'fnc add(a, b) start\n    a + b\nend fnc\n\nformat add(3, 4)',
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
