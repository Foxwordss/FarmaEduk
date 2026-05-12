import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  atualizarMedicamento,
  cadastrarMedicamento,
  inativarMedicamento,
  listarMedicamentos,
} from './controllers/medicamentoController.js';
import { autenticar, exigirProfessor, listarAlunos, login } from './controllers/authController.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..', '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/css', express.static(path.join(frontendRoot, 'css')));
app.use('/js', express.static(path.join(frontendRoot, 'js')));
app.use('/html', express.static(path.join(frontendRoot, 'html')));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'login.html'));
});

app.get('/login', (req, res) => {
  res.redirect('/');
});

app.get('/login-admin', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'login-admin.html'));
});

app.get('/login-aluno', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'login-aluno.html'));
});

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'cadastro.html'));
});

app.get('/medicamentos', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'medicamentos.html'));
});

app.get('/filtros', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'html', 'filtros.html'));
});

app.use('/api', authRoutes);
app.post('/auth/login', login);
app.get('/api/alunos', autenticar, exigirProfessor, listarAlunos);

// Rotas de medicamentos
app.post('/api/medicamentos', cadastrarMedicamento);
app.post('/api/medicamento', cadastrarMedicamento);
app.post('/api/medicacoes', autenticar, exigirProfessor, cadastrarMedicamento);
app.post('/medicacoes', autenticar, exigirProfessor, cadastrarMedicamento);
app.get('/api/medicamentos', listarMedicamentos);
app.get('/api/medicamento', listarMedicamentos);
app.get('/api/medicacoes', autenticar, listarMedicamentos);
app.get('/medicacoes', autenticar, listarMedicamentos);
app.put('/api/medicamentos/:id', atualizarMedicamento);
app.patch('/api/medicamentos/:id/inativar', inativarMedicamento);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
