const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USERNAME || process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const initDB = async () => {
  try {
    // 0. Crear la base de datos automáticamente si no existe
    const tempConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USERNAME || process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    const dbName = process.env.DB_DATABASE || process.env.DB_NAME;
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await tempConnection.end();

    console.log('✅ Conexión exitosa a MySQL (phpMyAdmin)');

    // 1. Crear Tabla de Programas
    await pool.query(`
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
    await pool.query(`
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
        programId VARCHAR(100) NULL,
        releaseDate VARCHAR(100) NULL,
        pressNoteUrl LONGTEXT NULL
      )
    `);

    try { await pool.query('ALTER TABLE videos ADD COLUMN releaseDate VARCHAR(100) NULL'); } catch(e) {}
    try { await pool.query('ALTER TABLE videos ADD COLUMN pressNoteUrl LONGTEXT NULL'); } catch(e) {}
    try { await pool.query('ALTER TABLE videos ADD COLUMN isLive TINYINT(1) DEFAULT 0'); } catch(e) {}

    // 3. Crear Tabla del Perfil de Usuario Administrador
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INT PRIMARY KEY DEFAULT 1,
        firstName VARCHAR(100),
        lastName VARCHAR(100),
        avatar LONGTEXT,
        bio TEXT,
        twitter VARCHAR(100),
        instagram VARCHAR(100),
        youtube VARCHAR(255),
        facebook VARCHAR(255)
      )
    `);

    // Insertar un perfil por defecto si la tabla está vacía
    const [profileRows] = await pool.query('SELECT * FROM user_profile WHERE id = 1');
    if (profileRows.length === 0) {
      await pool.query(`
        INSERT INTO user_profile (id, firstName, lastName, avatar, bio, twitter, instagram) 
        VALUES (1, 'Admin', 'Radio', '', 'Administrador del sistema', '@radio', '@radio')
      `);
    }

    try { await pool.query('ALTER TABLE user_profile ADD COLUMN youtube VARCHAR(255) NULL'); } catch(e) {}
    try { await pool.query('ALTER TABLE user_profile ADD COLUMN facebook VARCHAR(255) NULL'); } catch(e) {}

    // 4. Crear Tabla de Suscriptores para el Newsletter
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        subscribedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Crear Tabla de Cuñas (Sponsors)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sponsors (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        programId VARCHAR(50),
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('📦 Tablas de base de datos sincronizadas y listas');
  } catch (err) {
    console.error('❌ Error fatal con la base de datos:', err.message);
    // Salir del proceso si no se puede inicializar la BD
    process.exit(1);
  }
};

module.exports = {
  pool,
  initDB
};