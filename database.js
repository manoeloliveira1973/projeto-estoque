const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

let db;
async function conectarBanco() {
    db = await open({ filename: './estoque.db', driver: sqlite3.Database });
    await db.exec(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE, senha TEXT);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS fornecedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cnpj TEXT UNIQUE, contato TEXT, telefone TEXT);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco REAL NOT NULL, quantidade INTEGER NOT NULL, fornecedor_id INTEGER, imagem TEXT, FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, produto_nome TEXT, tipo TEXT, quantidade INTEGER, data_hora DATETIME DEFAULT (datetime('now', 'localtime')));`);

    const admin = await db.get('SELECT * FROM usuarios WHERE login = "admin"');
    if (!admin) await db.run('INSERT INTO usuarios (login, senha) VALUES ("admin", "123")');
    console.log("✅ Sistema Pronto!");
}
conectarBanco();

// --- ROTAS DE LOGIN E FORNECEDORES ---
app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const user = await db.get('SELECT * FROM usuarios WHERE login = ? AND senha = ?', [usuario, senha]);
    if (user) res.json({ ok: true });
    else res.status(401).json({ erro: 'Incorreto' });
});

app.get('/fornecedores', async (req, res) => res.json(await db.all('SELECT * FROM fornecedores')));
app.post('/fornecedores', async (req, res) => {
    const { nome, cnpj, contato, telefone } = req.body;
    await db.run('INSERT INTO fornecedores (nome, cnpj, contato, telefone) VALUES (?, ?, ?, ?)', [nome, cnpj, contato, telefone]);
    res.json({ ok: true });
});
app.delete('/fornecedores/:id', async (req, res) => {
    await db.run('DELETE FROM fornecedores WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});

// --- ROTAS DE PRODUTOS ---
app.get('/produtos', async (req, res) => res.json(await db.all('SELECT * FROM produtos')));
app.post('/produtos', upload.single('foto'), async (req, res) => {
    let { nome, preco, quantidade, fornecedor_id } = req.body;
    const nPreco = parseFloat(preco.toString().replace(',', '.'));
    const nQtd = parseInt(quantidade);
    const foto = req.file ? `/uploads/${req.file.filename}` : null;

    const existente = await db.get('SELECT * FROM produtos WHERE nome = ? AND fornecedor_id = ?', [nome, fornecedor_id]);
    if (existente) {
        const totalQtd = existente.quantidade + nQtd;
        const pMedio = ((existente.preco * existente.quantidade) + (nPreco * nQtd)) / totalQtd;
        await db.run('UPDATE produtos SET preco = ?, quantidade = ?, imagem = COALESCE(?, imagem) WHERE id = ?', [pMedio, totalQtd, foto, existente.id]);
    } else {
        await db.run('INSERT INTO produtos (nome, preco, quantidade, fornecedor_id, imagem) VALUES (?,?,?,?,?)', [nome, nPreco, nQtd, fornecedor_id, foto]);
    }
    await db.run('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES (?, "ENTRADA", ?)', [nome, nQtd]);
    res.json({ ok: true });
});
app.delete('/produtos/:id', async (req, res) => {
    await db.run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
});
app.patch('/produtos/:id/saida', async (req, res) => {
    const qS = parseInt(req.body.quantidadeSaida);
    const p = await db.get('SELECT nome, quantidade FROM produtos WHERE id=?', [req.params.id]);
    if (!p || p.quantidade < qS) return res.status(400).json({ erro: "Sem estoque" });
    await db.run('UPDATE produtos SET quantidade = quantidade - ? WHERE id=?', [qS, req.params.id]);
    await db.run('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES (?, "SAÍDA", ?)', [p.nome, qS]);
    res.json({ ok: true });
});

// --- HISTÓRICO ---
app.get('/historico', async (req, res) => res.json(await db.all('SELECT * FROM historico ORDER BY data_hora DESC')));
app.delete('/historico', async (req, res) => {
    const { dias } = req.query;
    if (dias === 'tudo') await db.run('DELETE FROM historico');
    else await db.run(`DELETE FROM historico WHERE data_hora < datetime('now', 'localtime', '-${dias} days')`);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));