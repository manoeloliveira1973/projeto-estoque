require('dotenv').config();
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

(async () => {
    try {
        db = await open({ filename: './estoque.db', driver: sqlite3.Database });
        await db.exec(`
          CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, login TEXT UNIQUE, senha TEXT);
          CREATE TABLE IF NOT EXISTS fornecedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, cnpj TEXT UNIQUE, contato TEXT, telefone TEXT);
          CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, preco REAL, quantidade INTEGER, fornecedor_id INTEGER, imagem TEXT);
          CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, produto_nome TEXT, tipo TEXT, quantidade INTEGER, data_hora DATETIME DEFAULT (datetime('now', 'localtime')));
      `);
        await db.run("ALTER TABLE produtos ADD COLUMN imagem TEXT").catch(() => { });
        await db.run('INSERT OR IGNORE INTO usuarios (login, senha) VALUES ("admin", "123")');
        console.log("🗄️ Banco de Dados pronto!");
    } catch (err) {
        console.error("❌ Erro ao configurar banco:", err);
    }
})();

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;

    // Agora ele verifica o que você escreveu lá no arquivo .env
    if (usuario === process.env.APP_USUARIO && senha === process.env.APP_SENHA) {
        res.json({ ok: true });
    } else {
        res.status(401).send('Usuário ou senha inválidos');
    }
});

app.get('/fornecedores', async (req, res) => res.json(await db.all('SELECT * FROM fornecedores')));
app.post('/fornecedores', async (req, res) => {
    const { nome, cnpj, contato, telefone } = req.body;
    try {
        await db.run('INSERT INTO fornecedores (nome, cnpj, contato, telefone) VALUES (?,?,?,?)', [nome, cnpj, contato, telefone]);
        res.json({ ok: true });
    } catch (e) {
        // Captura o erro de UNIQUE do SQLite e envia para o frontend
        res.status(400).json({ erro: "CNPJ já cadastrado no sistema!" });
    }
});

app.put('/fornecedores/:id', async (req, res) => {
    const { nome, cnpj, contato, telefone } = req.body;
    await db.run('UPDATE fornecedores SET nome=?, cnpj=?, contato=?, telefone=? WHERE id=?', [nome, cnpj, contato, telefone, req.params.id]);
    res.json({ ok: true });
});

app.delete('/fornecedores/:id', async (req, res) => {
    await db.run('DELETE FROM fornecedores WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

app.get('/produtos', async (req, res) => res.json(await db.all('SELECT * FROM produtos')));
app.post('/produtos', upload.single('foto'), async (req, res) => {
    try {
        let { nome, preco, quantidade, fornecedor_id } = req.body;
        const nP = parseFloat(preco.toString().replace(',', '.'));
        const nQ = parseInt(quantidade);
        const foto = req.file ? `/uploads/${req.file.filename}` : null;
        if (!fornecedor_id) return res.status(400).json({ erro: "Selecione um fornecedor!" });
        const ex = await db.get('SELECT * FROM produtos WHERE LOWER(nome) = LOWER(?) AND fornecedor_id = ?', [nome.trim(), fornecedor_id]);
        if (ex) {
            const novaQ = ex.quantidade + nQ;
            const novoP = ((ex.preco * ex.quantidade) + (nP * nQ)) / novaQ;
            await db.run('UPDATE produtos SET preco=?, quantidade=?, imagem=COALESCE(?, imagem) WHERE id=?', [novoP, novaQ, foto, ex.id]);
        } else {
            await db.run('INSERT INTO produtos (nome, preco, quantidade, fornecedor_id, imagem) VALUES (?,?,?,?,?)', [nome.trim(), nP, nQ, fornecedor_id, foto]);
        }
        await db.run('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES (?, "ENTRADA", ?)', [nome, nQ]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ erro: "Erro ao salvar produto" }); }
});

app.put('/produtos/:id', async (req, res) => {
    const { nome, preco, quantidade } = req.body;
    const nP = parseFloat(preco.toString().replace(',', '.'));
    await db.run('UPDATE produtos SET nome=?, preco=?, quantidade=? WHERE id=?', [nome, nP, quantidade, req.params.id]);
    res.json({ ok: true });
});

app.patch('/produtos/:id/saida', async (req, res) => {
    const { quantidadeSaida } = req.body;
    const p = await db.get('SELECT nome, quantidade FROM produtos WHERE id=?', [req.params.id]);
    if (p.quantidade < quantidadeSaida) return res.status(400).json({ erro: "Sem estoque" });
    await db.run('UPDATE produtos SET quantidade = quantidade - ? WHERE id=?', [quantidadeSaida, req.params.id]);
    await db.run('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES (?, "SAÍDA", ?)', [p.nome, quantidadeSaida]);
    res.json({ ok: true });
});

app.delete('/produtos/:id', async (req, res) => {
    await db.run('DELETE FROM produtos WHERE id=?', [req.params.id]);
    res.json({ ok: true });
});

app.get('/historico', async (req, res) => res.json(await db.all('SELECT * FROM historico ORDER BY data_hora DESC')));
app.delete('/historico', async (req, res) => {
    const { dias } = req.query;
    if (dias === 'tudo') await db.run('DELETE FROM historico');
    else await db.run(`DELETE FROM historico WHERE data_hora < datetime('now', 'localtime', '-${dias} days')`);
    res.json({ ok: true });
});

// ROTA DE BACKUP: Apenas lê o arquivo e envia para o navegador
app.get('/backup', (req, res) => {
    const file = path.join(__dirname, 'estoque.db');
    const data = new Date().toISOString().split('T')[0]; // Pega a data atual
    res.download(file, `backup-estoque-${data}.db`);
});


app.listen(3000, () => { console.log("🚀 Servidor Rodando em http://localhost:3000"); });
