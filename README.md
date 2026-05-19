# Databricks Proxy — Deploy no Render

Proxy Node.js que permite ao BizOps EI chamar a API do Databricks sem erro de CORS.

## Deploy (5 minutos)

### 1. Criar repositório no GitHub
1. Acesse https://github.com/new
2. Nome: `databricks-proxy`
3. Visibilidade: **Private**
4. Clique **Create repository**

### 2. Fazer upload dos arquivos
Na página do repositório novo, clique **uploading an existing file** e arraste:
- `index.js`
- `package.json`
- `render.yaml`

Clique **Commit changes**.

### 3. Deploy no Render
1. Acesse https://render.com e faça login (pode usar conta Google)
2. Clique **New → Web Service**
3. Conecte sua conta GitHub e selecione o repo `databricks-proxy`
4. Render vai detectar o `render.yaml` automaticamente
5. Clique **Create Web Service**
6. Aguarde ~2 minutos para o deploy
7. Copie a URL gerada: `https://databricks-proxy-XXXXX.onrender.com`

### 4. Atualizar no BizOps
No app BizOps → Setup → Settings → Databricks Connection:
- **Proxy URL**: cole a URL do Render acima

## ⚠️ Importante sobre o plano Free do Render
O serviço "hiberna" após 15 min sem uso — a primeira requisição pode demorar ~30s para acordar.
Para evitar isso, use o **Render Cron Job** (gratuito) para fazer ping a cada 10 min,
ou atualize para o plano Starter ($7/mês) para uptime contínuo.
