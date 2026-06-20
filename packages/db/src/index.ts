// Barrel pubblico di @clipmanager/db: client Prisma singleton (+ tutti i tipi
// generati da Prisma) ed helper di business logic sulle quote piano,
// condivisi tra apps/api (controllo "soft" prima dell'upload) e apps/worker
// (controllo reale sui minuti dopo il probe ffmpeg, incremento contatori).
export * from "./client.js";
export * from "./planLimits.js";
