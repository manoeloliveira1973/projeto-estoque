require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg'); // Usando apenas Postgres agora

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do Render: a porta deve ser dinâmica
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// CONFIGURAÇÃO SUPABASE
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Inicialização do Banco no Supabase
(async () => {
    try {
        const client = await pool.connect();
        console.log("✅ Conectado ao PostgreSQL no Supabase!");
        await client.query(`
            CREATE TABLE IF NOT EXISTS fornecedores (id SERIAL PRIMARY KEY, nome TEXT, cnpj TEXT UNIQUE, contato TEXT, telefone TEXT);
            CREATE TABLE IF NOT EXISTS produtos (id SERIAL PRIMARY KEY, nome TEXT, preco REAL, quantidade INTEGER, fornecedor_id INTEGER, imagem TEXT);
            CREATE TABLE IF NOT EXISTS historico (id SERIAL PRIMARY KEY, produto_nome TEXT, tipo TEXT, quantidade INTEGER, data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
        `);
        client.release();
    } catch (err) {
        console.error("❌ Erro ao configurar Supabase:", err);
    }
})();

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    if ((usuario === process.env.APP_USUARIO && senha === process.env.APP_SENHA) ||
        (usuario === process.env.PROF_USUARIO && senha === process.env.PROF_SENHA)) {
        res.json({ ok: true });
    } else {
        res.status(401).send('Usuário ou senha inválidos');
    }
});

// --- ROTAS CONVERTIDAS PARA POSTGRES ---

app.get('/fornecedores', async (req, res) => {
    const result = await pool.query('SELECT * FROM fornecedores');
    res.json(result.rows);
});

app.post('/fornecedores', async (req, res) => {
    const { nome, cnpj, contato, telefone } = req.body;
    try {
        await pool.query('INSERT INTO fornecedores (nome, cnpj, contato, telefone) VALUES ($1, $2, $3, $4)', [nome, cnpj, contato, telefone]);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ erro: "CNPJ já cadastrado!" });
    }
});

app.put('/fornecedores/:id', async (req, res) => {
    const { nome, cnpj, contato, telefone } = req.body;
    await pool.query('UPDATE fornecedores SET nome=$1, cnpj=$2, contato=$3, telefone=$4 WHERE id=$5', [nome, cnpj, contato, telefone, req.params.id]);
    res.json({ ok: true });
});

app.delete('/fornecedores/:id', async (req, res) => {
    await pool.query('DELETE FROM fornecedores WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

app.get('/produtos', async (req, res) => {
    const result = await pool.query('SELECT * FROM produtos');
    res.json(result.rows);
});

app.post('/produtos', upload.single('foto'), async (req, res) => {
    try {
        let { nome, preco, quantidade, fornecedor_id } = req.body;
        nome = nome.trim().toLowerCase();
        const nP = parseFloat(preco.toString().replace(',', '.'));
        const nQ = parseInt(quantidade);
        const foto = req.file ? `/uploads/${req.file.filename}` : null;

        const ex = await pool.query('SELECT * FROM produtos WHERE nome = $1 AND fornecedor_id = $2', [nome, fornecedor_id]);

        if (ex.rows.length > 0) {
            const produto = ex.rows[0];
            const novaQ = produto.quantidade + nQ;
            const novoP = ((produto.preco * produto.quantidade) + (nP * nQ)) / novaQ;
            await pool.query('UPDATE produtos SET preco=$1, quantidade=$2, imagem=COALESCE($3, imagem) WHERE id=$4', [novoP, novaQ, foto, produto.id]);
        } else {
            await pool.query('INSERT INTO produtos (nome, preco, quantidade, fornecedor_id, imagem) VALUES ($1, $2, $3, $4, $5)', [nome, nP, nQ, fornecedor_id, foto]);
        }
        await pool.query('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES ($1, $2, $3)', [nome, "ENTRADA", nQ]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ erro: "Erro ao salvar" }); }
});

app.put('/produtos/:id', async (req, res) => {
    const { nome, preco, quantidade } = req.body;
    const nP = parseFloat(preco.toString().replace(',', '.'));
    await pool.query('UPDATE produtos SET nome=$1, preco=$2, quantidade=$3 WHERE id=$4', [nome, nP, quantidade, req.params.id]);
    res.json({ ok: true });
});

app.get('/historico', async (req, res) => {
    const result = await pool.query('SELECT * FROM historico ORDER BY data_hora DESC');
    res.json(result.rows);
});

app.delete('/historico', async (req, res) => {
    const { dias } = req.query;
    if (dias === 'tudo') await pool.query('DELETE FROM historico');
    else await pool.query("DELETE FROM historico WHERE data_hora < NOW() - INTERVAL '$1 days'", [dias]);
    res.json({ ok: true });
});

// No Render, o backup de arquivo .db não existe mais (pois o banco é nuvem)
app.get('/backup', (req, res) => {
    res.status(400).send("O banco agora está seguro no Supabase! Use o painel da Supabase para exportar dados.");
});

app.listen(PORT, () => { console.log(`🚀 Servidor Online na porta ${PORT}`); });