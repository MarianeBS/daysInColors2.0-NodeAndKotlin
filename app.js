const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require("firebase-admin/firestore");
const exphbs = require("express-handlebars");
const path = require('path');

const serviceAccount = require('./daysincolorsid.json');

// Inicialização do Firebase Admin
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const app = express();


// Configuração para servir arquivos estáticos da pasta raiz
app.use('/img', express.static(__dirname + '/img'));


// Configurações do Express
app.set('views', path.join(__dirname, 'views'));

// Configuração do motor de visualização (Handlebars)
app.engine("handlebars", exphbs.create({ defaultLayout: "main" }).engine);
app.set("view engine", "handlebars");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuração do gerenciador de sessões
app.use(session({
    secret: 'seuSegredoAqui',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Registra o helper 'eq' para comparar dois valores
exphbs.create({
    helpers: {
        eq: function (a, b) {
            return a === b;
        }
    }
});

// Inicialização do servidor
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`Servidor ativo na porta ${PORT}`);
});

// Middleware para verificar autenticação
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.redirect('/');
}

// ------------------------------------------------------
// Rotas Relacionada ao Paciente
// ------------------------------------------------------


// ------------------------------------------------------
// Rotas GET
// ------------------------------------------------------

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/homePaciente", isAuthenticated, (req, res) => {
    res.render("homePaciente", { userName: req.session.user.name });
});

app.get("/homePsi", isAuthenticated, (req, res) => {
    res.render("homePsi", { userName: req.session.user.name });
});

app.get("/index", (req, res) => {
    res.render("index");
});

app.get("/cadastroDays", isAuthenticated, (req, res) => {
    res.render("cadastrarDays");
});
app.get("/meus-diarios", isAuthenticated, async (req, res) => {
    const userId = req.session.user.uid;

    try {
        // Consultando os diários
        const diariesRef = db.collection("users").doc(userId).collection("diarios");
        const diariesSnapshot = await diariesRef.orderBy("data", "asc").get();

        // Consultando os feedbacks
        const feedbacksRef = db.collection("users").doc(userId).collection("feedbacks");
        const feedbacksSnapshot = await feedbacksRef.orderBy("data", "asc").get();

        if (diariesSnapshot.empty) {
            return res.render("consultarDays", {
                userName: req.session.user.name,
                diariossData: [],
                feedbacksData: [],
                message: "Você ainda não tem diários registrados."
            });
        }

        const diariossData = diariesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const feedbacksData = feedbacksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.render("consultarDays", {
            userName: req.session.user.name,
            diariossData: diariossData,
            feedbacksData: feedbacksData,
            message: null
        });
    } catch (error) {
        console.error("Erro ao buscar os diários ou feedbacks:", error);
        return res.status(500).send("Erro ao buscar os diários ou feedbacks. Tente novamente mais tarde.");
    }
});




app.get("/diariosDays", (req, res) => {
    res.render("consultarDays");
});

app.get("/cadastroUsuario", (req, res) => {
    res.render("cadastrarUsuario");
});

app.get('/editarDiario/:id', isAuthenticated, async (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.uid;

    try {
        const diaryRef = db.collection("users").doc(userId).collection("diarios").doc(diaryId);
        const doc = await diaryRef.get();

        if (!doc.exists) {
            return res.status(404).send("Diário não encontrado.");
        }

        const diaryData = doc.data();

        res.render('editarDays', {
            diaryId: doc.id,
            data: diaryData.data,
            cor: diaryData.cor,
            motivo: diaryData.motivo,
            avaliacao: diaryData.avaliacao
        });
    } catch (error) {
        console.error("Erro ao buscar o diário:", error.message);
        return res.status(500).send("Erro ao buscar o diário para edição: " + error.message);
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Erro ao encerrar a sessão.");
        }
        res.redirect('/');
    });
});

app.get("/perfilPaciente", isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const userDoc = await db.collection("users").doc(userId).get();

        if (!userDoc.exists) {
            console.error("Perfil não encontrado para o ID:", userId);
            return res.render("perfilPaciente", {
                errorMessage: "Perfil não encontrado. Tente novamente mais tarde.",
            });
        }

        const userData = userDoc.data();
        res.render("perfilPaciente", {
            userName: userData.name,
            email: userData.email,
            status: userData.status || "Indefinido",
        });
    } catch (error) {
        console.error("Erro ao buscar o perfil:", error.message);
        res.render("perfilPaciente", {
            errorMessage: "Erro ao carregar o perfil. Tente novamente mais tarde.",
        });
    }
});

// ------------------------------------------------------
// Rotas POST
// ------------------------------------------------------

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const fixedUser = "psicologo@example.com";
    const fixedPassword = "123";

    if (username === fixedUser && password === fixedPassword) {
        if (!req.session) {
            return res.status(500).send("Erro ao inicializar a sessão.");
        }

        req.session.user = { name: 'Psicólogo', email: username, role: 'psicologo' };  // Adiciona o tipo de usuário à sessão
        return res.status(200).json({ role: 'psicologo' });  // Envia a resposta indicando o tipo de usuário
    }

    try {
        const user = await getAuth().getUserByEmail(username);
        if (user) {
            if (!req.session) {
                return res.status(500).send("Erro ao inicializar a sessão.");
            }

            const userDoc = await db.collection("users").doc(user.uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();

                if (userData.status === 'Inativo') {
                    return res.status(403).send("Sua conta está inativa. Entre em contato com o suporte.");
                }

                req.session.user = {
                    uid: user.uid,
                    name: userData.name || user.displayName,
                    email: userData.email || user.email,
                    role: userData.role || 'paciente'  // Defina o papel como 'paciente' se não for especificado
                };

                return res.status(200).json({ role: req.session.user.role });  // Envia o papel do usuário
            } else {
                return res.status(404).send("Dados do usuário não encontrados no Firestore.");
            }
        } else {
            return res.status(401).send("Usuário não encontrado.");
        }
    } catch (error) {
        return res.status(500).send("Erro ao autenticar: " + error.message);
    }
});


app.post("/cadastroUser", async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const userRecord = await getAuth().createUser({
            email: email,
            password: password,
            displayName: name,
            status: "Ativo"
        });

        await db.collection("users").doc(userRecord.uid).set({
            name: name,
            email: email,
            status: "Ativo",
            createdAt: new Date(),
        });

        res.status(200).redirect("/index");
    } catch (error) {
        res.status(500).send("Erro ao criar conta: " + error.message);
    }
});

app.post("/cadastroDiario", isAuthenticated, async (req, res) => {
    const { data, cor, motivo, avaliacao } = req.body;

    if (!data || !cor || !motivo || !avaliacao) {
        return res.status(400).send("Todos os campos são obrigatórios.");
    }

    try {
        const userId = req.session.user.uid;
        const diaryRef = db.collection("users").doc(userId).collection("diarios");

        await diaryRef.add({
            data: data,
            cor: cor,
            motivo: motivo,
            avaliacao: parseInt(avaliacao, 10),
        });

        res.status(200).redirect("/meus-diarios");
    } catch (error) {
        res.status(500).send("Erro ao registrar o diário: " + error.message);
    }
});

app.post('/editarDiario/:id', isAuthenticated, async (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.uid;
    const { data, cor, motivo, avaliacao } = req.body;

    try {
        const diaryRef = db.collection("users").doc(userId).collection("diarios").doc(diaryId);
        await diaryRef.update({
            data: data,
            cor: cor,
            motivo: motivo,
            avaliacao: avaliacao
        });

        res.redirect('/meus-diarios');
    } catch (error) {
        console.error("Erro ao atualizar o diário:", error.message);
        return res.status(500).send("Erro ao atualizar o diário: " + error.message);
    }
});

app.post('/excluirDiario/:id', isAuthenticated, async (req, res) => {
    const diaryId = req.params.id;
    const userId = req.session.user.uid;

    try {
        const diaryRef = db.collection("users").doc(userId).collection("diarios").doc(diaryId);
        const doc = await diaryRef.get();
        if (!doc.exists) {
            return res.status(404).send("Diário não encontrado.");
        }

        await diaryRef.delete();
        res.redirect('/meus-diarios');
    } catch (error) {
        console.error("Erro ao excluir o diário:", error.message);
        return res.status(500).send("Erro ao excluir o diário: " + error.message);
    }
});

app.post('/perfilPaciente/edit', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;
        const { name, email } = req.body;

        await db.collection('users').doc(userId).update({
            name: name,
            email: email,
        });

        req.session.user.name = name;
        req.session.user.email = email;

        res.redirect('/perfilPaciente');
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.redirect('/perfilPaciente');
    }
});

app.post('/perfilPaciente/delete', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.uid;

        await db.collection('users').doc(userId).update({
            status: 'inativo',  
        });

        req.session.user.status = 'inativo';

        res.redirect('/perfilPaciente');
    } catch (error) {
        console.error('Erro ao desativar perfil:', error);
        res.redirect('/perfilPaciente');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Erro ao finalizar sessão.');
        }
        res.status(200).send('Sessão finalizada');
    });
});


// ------------------------------------------------------
// Rotas Relacionada ao Psicologo
// ------------------------------------------------------
app.get("/homePsi", (req, res) => {
    res.render("homePsi");
});

app.get("/consultarPaciente", (req, res) => {
    res.render("consultarPaciente");
});

app.get('/usuarios', async (req, res) => {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            return res.status(404).send("Nenhum usuário encontrado.");
        }

        const usersData = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            status: doc.data().status
        }));

        res.status(200).json(usersData);
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        return res.status(500).send("Erro ao buscar usuários. Tente novamente mais tarde.");
    }
});


app.get('/diariosPaciente/:id', async (req, res) => {
    const patientId = req.params.id;

    try {
        const patientRef = db.collection('users').doc(patientId);
        const patientDoc = await patientRef.get();

        if (!patientDoc.exists) {
            throw new Error('Paciente não encontrado');
        }

        const nomePaciente = patientDoc.data().name;

        const diariesRef = patientRef.collection('diarios');
        const diariesSnapshot = await diariesRef.orderBy('data', 'asc').get();
        const diariossData = diariesSnapshot.empty
            ? []
            : diariesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

        const feedbacksRef = patientRef.collection('feedbacks');
        const feedbacksSnapshot = await feedbacksRef.orderBy('createdAt', 'asc').get();
        const feedbacksData = feedbacksSnapshot.empty
            ? []
            : feedbacksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

        res.render('diariosPaciente', {
            nomePaciente: nomePaciente,
            diariossData: diariossData,
            feedbacksData: feedbacksData,  
            patientId: patientId  
        });
    } catch (error) {
        console.error("Erro ao buscar os diários ou feedbacks:", error);
        res.status(500).render('diariosPaciente', {
            userName: "Paciente",
            nomePaciente: "Nome do Paciente",
            diariossData: [],
            feedbacksData: [],
            message: "Erro ao buscar os diários ou feedbacks. Tente novamente mais tarde."
        });
    }
});


app.post('/adicionarFeedback/:id', async (req, res) => {
    const patientId = req.params.id;
    const { data, feedback, psicologoNome } = req.body;

    try {
        const patientRef = db.collection('users').doc(patientId);

        const feedbacksRef = patientRef.collection('feedbacks');

     
        await feedbacksRef.add({
            data: data,
            feedback: feedback,
            psicologo: psicologoNome,
            createdAt: new Date()  
        });

        res.redirect(`/diariosPaciente/${patientId}`);
    } catch (error) {
        console.error("Erro ao adicionar feedback:", error);
        res.status(500).send("Erro ao adicionar feedback. Tente novamente mais tarde.");
    }
});



// Rota para excluir feedback
app.post('/excluirFeedback/:patientId/:feedbackId', async (req, res) => {
    const { patientId, feedbackId } = req.params;

    try {
        const feedbackRef = db.collection('users').doc(patientId).collection('feedbacks').doc(feedbackId);
        await feedbackRef.delete();

        res.redirect(`/diariosPaciente/${patientId}`);
    } catch (error) {
        console.error("Erro ao excluir o feedback:", error);
        res.status(500).send("Erro ao excluir o feedback");
    }
});

// Rota para adicionar feedback
app.post('/adicionarFeedback/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const { data, feedback, psicologoNome } = req.body;

    try {
        const patientRef = db.collection('users').doc(patientId);
        const feedbacksRef = patientRef.collection('feedbacks');

        await feedbacksRef.add({
            data: data,
            feedback: feedback,
            psicologo: psicologoNome,
            createdAt: new Date()
        });

        res.redirect(`/diariosPaciente/${patientId}`);
    } catch (error) {
        console.error("Erro ao adicionar o feedback:", error);
        res.status(500).send("Erro ao adicionar o feedback. Tente novamente mais tarde.");
    }
});

// Rota para editar feedback
app.post('/editarFeedback/:patientId', async (req, res) => {
    const { patientId } = req.params;
    const { feedbackId, data, feedback, psicologoNome } = req.body;

    try {
        const feedbackRef = db.collection('users').doc(patientId).collection('feedbacks').doc(feedbackId);

        await feedbackRef.update({
            data: data,
            feedback: feedback,
            psicologo: psicologoNome,
            updatedAt: new Date()
        });

        res.redirect(`/diariosPaciente/${patientId}`);
    } catch (error) {
        console.error("Erro ao editar o feedback:", error);
        res.status(500).send("Erro ao editar o feedback. Tente novamente mais tarde.");
    }
});







