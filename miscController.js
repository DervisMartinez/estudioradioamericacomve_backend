const { pool } = require('../config/db');
const { sendWelcomeNewsletter } = require('./utils/services/mailer');

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_profile WHERE id = 1');
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  const { firstName, lastName, avatar, bio, twitter, instagram } = req.body;
  try {
    await pool.query(
      'UPDATE user_profile SET firstName=?, lastName=?, avatar=?, bio=?, twitter=?, instagram=? WHERE id=1',
      [firstName, lastName, avatar || '', bio || '', twitter || '', instagram || '']
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.search = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'El término de búsqueda es requerido' });
  try {
    const searchTerm = `%${query}%`;
    const [videos] = await pool.query('SELECT id, title, thumbnail, "video" as type FROM videos WHERE title LIKE ?', [searchTerm]);
    const [programs] = await pool.query('SELECT id, name as title, thumbnail, "program" as type FROM programs WHERE name LIKE ?', [searchTerm]);
    res.json({ videos, programs });
  } catch (error) {
    console.error("Error en la búsqueda:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.subscribe = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El email es requerido' });
  try {
    await pool.query('INSERT INTO subscribers (email) VALUES (?)', [email]);

    // Extraer el contenido destacado para armar el correo
    const [featuredVideos] = await pool.query('SELECT * FROM videos WHERE isFeatured = 1 LIMIT 2');
    const [newPrograms] = await pool.query('SELECT * FROM programs LIMIT 3');

    // Enviar el correo usando Nodemailer
    await sendWelcomeNewsletter(email, featuredVideos, newPrograms);

    res.status(201).json({ success: true });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(200).json({ message: 'El usuario ya estaba suscrito.' });
    console.error("Error en la suscripción:", error);
    res.status(500).json({ error: error.message });
  }
};