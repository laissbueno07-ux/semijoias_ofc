// ---------------------------------------------------------------
// LUME — servidor (COMPLETO COM FRETE E E-MAIL)
// ---------------------------------------------------------------

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const nodemailer = require("nodemailer");
const { readDB, writeDB } = require("./lib/db");
const { hashPassword, verifyPassword } = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "troque-este-segredo",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);
app.use(express.static(path.join(__dirname)));

// ============================================================
// MIDDLEWARE DE AUTENTICAÇÃO
// ============================================================
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }
  return res.status(401).json({ error: "Você precisa entrar na sua conta." });
}

// ============================================================
// CONFIGURAÇÃO DE E-MAIL
// ============================================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============================================================
// FUNÇÕES DE E-MAIL
// ============================================================

async function enviarEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Lume" <contato@lume.com.br>',
      to: to,
      subject: subject,
      html: html,
    });
    console.log("📧 E-mail enviado:", info.messageId);
    return { success: true };
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error.message);
    return { success: false, error: error.message };
  }
}

async function enviarEmailConfirmacao(user, order) {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center">${item.qty}x</td>
      <td style="text-align:right">R$ ${(item.price * item.qty).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head><style>
        body { font-family: Arial; max-width: 600px; margin: 0 auto; }
        .header { background: #722F37; padding: 20px; text-align: center; }
        .header h1 { color: #C9A96E; margin: 0; }
        .content { padding: 20px; background: #FAF8F5; }
        .order { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; border-bottom: 2px solid #C9A96E; padding: 8px; }
        td { padding: 8px; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; color: #722F37; text-align: right; padding-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
      </style></head>
      <body>
        <div class="header">
          <h1>✨ Lume</h1>
          <p style="color: white;">Semijoias que encantam</p>
        </div>
        <div class="content">
          <h2>Olá, ${user.name}! 🎉</h2>
          <p>Seu pedido foi confirmado!</p>
          <div class="order">
            <p><strong>Pedido:</strong> ${order.id}</p>
            <p><strong>Data:</strong> ${new Date(order.createdAt).toLocaleString('pt-BR')}</p>
            <table>
              <thead><tr><th>Produto</th><th>Qtd</th><th>Subtotal</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot><tr><td colspan="3" class="total">Total: R$ ${order.total.toFixed(2)}</td></tr></tfoot>
            </table>
          </div>
          <p style="font-style:italic;color:#888;">Este é um ambiente de demonstração acadêmica.</p>
        </div>
        <div class="footer">
          <p>© 2026 Lume. Todos os direitos reservados.</p>
        </div>
      </body>
    </html>
  `;

  return await enviarEmail(user.email, `✅ Pedido confirmado - Lume #${order.id}`, html);
}

async function enviarEmailBoasVindas(user) {
  const html = `
    <html>
      <head><style>
        body { font-family: Arial; max-width: 600px; margin: 0 auto; }
        .header { background: #722F37; padding: 20px; text-align: center; }
        .header h1 { color: #C9A96E; margin: 0; }
        .content { padding: 20px; background: #FAF8F5; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
      </style></head>
      <body>
        <div class="header">
          <h1>✨ Lume</h1>
          <p style="color: white;">Semijoias que encantam</p>
        </div>
        <div class="content">
          <h2>Bem-vindo(a) à Lume, ${user.name}! 🎉</h2>
          <p>Seu cadastro foi realizado com sucesso.</p>
          <p><strong>E-mail:</strong> ${user.email}</p>
          <p>Agora você pode favoritar suas peças e acompanhar seus pedidos.</p>
          <p><a href="http://localhost:${PORT}" style="color:#C9A96E;">Visite nossa loja →</a></p>
        </div>
        <div class="footer">
          <p>© 2026 Lume. Todos os direitos reservados.</p>
        </div>
      </body>
    </html>
  `;
  return await enviarEmail(user.email, "🎉 Bem-vindo(a) à Lume!", html);
}

// ============================================================
// ROTAS DE AUTENTICAÇÃO
// ============================================================

// Cadastro (com e-mail)
app.post("/api/cadastro", async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Preencha todos os campos." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Senha precisa ter 6+ caracteres." });
  }

  const db = readDB();
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }

  const user = {
    id: "user_" + Date.now(),
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);

  // Envia e-mail de boas-vindas
  await enviarEmailBoasVindas(user);

  req.session.userId = user.id;
  req.session.save(() => {
    res.json({ id: user.id, name: user.name, email: user.email });
  });
});

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());

  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }

  req.session.userId = user.id;
  req.session.save(() => {
    res.json({ id: user.id, name: user.name, email: user.email });
  });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Verificar sessão
app.get("/api/me", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }
  const db = readDB();
  const user = db.users.find((u) => u.id === req.session.userId);
  if (!user) {
    req.session.destroy();
    return res.json({ user: null });
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

// ============================================================
// ROTA DE RECUPERAÇÃO DE SENHA
// ============================================================

const resetTokens = {};

app.post("/api/esqueci-senha", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Informe seu e-mail." });
  }

  const db = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.json({ 
      success: true, 
      message: "Se o e-mail existir, enviaremos as instruções." 
    });
  }

  const token = "reset_" + Date.now() + "_" + Math.random().toString(36).substring(7);
  resetTokens[token] = { userId: user.id, expiresAt: Date.now() + 3600000 };

  const resetLink = `http://localhost:${PORT}/resetar-senha.html?token=${token}`;
  const html = `
    <html>
      <head><style>
        body { font-family: Arial; max-width: 600px; margin: 0 auto; }
        .header { background: #722F37; padding: 20px; text-align: center; }
        .header h1 { color: #C9A96E; margin: 0; }
        .content { padding: 20px; background: #FAF8F5; }
        .btn { display: inline-block; padding: 12px 30px; background: #C9A96E; color: white; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
      </style></head>
      <body>
        <div class="header"><h1>✨ Lume</h1></div>
        <div class="content">
          <h2>Olá, ${user.name}!</h2>
          <p>Clique no botão para redefinir sua senha:</p>
          <p style="text-align:center;margin:30px 0;">
            <a href="${resetLink}" class="btn">Redefinir Senha</a>
          </p>
          <p style="font-size:12px;color:#888;">Link válido por 1 hora.</p>
        </div>
        <div class="footer"><p>© 2026 Lume</p></div>
      </body>
    </html>
  `;

  await enviarEmail(user.email, "🔐 Recuperação de Senha", html);

  res.json({ success: true, message: "E-mail de recuperação enviado!" });
});

app.post("/api/redefinir-senha", (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Senha precisa ter 6+ caracteres." });
  }

  const data = resetTokens[token];
  if (!data || Date.now() > data.expiresAt) {
    return res.status(400).json({ error: "Token inválido ou expirado." });
  }

  const db = readDB();
  const user = db.users.find((u) => u.id === data.userId);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  user.passwordHash = hashPassword(newPassword);
  writeDB(db);
  delete resetTokens[token];

  res.json({ success: true, message: "Senha redefinida com sucesso!" });
});

// ============================================================
// ROTA DE FRETE
// ============================================================

app.post("/api/calcular-frete", async (req, res) => {
  try {
    const { cep, items } = req.body;
    
    if (!cep) {
      return res.status(400).json({ error: "CEP é obrigatório." });
    }

    const cepLimpo = cep.replace(/\D/g, '');
    
    if (cepLimpo.length !== 8) {
      return res.status(400).json({ error: "CEP deve ter 8 dígitos." });
    }

    // Simulação de frete baseada no CEP
    const primeiroDigito = parseInt(cepLimpo[0]);
    let prazo, valor;

    if (primeiroDigito === 0 || primeiroDigito === 1) {
      prazo = 3;
      valor = 15.90;
    } else if (primeiroDigito === 2) {
      prazo = 2;
      valor = 12.90;
    } else if (primeiroDigito === 3 || primeiroDigito === 4) {
      prazo = 4;
      valor = 18.90;
    } else if (primeiroDigito === 5 || primeiroDigito === 6) {
      prazo = 5;
      valor = 22.90;
    } else {
      prazo = 7;
      valor = 29.90;
    }

    res.json({
      success: true,
      frete: {
        cep: cepLimpo,
        prazo: prazo,
        valor: valor,
        servico: "PAC",
        valorTotal: valor
      }
    });
    
  } catch (error) {
    console.error("❌ Erro ao calcular frete:", error);
    res.status(400).json({ error: "Erro ao calcular frete." });
  }
});

// ============================================================
// ROTA DE PAGAMENTO (SIMULAÇÃO)
// ============================================================

app.post("/api/simular-pagamento", async (req, res) => {
  try {
    const { metodo, dadosPagamento, items } = req.body;
    
    const aprovado = Math.random() > 0.1;
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!aprovado) {
      return res.status(400).json({ 
        success: false, 
        error: "Pagamento recusado. Tente outro cartão." 
      });
    }

    const transacaoId = "trans_" + Date.now() + "_" + Math.random().toString(36).substring(7);

    res.json({
      success: true,
      transacaoId,
      mensagem: "Pagamento aprovado!",
      metodo: metodo || "Cartão",
      data: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Erro no pagamento:", error);
    res.status(500).json({ error: "Erro ao processar pagamento." });
  }
});

// ============================================================
// ROTA DE PEDIDO (COM FRETE E E-MAIL)
// ============================================================

app.post("/api/criar-pedido", requireLogin, async (req, res) => {
  try {
    const { items, totalComFrete, frete } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Carrinho vazio." });
    }

    const db = readDB();
    const orderId = "ord_" + Date.now();
    
    const order = {
      id: orderId,
      userId: req.userId,
      items: items,
      total: totalComFrete || items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0),
      frete: frete || 0,
      status: "aprovado",
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    writeDB(db);

    const user = db.users.find((u) => u.id === req.userId);

    if (user) {
      await enviarEmailConfirmacao(user, order);
    }

    res.json({ 
      success: true, 
      orderId,
      message: "Pedido realizado! E-mail de confirmação enviado." 
    });
    
  } catch (err) {
    console.error("❌ Erro ao criar pedido:", err);
    res.status(500).json({ error: "Erro ao criar pedido." });
  }
});

app.get("/api/pedidos", requireLogin, (req, res) => {
  const db = readDB();
  const pedidos = db.orders
    .filter((o) => o.userId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ pedidos });
});

// ============================================================
// ROTAS DE FAVORITOS
// ============================================================

app.get("/api/favoritos", requireLogin, (req, res) => {
  const db = readDB();
  const favoritos = db.favorites
    .filter((f) => f.userId === req.userId)
    .map((f) => f.productId);
  res.json({ favoritos });
});

app.post("/api/favoritos/:id", requireLogin, (req, res) => {
  const db = readDB();
  const idx = db.favorites.findIndex(
    (f) => f.userId === req.userId && f.productId === req.params.id
  );

  let favorited;
  if (idx >= 0) {
    db.favorites.splice(idx, 1);
    favorited = false;
  } else {
    db.favorites.push({ userId: req.userId, productId: req.params.id });
    favorited = true;
  }
  writeDB(db);
  res.json({ favorited });
});

// ============================================================
// INICIA O SERVIDOR
// ============================================================

app.listen(PORT, () => {
  console.log(`✨ Lume rodando em http://localhost:${PORT}`);
  console.log(`\n📧 E-mail configurado com:`);
  console.log(`   Host: ${process.env.EMAIL_HOST || 'não configurado'}`);
  console.log(`   User: ${process.env.EMAIL_USER || 'não configurado'}`);
  console.log(`\n💡 Para testar e-mails, acesse: https://ethereal.email/`);
});