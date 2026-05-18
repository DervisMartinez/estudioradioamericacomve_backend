const nodemailer = require('nodemailer');

// Configuración del servidor de correo (Reemplaza con tus datos reales o usa variables de entorno)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.tu-servidor.com', // Ej: smtp.gmail.com
  port: process.env.SMTP_PORT || 465,
  secure: true, // true para puerto 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS 
  }
});

const sendWelcomeNewsletter = async (email, featuredVideos, newPrograms) => {
  // Construir el HTML dinámico
  let htmlTemplate = `
    <div style="font-family: 'Montserrat', sans-serif; color: #131314; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background-color: #C13535; padding: 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-weight: 900; letter-spacing: -1px;">Estudio Radio América</h1>
      </div>

      <div style="padding: 30px;">
        <h2 style="text-align: center; color: #131314;">¡Bienvenido al Boletín! 🎙️</h2>
        <p style="text-align: center; color: #666;">Aquí tienes lo más nuevo y destacado de nuestra programación:</p>
        
        <h3 style="color: #F07D00; border-bottom: 2px solid #F07D00; padding-bottom: 5px; margin-top: 30px;">🔥 Entrevistas y Videos Destacados</h3>
  `;

  // Iterar sobre los videos destacados para agregarlos al correo
  featuredVideos.forEach(video => {
    htmlTemplate += `
        <div style="margin-bottom: 25px; background: #f9f9f9; border-radius: 10px; overflow: hidden;">
          <img src="${video.thumbnail}" alt="${video.title}" style="width: 100%; height: 200px; object-fit: cover;" />
          <div style="padding: 15px;">
            <span style="background: #131314; color: #fff; font-size: 10px; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">${video.category}</span>
            <h4 style="color: #C13535; margin: 10px 0 5px 0; font-size: 18px;">${video.title}</h4>
            <p style="font-size: 14px; color: #444; margin-bottom: 15px;">${video.description || ''}</p>
            <a href="https://estudioradioamerica.com.ve/watch/${video.id}" style="background-color: #C13535; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; display: inline-block;">Ver o Escuchar ahora</a>
          </div>
        </div>
    `;
  });

  htmlTemplate += `
        <h3 style="color: #F07D00; border-bottom: 2px solid #F07D00; padding-bottom: 5px; margin-top: 30px;">📻 Nuevos Programas</h3>
        <ul style="list-style: none; padding: 0;">
  `;

  // Iterar sobre los programas
  newPrograms.forEach(program => {
    htmlTemplate += `
          <li style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px;">
            <img src="${program.thumbnail}" alt="Cover" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" />
            <div>
              <h4 style="margin: 0; color: #131314;">${program.name}</h4>
              <span style="font-size: 12px; color: #FFB91F; font-weight: bold; text-transform: uppercase;">${program.category}</span>
            </div>
          </li>
    `;
  });

  htmlTemplate += `
        </ul>
      </div>

      <!-- Footer -->
      <div style="background-color: #f1f1f1; padding: 20px; text-align: center; font-size: 12px; color: #999;">
        <p>Recibes este correo porque te suscribiste al boletín de Estudio Radio América.</p>
        <p>© ${new Date().getFullYear()} Estudio Radio América. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  // Ejecutar el envío
  await transporter.sendMail({
    from: `"Estudio Radio América" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '¡Lo nuevo en Estudio Radio América! 📻',
    html: htmlTemplate
  });
};

const sendNewVideoNotification = async (emailsArray, videoData) => {
  let htmlTemplate = `
    <div style="font-family: 'Montserrat', sans-serif; background-color: #131314; color: #ffffff; padding: 30px; text-align: center; border-radius: 10px;">
      <h1 style="color: #C13535; font-weight: 900;">¡Acabamos de publicar nuevo contenido!</h1>
      
      <img src="${videoData.thumbnail || 'https://estudio.radioamerica.com.ve/logo_colors.png'}" style="max-width: 100%; border-radius: 10px; margin: 20px 0; max-height: 300px; object-fit: cover;" alt="${videoData.title}" />
      
      <h2 style="color: #ffffff; font-size: 24px; margin-bottom: 10px;">${videoData.title}</h2>
      <span style="background-color: #F07D00; color: #000; font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 4px; text-transform: uppercase;">${videoData.category}</span>
      
      <p style="color: #cccccc; margin: 20px 0; font-size: 16px; line-height: 1.5;">${videoData.description || 'Disfruta de este nuevo material exclusivo de Estudio Radio América.'}</p>
      
      <a href="https://estudio.radioamerica.com.ve" style="background-color: #C13535; color: white; padding: 15px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; margin-top: 20px;">Ver o Escuchar Ahora</a>
      
      <div style="margin-top: 40px; font-size: 11px; color: #666666; border-top: 1px solid #333; padding-top: 20px;">
        © ${new Date().getFullYear()} Estudio Radio América. Recibes este correo porque te suscribiste a nuestro boletín.
      </div>
    </div>
  `;

  // Ejecutar el envío (Usamos BCC para que los correos sean privados entre destinatarios)
  await transporter.sendMail({
    from: `"Estudio Radio América" <${process.env.SMTP_USER}>`,
    bcc: emailsArray.join(', '),
    subject: `Nuevo Episodio: ${videoData.title} 🎙️`,
    html: htmlTemplate
  });
};

module.exports = { sendWelcomeNewsletter, sendNewVideoNotification };
