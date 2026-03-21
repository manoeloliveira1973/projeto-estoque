📦 Sistema de Gestão de Estoque - Manoel
Este é um sistema de controle de estoque full-stack desenvolvido para facilitar o gerenciamento de produtos, fornecedores e movimentações (entradas e saídas), com foco em usabilidade e organização visual.

🚀 Funcionalidades Principais
🔐 Controle de Acesso: Tela de login integrada para segurança dos dados.

👥 Gestão de Fornecedores: Cadastro completo com trava automática para CNPJ duplicado.

📦 Controle de Inventário: * Entrada de produtos com upload de foto.

Cálculo automático de Preço Médio.

Sistema de zoom para fotos dos produtos.

Alerta visual de "Estoque Baixo" (menos de 5 unidades).

💰 Visão Financeira: Cálculo automático do valor total do patrimônio em estoque.

📜 Histórico de Movimentação: Registro detalhado de todas as entradas e saídas.

📊 Exportação de Dados: Botões para exportar tabelas de produtos e fornecedores diretamente para Excel.

🛠️ Tecnologias Utilizadas
Backend:
Node.js: Ambiente de execução.

Express: Framework para criação da API.

SQLite3: Banco de dados leve e relacional.

Multer: Biblioteca para gerenciamento de upload de imagens.

Frontend:
HTML5 / CSS3: Estrutura e estilização (variáveis CSS para temas).

JavaScript (Vanilla): Lógica de consumo de API (Fetch API) e manipulação do DOM.

SheetJS: Biblioteca para geração de arquivos .xlsx.

⚙️ Como Instalar e Rodar
Instale as dependências:

Bash
npm install express sqlite3 sqlite cors multer
Inicie o servidor:

Bash
node nome_do_seu_arquivo.js
Acesse no navegador:
http://localhost:3000

Nota: O usuário padrão é admin e a senha é 123.

📁 Estrutura de Pastas
/uploads: Pasta onde ficam salvas as fotos dos produtos.

estoque.db: Arquivo do banco de dados SQLite (gerado automaticamente).

index.html: Interface do usuário e lógica frontend.

server.js: Lógica do servidor e rotas da API.

📝 Próximas Melhorias (Roadmap)
[ ] Implementar categorias de produtos.

[ ] Adicionar gráfico de movimentação mensal.

[ ] Relatório de lucro baseado no preço de venda.