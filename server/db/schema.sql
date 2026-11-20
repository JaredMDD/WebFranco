-- Esquema de modelo_de_datos.md. Idempotente: se puede ejecutar varias veces (npm run db:migrar).
-- shortcut: solo CREATE ... IF NOT EXISTS; un cambio a una tabla existente necesita su propio ALTER aquí abajo.

CREATE TABLE IF NOT EXISTS usuario (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_usuario  varchar(50)  NOT NULL UNIQUE,
  contrasena_hash varchar(255) NOT NULL,
  rol             varchar(10)  NOT NULL CHECK (rol IN ('ADMIN', 'DOCENTE', 'ALUMNO')),
  activo          boolean      NOT NULL DEFAULT true,
  creado_en       timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesion (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint       NOT NULL REFERENCES usuario(id),
  token_hash  varchar(255) NOT NULL UNIQUE,
  expira_en   timestamptz  NOT NULL,
  activa      boolean      NOT NULL DEFAULT true,
  creado_en   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sesion_usuario_activa ON sesion (usuario_id, activa);

CREATE TABLE IF NOT EXISTS materia (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  docente_id  bigint       NOT NULL REFERENCES usuario(id),
  nombre      varchar(120) NOT NULL
);
CREATE INDEX IF NOT EXISTS materia_docente ON materia (docente_id);

CREATE TABLE IF NOT EXISTS grupo (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  materia_id          bigint      NOT NULL REFERENCES materia(id) ON DELETE CASCADE,
  nombre              varchar(80) NOT NULL,
  codigo_inscripcion  varchar(12) NOT NULL UNIQUE,
  activo              boolean     NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS inscripcion (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo_id    bigint      NOT NULL REFERENCES grupo(id) ON DELETE CASCADE,
  alumno_id   bigint      NOT NULL REFERENCES usuario(id),
  creado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, alumno_id)
);

CREATE TABLE IF NOT EXISTS examen (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  docente_id              bigint       NOT NULL REFERENCES usuario(id),
  titulo                  varchar(150) NOT NULL,
  instrucciones           text         NOT NULL DEFAULT '',
  abre_en                 timestamptz,
  cierra_en               timestamptz,
  duracion_min            int          CHECK (duracion_min > 0),
  mostrar_respuestas      boolean      NOT NULL DEFAULT false,
  umbral_inactividad_min  int          NOT NULL DEFAULT 3 CHECK (umbral_inactividad_min > 0),
  permite_herramienta     boolean      NOT NULL DEFAULT false,
  estado                  varchar(12)  NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'PROGRAMADO', 'CERRADO')),
  creado_en               timestamptz  NOT NULL DEFAULT now(),
  CHECK (cierra_en IS NULL OR abre_en IS NULL OR cierra_en > abre_en)
);
CREATE INDEX IF NOT EXISTS examen_docente ON examen (docente_id);

CREATE TABLE IF NOT EXISTS examen_grupo (
  examen_id  bigint NOT NULL REFERENCES examen(id) ON DELETE CASCADE,
  grupo_id   bigint NOT NULL REFERENCES grupo(id) ON DELETE CASCADE,
  PRIMARY KEY (examen_id, grupo_id)
);

-- Tiempo extra asignado ANTES de que el alumno inicie (RF-16); al crear el intento se copia a intento.tiempo_extra_min.
CREATE TABLE IF NOT EXISTS tiempo_extra (
  examen_id  bigint NOT NULL REFERENCES examen(id) ON DELETE CASCADE,
  alumno_id  bigint NOT NULL REFERENCES usuario(id),
  minutos    int    NOT NULL CHECK (minutos BETWEEN 1 AND 240),
  PRIMARY KEY (examen_id, alumno_id)
);

CREATE TABLE IF NOT EXISTS pregunta (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  examen_id    bigint       NOT NULL REFERENCES examen(id) ON DELETE CASCADE,
  orden        int          NOT NULL,
  tipo         varchar(20)  NOT NULL CHECK (tipo IN ('ABIERTA', 'OPCION_MULTIPLE', 'VERDADERO_FALSO')),
  enunciado    text         NOT NULL,
  imagen_ruta  varchar(255),
  puntos       numeric(5,2) NOT NULL DEFAULT 1 CHECK (puntos >= 0)
);

CREATE TABLE IF NOT EXISTS opcion (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pregunta_id  bigint  NOT NULL REFERENCES pregunta(id) ON DELETE CASCADE,
  texto        text    NOT NULL,
  es_correcta  boolean NOT NULL DEFAULT false, -- nunca se envía al navegador durante el examen (RNF-07)
  orden        int     NOT NULL
);

CREATE TABLE IF NOT EXISTS intento (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  examen_id          bigint       NOT NULL REFERENCES examen(id),
  alumno_id          bigint       NOT NULL REFERENCES usuario(id),
  estado             varchar(12)  NOT NULL DEFAULT 'EN_CURSO' CHECK (estado IN ('EN_CURSO', 'ENVIADO', 'ABANDONADO', 'ANULADO', 'REABIERTO')),
  inicio_en          timestamptz  NOT NULL DEFAULT now(),
  fin_en             timestamptz,
  tiempo_extra_min   int          NOT NULL DEFAULT 0 CHECK (tiempo_extra_min >= 0),
  semilla_aleatoria  bigint       NOT NULL,
  ip_inicio          varchar(45)  NOT NULL,
  calificacion       numeric(5,2),
  publicado          boolean      NOT NULL DEFAULT false,
  UNIQUE (examen_id, alumno_id) -- una sola oportunidad (RF-22)
);
CREATE INDEX IF NOT EXISTS intento_estado ON intento (estado);
-- Fase 5: índice (0..n-1) de la pregunta actual dentro del orden barajado del alumno; solo avanza (RF-23).
ALTER TABLE intento ADD COLUMN IF NOT EXISTS posicion int NOT NULL DEFAULT 0;
-- Decisión del docente que sobrevive a la purga de evidencias: el plagio se confirmó y la anulación es definitiva (RF-33).
ALTER TABLE intento ADD COLUMN IF NOT EXISTS plagio_confirmado boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS respuesta (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intento_id          bigint       NOT NULL REFERENCES intento(id),
  pregunta_id         bigint       NOT NULL REFERENCES pregunta(id),
  opcion_id           bigint       REFERENCES opcion(id),
  texto_respuesta     text,
  puntos_obtenidos    numeric(5,2),
  comentario_docente  text,
  guardada_en         timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (intento_id, pregunta_id) -- el autoguardado actualiza la fila
);

CREATE TABLE IF NOT EXISTS incidente (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intento_id    bigint       NOT NULL REFERENCES intento(id) ON DELETE CASCADE,
  tipo          varchar(20)  NOT NULL CHECK (tipo IN ('CAMBIO_PESTANA', 'INACTIVIDAD', 'SESION_DUPLICADA', 'CONEXION_PERDIDA')),
  ocurrio_en    timestamptz  NOT NULL DEFAULT now(),
  ip            varchar(45)  NOT NULL,
  dispositivo   varchar(255) NOT NULL DEFAULT '',
  decision      varchar(12)  NOT NULL DEFAULT 'PENDIENTE' CHECK (decision IN ('PENDIENTE', 'CONFIRMADO', 'DESCARTADO')),
  revisado_por  bigint       REFERENCES usuario(id),
  revisado_en   timestamptz,
  expira_en     timestamptz  NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX IF NOT EXISTS incidente_intento ON incidente (intento_id);
CREATE INDEX IF NOT EXISTS incidente_expira ON incidente (expira_en);

CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint      NOT NULL REFERENCES usuario(id),
  accion      varchar(40) NOT NULL,
  entidad     varchar(40) NOT NULL,
  entidad_id  bigint,
  detalle     text        NOT NULL DEFAULT '',
  creado_en   timestamptz NOT NULL DEFAULT now()
);
