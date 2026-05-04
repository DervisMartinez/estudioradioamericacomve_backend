const { pool } = require('../config/db');

exports.getAllVideos = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM videos ORDER BY createdAt DESC');
    const formatted = rows.map(v => ({
      ...v,
      isFeatured: !!v.isFeatured,
      isShort: !!v.isShort,
      isAudio: !!v.isAudio,
      isLive: !!v.isLive
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error obteniendo videos:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.createVideo = async (req, res) => {
  const { id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    const parseBool = (val) => (val === true || String(val).toLowerCase() === 'true' || val === 1 || String(val) === '1' || val === 'on') ? 1 : 0;
    await pool.query(
      'INSERT INTO videos (id, title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, views, createdAt, programId, releaseDate, pressNoteUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, category, thumbnail || '', description || '', parseBool(isFeatured), parseBool(isShort), parseBool(isAudio), parseBool(isLive), url || '', duration || '', views || 0, createdAt, programId || null, releaseDate || null, pressNoteUrl || null]
    );
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error guardando video:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateVideo = async (req, res) => {
  const { title, category, thumbnail, description, isFeatured, isShort, isAudio, isLive, url, duration, programId, releaseDate, pressNoteUrl } = req.body;
  try {
    const parseBool = (val) => (val === true || String(val).toLowerCase() === 'true' || val === 1 || String(val) === '1' || val === 'on') ? 1 : 0;
    await pool.query(
      'UPDATE videos SET title=?, category=?, thumbnail=?, description=?, isFeatured=?, isShort=?, isAudio=?, isLive=?, url=?, duration=?, programId=?, releaseDate=?, pressNoteUrl=? WHERE id=?',
      [title, category, thumbnail || '', description || '', parseBool(isFeatured), parseBool(isShort), parseBool(isAudio), parseBool(isLive), url || '', duration || '', programId || null, releaseDate || null, pressNoteUrl || null, req.params.id]
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