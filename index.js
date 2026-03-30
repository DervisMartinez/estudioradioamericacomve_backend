require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initDB } = require('./db');

const app = express();
const port = process.env.PORT || 3306;

// Middlewares
app.use(cors()); // Permite que React (localhost:5173) se conecte sin errores
app.use(express.json({ limit: '50mb' })); // Aumentamos el límite a 50mb para soportar imágenes
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Inicializar las tablas de la BD (viene de tu db.js)
initDB();

// ==========================================
// RUTAS PARA EPISODIOS (VIDEOS)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM videos ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos', async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId } = req.body;
  try {
    await pool.query(
      `INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url, duration, views || 0, createdAt, programId || null]
    );
    res.status(201).json({ message: 'Video creado con éxito' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, programId } = req.body;
  try {
    await pool.query(
      `UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, url=?, duration=?, programId=? WHERE id=?`,
      [title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url, duration, programId || null, req.params.id]
    );
    res.json({ message: 'Video actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id=?', [req.params.id]);
    res.json({ message: 'Video eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos/:id/view', async (req, res) => {
  try {
    await pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vista sumada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA PROGRAMAS
// ==========================================
app.get('/api/programs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM programs');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/programs', async (req, res) => {
  const { id, name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await pool.query(
      `INSERT INTO programs (id, name, category, thumbnail, type, description, schedule, host, coverImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, thumbnail, type, description, schedule, host, coverImage]
    );
    res.status(201).json({ message: 'Programa creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/programs/:id', async (req, res) => {
  const { name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await pool.query(
      `UPDATE programs SET name=?, category=?, thumbnail=?, type=?, description=?, schedule=?, host=?, coverImage=? WHERE id=?`,
      [name, category, thumbnail, type, description, schedule, host, coverImage, req.params.id]
    );
    res.json({ message: 'Programa actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/programs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ message: 'Programa eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA PERFIL
// ==========================================
app.get('/api/profile', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_profile WHERE id = 1');
    if (rows.length > 0) res.json(rows[0]);
    else res.status(404).json({ error: 'Perfil no encontrado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profile', async (req, res) => {
  const { firstName, lastName, avatar, bio, twitter, instagram } = req.body;
  try {
    await pool.query(
      `UPDATE user_profile SET firstName=?, lastName=?, avatar=?, bio=?, twitter=?, instagram=? WHERE id=1`,
      [firstName, lastName, avatar, bio, twitter, instagram]
    );
    res.json({ message: 'Perfil actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA NEWSLETTER (SUSCRIPCIONES)
// ==========================================
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El email es requerido' });
  try {
    await pool.query('INSERT INTO subscribers (email) VALUES (?)', [email]);
    res.status(201).json({ success: true, message: 'Suscripción exitosa' });
  } catch (error) {
    // Evitar error si el correo ya existe
    if (error.code === 'ER_DUP_ENTRY') return res.status(200).json({ message: 'El usuario ya estaba suscrito.' });
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});