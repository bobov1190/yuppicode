// Элементы
const el = {
    editor: document.getElementById('editor'),
    backdrop: document.getElementById('backdrop'),
    lines: document.getElementById('lineNumbers'),
    startBtn: document.getElementById('startBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    console: document.getElementById('mainConsole'),
    output: document.getElementById('output'),
    inputLine: document.getElementById('inputLine'),
    inputPrompt: document.getElementById('inputPrompt'),
    termInput: document.getElementById('termInput'),
    fileName: document.getElementById('fileName'),
    suggestions: document.getElementById('autocomplete-list')
};

let isProgramRunning = false;
const pyKeywords = ['print', 'input', 'def', 'return', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'class', 'try', 'except', 'True', 'False', 'None', 'len', 'range', 'append'];

// --- РЕДАКТОР ---
function sync() {
    const code = el.editor.value;
    const lineCount = code.split('\n').length;
    el.lines.innerHTML = Array.from({ length: lineCount }, (_, i) => `<div>${i + 1}</div>`).join('');
    el.backdrop.innerHTML = Prism.highlight(code, Prism.languages.python, 'python') + (code.endsWith('\n') ? ' ' : '');
}

el.editor.addEventListener('input', () => { sync(); handleAutocomplete(); });
el.editor.addEventListener('scroll', () => {
    el.backdrop.scrollTop = el.editor.scrollTop;
    el.lines.scrollTop = el.editor.scrollTop;
});

// Автозакрытие скобок и Tab
el.editor.addEventListener('keydown', (e) => {
    const { selectionStart, value } = el.editor;
    
    // Подсказки
    if (el.suggestions.style.display === 'block') {
        const items = el.suggestions.querySelectorAll('li');
        let active = el.suggestions.querySelector('.active');
        let idx = Array.from(items).indexOf(active);

        if (e.key === 'ArrowDown') { e.preventDefault(); active.classList.remove('active'); items[(idx + 1) % items.length].classList.add('active'); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); active.classList.remove('active'); items[(idx - 1 + items.length) % items.length].classList.add('active'); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (active) active.click(); return; }
    }

    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    if (pairs[e.key]) {
        e.preventDefault();
        el.editor.value = value.substring(0, selectionStart) + e.key + pairs[e.key] + value.substring(selectionStart);
        el.editor.selectionStart = el.editor.selectionEnd = selectionStart + 1;
        sync();
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        el.editor.value = value.substring(0, selectionStart) + "    " + value.substring(selectionStart);
        el.editor.selectionStart = el.editor.selectionEnd = selectionStart + 4;
        sync();
    }
});

// --- ПОДСКАЗКИ ---
function handleAutocomplete() {
    const word = el.editor.value.substring(0, el.editor.selectionStart).split(/[\s()\[\],.:]+/).pop();
    if (word.length < 2) { el.suggestions.style.display = 'none'; return; }

    const matches = pyKeywords.filter(k => k.startsWith(word));
    if (matches.length > 0) {
        el.suggestions.innerHTML = matches.map((m, i) => `<li class="${i === 0 ? 'active' : ''}">${m}</li>`).join('');
        el.suggestions.style.display = 'block';
        el.suggestions.querySelectorAll('li').forEach(li => {
            li.onclick = () => {
                const start = el.editor.selectionStart;
                el.editor.value = el.editor.value.substring(0, start - word.length) + li.textContent + el.editor.value.substring(start);
                el.editor.selectionStart = el.editor.selectionEnd = start - word.length + li.textContent.length;
                el.suggestions.style.display = 'none'; sync(); el.editor.focus();
            };
        });
    } else el.suggestions.style.display = 'none';
}

// --- ТЕРМИНАЛ & PYTHON ---
function createPrompt() {
    el.inputLine.style.display = 'flex';
    el.inputPrompt.innerHTML = `<span style="color: #448FFF;">user@pc:~$</span>`;
    el.termInput.value = ''; el.termInput.focus();
    el.console.scrollTop = el.console.scrollHeight;
}

function runPython() {
    if (isProgramRunning) return;
    isProgramRunning = true;
    el.output.innerHTML += `<span style="color: #555;">[System]: Launching ${el.fileName.innerText}...</span>\n`;
    el.inputLine.style.display = 'none';

    Sk.configure({
        output: t => { el.output.innerText += t; el.console.scrollTop = el.console.scrollHeight; },
        read: x => Sk.builtinFiles["files"][x],
        inputfun: p => new Promise(res => {
            el.inputLine.style.display = 'flex'; el.inputPrompt.innerText = p || "> ";
            el.termInput.value = ''; el.termInput.focus();
            const h = (e) => { if (e.key === 'Enter') { 
                const v = el.termInput.value; el.output.innerText += (p || "> ") + v + "\n";
                el.inputLine.style.display = 'none'; el.termInput.removeEventListener('keydown', h); res(v);
            }};
            el.termInput.addEventListener('keydown', h);
        }),
        inputfunTakesPrompt: true,
        __future__: Sk.python3
    });

    Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, el.editor.value, true))
        .then(() => { isProgramRunning = false; el.output.innerHTML += `\n<span style="color: #555;">Process finished.</span>\n`; createPrompt(); })
        .catch(err => { isProgramRunning = false; el.output.innerHTML += `\n<span style="color: #ff4444;">${err.toString()}</span>\n`; createPrompt(); });
}

// Команды терминала
el.termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isProgramRunning) {
        const cmd = el.termInput.value.trim().toLowerCase();
        el.output.innerText += `user@pc:~$ ${el.termInput.value}\n`;
        if (cmd === 'clear') el.output.innerText = "";
        else if (cmd === 'run') runPython();
        else if (cmd !== '') el.output.innerText += `Command not found: ${cmd}\n`;
        createPrompt();
    }
});

// Скачивание
el.downloadBtn.onclick = () => {
    let name = el.fileName.innerText.trim();
    if (!name.endsWith('.py')) name += '.py';
    const blob = new Blob([el.editor.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
};

// Фикс Enter в имени файла
el.fileName.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.fileName.blur(); } };

el.startBtn.onclick = () => { el.output.innerText = ""; runPython(); };
el.console.onclick = () => el.termInput.focus();

// Start
sync();
createPrompt();