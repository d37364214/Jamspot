import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV === 'production'
    ? undefined // En production, on veut du JSON pour les outils de log
    : {
        target: 'pino-pretty', // Utiliser pino-pretty en développement pour une sortie lisible
        options: {
          colorize: true,
        },
      },
});

export default logger;
