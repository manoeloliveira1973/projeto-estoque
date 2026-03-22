📄 Documentação do Projeto: Sistema de Controle de Estoque
1. Visão Geral
Este é um sistema de gerenciamento de estoque desenvolvido em Node.js, focado em facilitar o controle de entrada e saída de produtos, gestão de fornecedores e histórico de movimentações. O projeto foi migrado de um banco de dados local (SQLite) para uma infraestrutura 100% em nuvem.

2. Arquitetura e Tecnologias
O projeto utiliza a "Stack" moderna de desenvolvimento web:

Backend: Node.js com Framework Express.

Banco de Dados: PostgreSQL hospedado no Supabase (Banco de dados relacional em nuvem).

Frontend: HTML5, CSS3 (com foco em UI/UX responsivo) e JavaScript Vanilla.

Hospedagem: Render (Plataforma como Serviço - PaaS).

Persistência de Imagens: Sistema de upload via Multer com armazenamento local/nuvem.

3. Principais Funcionalidades
Autenticação Segura: Sistema de login diferenciado para Administrador e Professor, utilizando variáveis de ambiente (dotenv).

Gestão de Fornecedores: Cadastro completo com validação de CNPJ único.

Controle de Estoque Inteligente: * Cálculo automático de Preço Médio em novas entradas.

Abatimento automático de quantidades em saídas.

Validação de estoque insuficiente.

Histórico de Movimentações: Registro automático de todas as operações de "Entrada" e "Saída".

Exportação de Dados: Funcionalidade de exportação da tabela de produtos para Excel.

4. Diferenciais Técnicos (O que explicar ao Professor)
Segurança de Dados: O uso de .env garante que senhas de banco de dados e credenciais de acesso nunca fiquem expostas no código-fonte (GitHub).

Escalabilidade: Ao utilizar o PostgreSQL no Supabase, o sistema está pronto para suportar múltiplos acessos simultâneos sem perda de integridade.

Deploy Contínuo: Configuração de Continuous Deployment via GitHub/Render, onde cada atualização no código é refletida automaticamente no site oficial.

Dica para a sua fala na apresentação:
"Professor, o destaque deste projeto foi a migração para uma arquitetura em nuvem. Saímos do SQLite local para o PostgreSQL no Supabase, o que garante que os dados estejam seguros e acessíveis de qualquer lugar através do link hospedado no Render."