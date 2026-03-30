const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise'); // Usamos promise para soporte moderno async/await
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '200mb' })); // Límite alto para soportar Base64 de Audios/Videos
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Configuración de la conexión a MySQL
let db;

async function initDB() {
  try {
    db = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('✅ Conexión exitosa a MySQL (phpMyAdmin)');

    // 1. Crear Tabla de Programas
    await db.query(`
      CREATE TABLE IF NOT EXISTS programs (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        thumbnail LONGTEXT,
        type VARCHAR(50),
        description TEXT,
        schedule VARCHAR(100),
        host VARCHAR(100),
        coverImage LONGTEXT
      )
    `);

    // 2. Crear Tabla de Videos/Audios
    await db.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        thumbnail LONGTEXT,
        description TEXT,
        isFeatured TINYINT(1) DEFAULT 0,
        isShort TINYINT(1) DEFAULT 0,
        isAudio TINYINT(1) DEFAULT 0,
        url LONGTEXT,
        duration VARCHAR(20),
        views INT DEFAULT 0,
        createdAt VARCHAR(100),
        programId VARCHAR(100) NULL
      )
    `);

    // 3. Crear Tabla del Perfil de Usuario Administrador
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INT PRIMARY KEY DEFAULT 1,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        avatar LONGTEXT,
        bio TEXT,
        twitter VARCHAR(100),
        instagram VARCHAR(100)
      )
    `);

    // Insertar un perfil por defecto si la tabla está vacía
    const [profileRows] = await db.query('SELECT * FROM user_profile WHERE id = 1');
    if (profileRows.length === 0) {
      await db.query(`
        INSERT INTO user_profile (id, firstName, lastName, avatar, bio, twitter, instagram) 
        VALUES (1, 'Admin', 'Radio', '', 'Administrador del sistema', '@radio', '@radio')
      `);
    }

    console.log('📦 Tablas de base de datos sincronizadas y listas');
  } catch (err) {
    console.error('❌ Error fatal con la base de datos:', err.message);
  }
}

// Inicializar Base de Datos
initDB();

/* ==========================================
   RUTAS DE LA API (ENDPOINTS)
========================================== */

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('🎙️ API de Estudio Radio América funcionando correctamente');
});

// --- ENDPOINTS DE PROGRAMAS ---
app.get('/api/programs', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM programs');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/programs', async (req, res) => {
  const { id, name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await db.query(
      'INSERT INTO programs (id, name, category, thumbnail, type, description, schedule, host, coverImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category, thumbnail || '', type || 'Programa', description || '', schedule || '', host || '', coverImage || '']
    );
    res.status(201).json({ success: true, id });
  } catch (error) { 
    console.error("Error guardando programa:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/programs/:id', async (req, res) => {
  const { name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await db.query(
      'UPDATE programs SET name=?, category=?, thumbnail=?, type=?, description=?, schedule=?, host=?, coverImage=? WHERE id=?',
      [name, category, thumbnail || '', type || 'Programa', description || '', schedule || '', host || '', coverImage || '', req.params.id]
    );
    res.json({ success: true });
  } catch (error) { 
    console.error("Error actualizando programa:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.delete('/api/programs/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    console.error("Error eliminando programa:", error);
    res.status(500).json({ error: error.message }); 
  }
});

// --- ENDPOINTS DE VIDEOS / AUDIOS ---
app.get('/api/videos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM videos ORDER BY createdAt DESC');
    // Convertir de nuevo el 1/0 de MySQL a true/false para React
    const formatted = rows.map(v => ({
      ...v,
      isFeatured: !!v.isFeatured,
      isShort: !!v.isShort,
      isAudio: !!v.isAudio
    }));
    res.json(formatted);
  } catch (error) { 
    console.error("Error obteniendo videos:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/videos', async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId } = req.body;
  try {
    await db.query(
      'INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, category, thumbnail || '', description || '', isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url || '', duration || '', views || 0, createdAt, programId || null]
    );
    res.status(201).json({ success: true });
  } catch (error) { 
    console.error("Error guardando video:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/videos/:id', async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, url, programId } = req.body;
  try {
    await db.query(
      'UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, url=?, programId=? WHERE id=?',
      [title, category, thumbnail || '', description || '', isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url || '', programId || null, req.params.id]
    );
    res.json({ success: true });
  } catch (error) { 
    console.error("Error actualizando video:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM videos WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) { 
    console.error("Error eliminando video:", error);
    res.status(500).json({ error: error.message }); 
  }
});

// --- ENDPOINTS DE PERFIL ---
app.get('/api/profile', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM user_profile WHERE id = 1');
    res.json(rows[0] || {});
  } catch (error) { 
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({ error: error.message }); 
  }
});

app.put('/api/profile', async (req, res) => {
  const { firstName, lastName, avatar, bio, twitter, instagram } = req.body;
  try {
    await db.query(
      'UPDATE user_profile SET firstName=?, lastName=?, avatar=?, bio=?, twitter=?, instagram=? WHERE id=1',
      [firstName, lastName, avatar || '', bio || '', twitter || '', instagram || '']
    );
    res.json({ success: true });
  } catch (error) { 
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: error.message }); 
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
