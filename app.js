require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do Render: a porta deve ser dinâmica
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// CORS específico para imagens
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.path.startsWith('/proxy')) {
        res.header('Content-Type', 'image/*');
        res.header('Cache-Control', 'public, max-age=3600');
    }
    next();
});

// CONFIGURAÇÃO SUPABASE
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
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

app.delete('/produtos/:id', async (req, res) => {
    await pool.query('DELETE FROM produtos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
});

app.get('/produtos', async (req, res) => {
    const result = await pool.query('SELECT * FROM produtos');
    res.json(result.rows);
});

app.post('/produtos', async (req, res) => {
    try {
        let { nome, preco, quantidade, fornecedor_id, imagem } = req.body;
        nome = nome.trim().toLowerCase();
        const nP = parseFloat(preco.toString().replace(',', '.'));
        const nQ = parseInt(quantidade);

        const ex = await pool.query('SELECT * FROM produtos WHERE LOWER(nome) = LOWER($1) AND fornecedor_id = $2', [nome, fornecedor_id]);

        if (ex.rows.length > 0) {
            const produto = ex.rows[0];
            const novaQ = produto.quantidade + nQ;
            const novoP = ((produto.preco * produto.quantidade) + (nP * nQ)) / novaQ;
            await pool.query('UPDATE produtos SET preco=$1, quantidade=$2, imagem=COALESCE($3, imagem) WHERE id=$4', [novoP, novaQ, imagem, produto.id]);
        } else {
            await pool.query('INSERT INTO produtos (nome, preco, quantidade, fornecedor_id, imagem) VALUES ($1, $2, $3, $4, $5)', [nome, nP, nQ, fornecedor_id, imagem]);
        }
        await pool.query('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES ($1, $2, $3)', [nome, "ENTRADA", nQ]);
        res.json({ ok: true });
    } catch (err) {
        console.error('Erro produtos POST:', err);
        res.status(500).json({ erro: 'Erro ao salvar: ' + err.message });
    }
});

app.put('/produtos/:id', async (req, res) => {
    try {
        const { nome, preco, quantidade, imagem } = req.body;
        const nP = parseFloat(preco.toString().replace(',', '.'));
        await pool.query('UPDATE produtos SET nome=$1, preco=$2, quantidade=$3, imagem=$4 WHERE id=$5', [nome, nP, quantidade, imagem, req.params.id]);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: 'Erro ao atualizar: ' + err.message });
    }
});

app.get('/historico', async (req, res) => {
    const result = await pool.query('SELECT * FROM historico ORDER BY data_hora DESC');
    res.json(result.rows);
});

app.delete('/historico', async (req, res) => {
    const { dias } = req.query;
    try {
        if (dias === 'tudo') {
            await pool.query('DELETE FROM historico');
        } else {
            const interval = parseInt(dias);
            await pool.query('DELETE FROM historico WHERE data_hora < NOW() - INTERVAL $1 day', [interval]);
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ erro: 'Erro na limpeza: ' + err.message });
    }
});

app.post('/produtos/:id/saida', async (req, res) => {
    try {
        const { quantidadeSaida } = req.body;
        const qS = parseInt(quantidadeSaida);

        const produto = await pool.query('SELECT nome, quantidade FROM produtos WHERE id = $1', [req.params.id]);
        if (produto.rows.length === 0) return res.status(404).json({ erro: 'Produto não encontrado' });

        const p = produto.rows[0];
        if (p.quantidade < qS) return res.status(400).json({ erro: 'Estoque insuficiente' });

        const novaQtd = p.quantidade - qS;
        await pool.query('UPDATE produtos SET quantidade = $1 WHERE id = $2', [novaQtd, req.params.id]);
        await pool.query('INSERT INTO historico (produto_nome, tipo, quantidade) VALUES ($1, $2, $3)', [p.nome, 'SAÍDA', qS]);

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// Proxy para imagens Supabase Storage
app.get('/proxy/:path(*)', async (req, res) => {
    try {
        const imgUrl = `https://uthfogriscagsibnrmda.supabase.co/storage/v1/object/public/${req.params.path}`;
        console.log(`📸 Proxy: ${imgUrl}`);
        const response = await fetch(imgUrl);
        if (!response.ok) {
            console.log(`❌ Proxy fail: ${response.status}`);
            return res.status(404).send('Imagem não encontrada');
        }
        const buffer = await response.buffer();
        res.set('Content-Type', response.headers.get('content-type') || 'image/webp');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(buffer);
    } catch (err) {
        console.error('Proxy error:', err);
        res.status(500).send('Erro proxy imagem');
    }
});

// Backup info
app.get('/backup', (req, res) => {
    res.status(200).json({ message: 'Use painel Supabase para exportar dados.' });
});

app.listen(PORT, () => { console.log(`🚀 Servidor Online na porta ${PORT}`); });
