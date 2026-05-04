const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.processVideoToHLS = (inputPath, uploadsDir, folderId) => {
  // Crear una subcarpeta "hls" dentro de uploads, y una carpeta única para este video
  const hlsDir = path.join(uploadsDir, 'hls', folderId);
  
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  const outputPath = path.join(hlsDir, 'index.m3u8');

  // Comando FFmpeg para convertir el MP4 a fragmentos HLS (.m3u8 y .ts)
  // Baja la resolución a 720p para optimizar el streaming en la web
  const ffmpegCommand = `ffmpeg -i "${inputPath}" -profile:v baseline -level 3.0 -s 1280x720 -start_number 0 -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;

  try {
    console.log(`🎬 [HLS] Iniciando fragmentación de video para: ${folderId}... (Esto puede tardar dependiendo del peso)`);
    // Se ejecuta de forma síncrona
    execSync(ffmpegCommand, { stdio: 'ignore' });
    console.log(`✅ [HLS] Fragmentación exitosa. URL generada: /uploads/hls/${folderId}/index.m3u8`);
    
    // Retornar la URL pública del archivo maestro HLS
    return `/uploads/hls/${folderId}/index.m3u8`;
  } catch (error) {
    console.error(`🔥 [HLS] Error en conversión FFmpeg:`, error.message);
    // Si falla, devolvemos null para que el sistema use el MP4 original como respaldo
    return null; 
  }
};