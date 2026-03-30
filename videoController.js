const { pool } = require('../config/db');

exports.getAllVideos = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM videos ORDER BY createdAt DESC');
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
};

exports.createVideo = async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId } = req.body;
  try {
    await pool.query(
      'INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, url, duration, views, createdAt, programId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, category, thumbnail || '', description || '', isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url || '', duration || '', views || 0, createdAt, programId || null]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error guardando video:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateVideo = async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, url, programId } = req.body;
  try {
    await pool.query(
      'UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, url=?, programId=? WHERE id=?',
      [title, category, thumbnail || '', description || '', isFeatured ? 1 : 0, isShort ? 1 : 0, isAudio ? 1 : 0, url || '', programId || null, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error actualizando video:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    await pool.query('DELETE FROM videos WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando video:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.incrementView = async (req, res) => {
  try {
    await pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error incrementando vistas:", error);
    res.status(500).json({ error: error.message });
  }
};