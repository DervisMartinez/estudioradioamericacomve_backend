const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.processVideoToHLS = (inputPath, uploadsDir, folderId) => {
  return new Promise((resolve, reject) => {
    // Crear una subcarpeta "hls" dentro de uploads, y una carpeta única para este video
    const hlsDir = path.join(uploadsDir, 'hls', folderId);
    
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    const outputPath = path.join(hlsDir, 'index.m3u8');

    // Comando FFmpeg para convertir el MP4 a fragmentos HLS (.m3u8 y .ts)
    // Baja la resolución a 720p para optimizar el streaming en la web
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -profile:v baseline -level 3.0 -s 1280x720 -start_number 0 -hls_time 10 -hls_list_size 0 -f hls "${outputPath}"`;

    console.log(`🎬 [HLS] Iniciando fragmentación de video para: ${folderId} (En segundo plano)`);
    
    // Ejecución Asíncrona (No congela el servidor Node.js)
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`🔥 [HLS] Error en conversión FFmpeg:`, error.message);
        return resolve(null); // Fallback al MP4 original si falla
      }
      console.log(`✅ [HLS] Fragmentación exitosa. URL generada: /uploads/hls/${folderId}/index.m3u8`);
      resolve(`/uploads/hls/${folderId}/index.m3u8`);
    });
  });
};