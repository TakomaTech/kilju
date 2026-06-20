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

    fetch('/api/run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.text().then(text => {
        try {
            return JSON.parse(text);
        } catch {
            return { success: false, error: text || 'Invalid server response' };
        }
    }))
    .then(data => {
        if (data.success) {
            output.textContent = data.output;
        } else {
            output.textContent = 'Error: ' + data.error;
        }
    })
    .catch(error => {
        output.textContent = 'Error: ' + error.message;
    })
    .finally(() => {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Code';
    });
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
