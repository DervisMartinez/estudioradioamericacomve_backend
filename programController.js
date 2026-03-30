const { pool } = require('../config/db');

exports.getAllPrograms = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM programs ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo programas:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.createProgram = async (req, res) => {
  const { id, name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await pool.query(
      'INSERT INTO programs (id, name, category, thumbnail, type, description, schedule, host, coverImage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category, thumbnail || '', type || 'Programa', description || '', schedule || '', host || '', coverImage || '']
    );
    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error("Error guardando programa:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateProgram = async (req, res) => {
  const { name, category, thumbnail, type, description, schedule, host, coverImage } = req.body;
  try {
    await pool.query(
      'UPDATE programs SET name=?, category=?, thumbnail=?, type=?, description=?, schedule=?, host=?, coverImage=? WHERE id=?',
      [name, category, thumbnail || '', type || 'Programa', description || '', schedule || '', host || '', coverImage || '', req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error actualizando programa:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteProgram = async (req, res) => {
  try {
    await pool.query('DELETE FROM programs WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando programa:", error);
    res.status(500).json({ error: error.message });
  }
};