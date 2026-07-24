require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool, initDB } = require('./db');
const { sendWelcomeNewsletter, sendNewVideoNotification } = require('./utils/services/mailer');
const { processVideoToHLS } = require('./utils/hlsProcessor');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'radio_america_super_secure_key_2026';
const app = express();
const port = process.env.PORT || 3005;

// Preparar carpeta de subidas de archivos
const uploadsDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
try { fs.chmodSync(uploadsDir, 0o777); } catch(e) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { 
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    console.log("📂 [Multer] Guardando archivo internamente en:", uploadsDir);
    cb(null, uploadsDir); 
  },
  filename: function (req, file, cb) { 
    // 🛑 SOLUCIÓN ENOENT: Destruimos el nombre original del archivo para evitar 
    // que rutas falsas de Windows (C:\fakepath...) rompan el disco de Linux.
    let ext = '.bin';
    if (file.mimetype.startsWith('audio/')) ext = '.mp3';
    else if (file.mimetype.startsWith('video/')) ext = '.mp4';
    else if (file.mimetype.startsWith('image/')) ext = '.jpg';
    
    const finalName = Date.now() + '-radioamerica' + Math.round(Math.random() * 1000) + ext;
    console.log(" [Multer] Nombre generado para guardar:", finalName);
    cb(null, finalName);
  }
});
const upload = multer({ storage: storage });

// Middlewares
app.use(cors()); // Permite que React (localhost:5173) se conecte sin errores
app.use(express.json({ limit: '500mb' })); // Límite masivo para Base64 y videos
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// ==========================================
// Escudo Anti-Caché Global para la API
// ==========================================
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Escudo global: Evita que Node.js colapse con payloads muy pesados
app.use((err, req, res, next) => {
  console.error("🔥 Error de Express o JSON:", err.message);
  res.status(400).json({ error: "Error procesando petición", details: err.message });
});

// Inicializar las tablas de la BD (viene de tu db.js)
initDB();

// Middleware de Autenticación
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado. Token faltante.' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// ==========================================
// RUTAS DE AUTENTICACIÓN (LOGIN / REGISTRO)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (error) {
    console.error(" Error en login:", error.message);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/register', authMiddleware, async (req, res) => {
  if (req.user.role === 'producer') {
    return res.status(403).json({ error: 'Los productores no pueden crear usuarios' });
  }
  const { email, password, role, name } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)', [email, hash, role || 'admin', name || '']);
    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (error) {
    console.error(" Error en registro:", error.message);
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El email ya existe' });
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, role, name, createdAt FROM users ORDER BY createdAt DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role === 'producer') {
    return res.status(403).json({ error: 'Los productores no pueden borrar usuarios' });
  }
  try {
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (user.length > 0 && user[0].email === 'estudio@radioamerica.com.ve') {
       return res.status(403).json({ error: 'No se puede eliminar al superadministrador principal' });
    }
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTA PARA SUBIR ARCHIVOS (FOTOS/VIDEOS)
// ==========================================
app.post('/api/upload', (req, res) => {
  try {
    console.log("📥 [API] Petición de subida recibida. Analizando archivo...");
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error("🔥 Error crítico de Multer:", err);
        if (err.message.includes('ENOENT')) {
          return res.status(400).json({ error: 'Conexión cortada abruptamente. Tu servidor principal (VPS/Plesk) bloqueó el peso del video.' });
        }
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
        
        // Respondemos inmediatamente al cliente para que no se quede colgado
        res.json({ url: finalUrl, processing: true });
        
        // Iniciamos el procesamiento en background
        setTimeout(async () => {
          try {
            const hlsUrl = await processVideoToHLS(finalPath, uploadsDir, hlsFolderId);
            if (hlsUrl) {
              // Buscar en la bd el video que tenga finalUrl y actualizarlo
              await pool.query('UPDATE videos SET url = ? WHERE url = ?', [hlsUrl, finalUrl]);
              console.log(`✅ Base de datos actualizada silenciosamente para el video: ${finalUrl} -> ${hlsUrl}`);
            }
          } catch (e) {
            console.error("🔥 Error ejecutando HLS en background:", e);
          }
        }, 100);
        return;
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
  const { id, name, url, programId, type, assignedEntities } = req.body;
  try {
    await pool.query(
      `INSERT INTO sponsors (id, name, url, programId, type, assignedEntities) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, url, programId || null, type || 'audio', assignedEntities ? JSON.stringify(assignedEntities) : null]
    );
    res.status(201).json({ message: 'Cuña creada con éxito' });
  } catch (error) {
    console.error(" Error POST sponsors:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/sponsors/:id', async (req, res) => {
  const { name, type, assignedEntities } = req.body;
  try {
    await pool.query(
      `UPDATE sponsors SET name=?, type=?, assignedEntities=? WHERE id=?`,
      [name, type || 'audio', assignedEntities ? JSON.stringify(assignedEntities) : null, req.params.id]
    );
    res.json({ message: 'Cuña actualizada' });
  } catch (error) {
    console.error("❌ Error PUT sponsors:", error.message);
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
    // Forzar a que no se guarde en caché nunca más (Evitar el HTTP 304)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const [rows] = await pool.query('SELECT * FROM videos ORDER BY createdAt DESC');
    
    // Convertimos los 0 y 1 de MySQL a Booleanos (false/true) para que React marque las casillas sin fallos
    const formatted = rows.map(v => ({
      ...v,
      isFeatured: !!v.isFeatured,
      isShort: !!v.isShort,
      isAudio: !!v.isAudio,
      isLive: !!v.isLive
    }));
    res.json(formatted);
  } catch (error) {
    console.error("❌ Error GET videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/videos', async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl, sendNewsletter } = req.body;
  
  console.log("📦 [POST] Payload completo recibido:", req.body);
  // Normalizador a prueba de balas para atrapar "true", true, "1", 1 y "on"
  const parseBool = (val) => (val === true || String(val).toLowerCase() === 'true' || val === 1 || String(val) === '1' || val === 'on') ? 1 : 0;

  try {
    await pool.query(
      `INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, thumbnail, description, parseBool(isFeatured), parseBool(isShort), parseBool(isAudio), parseBool(isLive), url, duration, views || 0, createdAt, programId || null, releaseDate || null, pressNoteUrl || null]
    );
    res.status(201).json({ message: 'Video creado con éxito' });

    // Disparamos el correo en background si fue solicitado
    if (sendNewsletter) {
      try {
        const [subs] = await pool.query('SELECT email FROM subscribers');
        const emails = subs.map(s => s.email);
        if (emails.length > 0) {
          sendNewVideoNotification(emails, req.body).catch(e => console.error("Error en envío silencioso:", e));
        }
      } catch(e) { console.error("Error obteniendo suscriptores para el newsletter:", e); }
    }
  } catch (error) {
    console.error("❌ Error POST videos:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, programId, releaseDate, pressNoteUrl } = req.body;
  
  console.log("📦 [PUT] Payload completo recibido:", req.body);
  const parseBool = (val) => (val === true || String(val).toLowerCase() === 'true' || val === 1 || String(val) === '1' || val === 'on') ? 1 : 0;
  console.log(`[PUT] Actualizando video ${req.params.id} | isLive recibido:`, isLive, '-> Guardado como:', parseBool(isLive));
  
  try {
    await pool.query(
      `UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, isLive=?, url=?, duration=?, programId=?, releaseDate=?, pressNoteUrl=? WHERE id=?`,
      [title, category, thumbnail, description, parseBool(isFeatured), parseBool(isShort), parseBool(isAudio), parseBool(isLive), url, duration, programId || null, releaseDate || null, pressNoteUrl || null, req.params.id]
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
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query('SELECT * FROM user_profile WHERE userId = ?', [userId]);
    if (rows.length > 0) res.json(rows[0]);
    else res.status(404).json({ error: 'Perfil no encontrado' });
  } catch (error) {
    console.error("❌ Error GET profile:", error.message);
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
  const { firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook } = req.body;
  const userId = req.user.id;
  try {
    const [existing] = await pool.query('SELECT * FROM user_profile WHERE userId = ?', [userId]);
    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO user_profile (userId, firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook]
      );
    } else {
      await pool.query(
        `UPDATE user_profile SET firstName=?, lastName=?, avatar=?, bio=?, twitter=?, instagram=?, youtube=?, facebook=? WHERE userId=?`,
        [firstName, lastName, avatar, bio, twitter, instagram, youtube, facebook, userId]
      );
    }
    res.json({ message: 'Perfil actualizado' });
  } catch (error) {
    console.error("❌ Error PUT profile:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// RUTAS PARA NEWSLETTER (SUSCRIPCIONES)
// ==========================================
app.get('/api/subscribers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM subscribers ORDER BY subscribedAt DESC');
    res.json(rows);
  } catch (error) {
    console.error("❌ Error GET subscribers:", error.message);
    res.status(400).json({ error: error.message });
  }
});

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