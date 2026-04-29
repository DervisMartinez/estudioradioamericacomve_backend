require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool, initDB } = require('./db');
const { sendWelcomeNewsletter } = require('./utils/services/mailer');
const { processVideoToHLS } = require('./utils/hlsProcessor');

const app = express();
const port = process.env.PORT || 3005;

// Preparar carpeta de subidas de archivos
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
try { fs.chmodSync(uploadsDir, 0o777); } catch(e) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { 
    console.log(" [Multer] Verificando directorio destino:", uploadsDir);
    if (!fs.existsSync(uploadsDir)) {
      console.log(" [Multer] La carpeta no existía, intentando crearla en este instante...");
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir); 
  },
  filename: function (req, file, cb) { 
    // Deducir extensión segura en caso de que el archivo original no la tenga
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext.length > 5) {
      if (file.mimetype.startsWith('audio/')) ext = '.mp3';
      else if (file.mimetype.startsWith('video/')) ext = '.mp4';
      else if (file.mimetype.startsWith('image/')) ext = '.jpg';
      else ext = '.bin';
    }
    const finalName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    console.log("📄 [Multer] Nombre generado para guardar:", finalName);
    cb(null, finalName);
  }
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
    console.log("📥 [API] Petición de subida recibida. Analizando archivo...");
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error("🔥 Error crítico de Multer:", err);
        return res.status(400).json({ error: `Error de Multer: ${err.message}` });
      }
      if (!req.file) {
        console.error("🔥 No se recibió ningún archivo en req.file");
        return res.status(400).json({ error: 'No se subió archivo' });
      }

      let finalUrl = `/uploads/${req.file.filename}`;
      let finalPath = req.file.path;

      const fileName = req.file.filename;
      // Si es un video mp4, lo picamos y encriptamos con HLS
      if (req.file.mimetype.startsWith('video/') && fileName.endsWith('.mp4')) {
        const hlsFolderId = fileName.split('.')[0]; // Usamos el timestamp como nombre de carpeta
        const hlsUrl = processVideoToHLS(finalPath, uploadsDir, hlsFolderId);
        return res.json({ url: hlsUrl });
      }

      res.json({ url: finalUrl });
    });
  } catch (error) {
    console.error("❌ Error en el try-catch de subida:", error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA CUÑAS (SPONSORS)
// ==========================================
app.get('/api/sponsors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sponsors ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    console.error(" Error GET sponsors:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/sponsors', async (req, res) => {
  const { id, name, url, programId } = req.body;
  try {
    await pool.query(
      `INSERT INTO sponsors (id, name, url, programId) VALUES (?, ?, ?, ?)`,
      [id, name, url, programId || null]
    );
    res.status(201).json({ message: 'Cuña creada con éxito' });
  } catch (error) {
    console.error(" Error POST sponsors:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/sponsors/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sponsors WHERE id=?', [req.params.id]);
    res.json({ message: 'Cuña eliminada' });
  } catch (error) {
    console.error("❌ Error DELETE sponsors:", error.message);
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
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    await pool.query(
      `INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, isLive ? 1 : 0, url, duration, views || 0, createdAt, programId || null, releaseDate || null, pressNoteUrl || null]
    );
    res.status(201).json({ message: 'Video creado con éxito' });
  } catch (error) {
    console.error("❌ Error POST videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    await pool.query(
      `UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, isLive=?, url=?, duration=?, programId=?, releaseDate=?, pressNoteUrl=? WHERE id=?`,
      [title, category, thumbnail, description, isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, isLive ? 1 : 0, url, duration, programId || null, releaseDate || null, pressNoteUrl || null, req.params.id]
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
    
    // Extraer el contenido destacado para armar el correo
    const [featuredVideos] = await pool.query('SELECT * FROM videos WHERE isFeatured = 1 LIMIT 2');
    const [newPrograms] = await pool.query('SELECT * FROM programs LIMIT 3');

    // Enviar el correo usando Nodemailer
    await sendWelcomeNewsletter(email, featuredVideos, newPrograms);

    res.status(201).json({ success: true, message: 'Suscripción exitosa' });
  } catch (error) {
    // Evitar error si el correo ya existe
    if (error.code === 'ER_DUP_ENTRY') return res.status(200).json({ message: 'El usuario ya estaba suscrito.' });
    console.error("❌ Error SUSCRIPCIÓN:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// RUTA PARA EL BUSCADOR
// ==========================================
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json({ videos: [], programs: [] });
  
  try {
    const searchTerm = `%${query}%`;
    
    const [videos] = await pool.query(
      'SELECT * FROM videos WHERE title LIKE ? OR description LIKE ? OR category LIKE ? LIMIT 10',
      [searchTerm, searchTerm, searchTerm]
    );
    
    const [programs] = await pool.query(
      'SELECT * FROM programs WHERE name LIKE ? OR description LIKE ? OR category LIKE ? LIMIT 5',
      [searchTerm, searchTerm, searchTerm]
    );
    
    res.json({ videos, programs });
  } catch (error) {
    console.error("❌ Error BÚSQUEDA:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(` Servidor backend corriendo en http://localhost:${port}`);
});