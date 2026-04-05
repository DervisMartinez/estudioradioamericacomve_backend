require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const port = process.env.PORT || 3005;

// Preparar carpeta de subidas de archivos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
try { fs.chmodSync(uploadsDir, 0o777); } catch(e) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')); }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors()); // Permite que React (localhost:5173) se conecte sin errores
app.use(express.json({ limit: '500mb' })); // Límite masivo para Base64 y videos
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Escudo global: Evita que Node.js colapse con payloads muy pesados
app.use((err, req, res, next) => {
  console.error("🔥 Error de Express o JSON:", err.message);
  res.status(400).json({ error: "Error procesando petición", details: err.message });
});

// Inicializar las tablas de la BD (viene de tu db.js)
initDB();

// ==========================================
// RUTA PARA SUBIR ARCHIVOS (FOTOS/VIDEOS)
// ==========================================
app.post('/api/upload', (req, res) => {
  try {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: `Error de Multer: ${err.message}` });
      if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });
      res.json({ url: `/uploads/${req.file.filename}` });
    });
  } catch (error) {
    console.error("❌ Error en el try-catch de subida:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA EPISODIOS (VIDEOS)
// ==========================================
app.get('/api/videos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM videos ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error("❌ Error GET videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/videos', async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    await pool.query(
      `INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url, duration, views || 0, createdAt, programId || null, releaseDate || null, pressNoteUrl || null]
    );
    res.status(201).json({ message: 'Video creado con éxito' });
  } catch (error) {
    console.error("❌ Error POST videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    await pool.query(
      `UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, url=?, duration=?, programId=?, releaseDate=?, pressNoteUrl=? WHERE id=?`,
      [title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url, duration, programId || null, releaseDate || null, pressNoteUrl || null, req.params.id]
    );
    res.json({ message: 'Video actualizado' });
  } catch (error) {
    console.error("❌ Error PUT videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id=?', [req.params.id]);
    res.json({ message: 'Video eliminado' });
  } catch (error) {
    console.error("❌ Error DELETE videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/videos/:id/view', async (req, res) => {
  try {
    await pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vista sumada' });
  } catch (error) {
    console.error("❌ Error VISTAS videos:", error.message);
    res.status(400).json({ error: error.message });
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
    console.error(" Error GET programs:", error.message);
    res.status(400).json({ error: error.message });
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
    console.error(" Error POST programs:", error.message);
    res.status(400).json({ error: error.message });
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
    console.error(" Error PUT programs:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/programs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ message: 'Programa eliminado' });
  } catch (error) {
    console.error(" Error DELETE programs:", error.message);
    res.status(400).json({ error: error.message });
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
    console.error("❌ Error GET profile:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/profile', async (req, res) => {
  const { firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook } = req.body;
  try {
    await pool.query(
      `UPDATE user_profile SET firstName=?, lastName=?, avatar=?, bio=?, twitter=?, instagram=?, youtube=?, facebook=? WHERE id=1`,
      [firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook]
    );
    res.json({ message: 'Perfil actualizado' });
  } catch (error) {
    console.error("❌ Error PUT profile:", error.message);
    res.status(400).json({ error: error.message });
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
    console.error("❌ Error SUSCRIPCIÓN:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(` Servidor backend corriendo en http://localhost:${port}`);
});