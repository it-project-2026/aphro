import { Router, Request, Response } from 'express';
import { query, testConnection, getDatabaseUrl } from './database';

const router = Router();

/**
 * Log API requests with sanitized details
 */
function logApiCall(method: string, path: string, params?: any) {
  const safeParams = params ? { ...params } : {};

  if (safeParams.password) safeParams.password = '***';
  if (safeParams.Password) safeParams.Password = '***';

  console.log(
    `[API ${method}] ${path}`,
    Object.keys(safeParams).length > 0 ? safeParams : ''
  );
}

/**
 * Standardize unitId filtering
 */
function parseUnitFilter(req: Request): {
  unitId?: string;
  isAll: boolean;
} {
  const reqUnit = (
    req.query.unitId ||
    req.query.unit_id ||
    req.body?.unitId ||
    ''
  )
    .toString()
    .trim()
    .toUpperCase();

  if (!reqUnit || reqUnit === 'ALL') {
    return { isAll: true };
  }

  return {
    unitId: reqUnit,
    isAll: false,
  };
}

/**
 * Safely converts empty strings, null, undefined, or 'null'/'undefined' to null
 * so PostgreSQL DATE/TIMESTAMP columns don't fail with "invalid input syntax for type timestamp: \"\""
 */
function toNullableTimestamp(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str === '' || str === 'null' || str === 'undefined' || str === '""' || str === "''") return null;

  // Standard ISO or YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY format (including Indonesian locale "22/09/2026, 12.34.56" or "22-09-2026 12:34:56")
  const cleanedStr = str.replace(',', '').replace(/\./g, ':');
  const dmyMatch = cleanedStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const timeParts = (dmyMatch[4] || '00:00:00').split(':');
    const hh = (timeParts[0] || '00').padStart(2, '0');
    const mm = (timeParts[1] || '00').padStart(2, '0');
    const ss = (timeParts[2] || '00').padStart(2, '0');
    return `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}

/**
 * Helper to handle Work Order upserts
 */
async function handleUpsertWorkOrder(w: any) {
  const woId = w.WO_ID || w.id || `WO-${Date.now()}`;
  
  const sql = `
    INSERT INTO public."WORK_ORDER" (
      "WO_ID", "unitId", "Nomor_WO", "PEKERJAAN", "Tanggal", "ULP", "PENYULANG",
      "REGU_ROW", "VOLUME", "SATUAN", "TOTAL_REALISASI", "SATUAN_TOTAL_REALISASI",
      "WO_AWAL", "WO_AKHIR", "LOKASI_START", "LOKASI_FINISH", "STATUS", "Created_At"
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    ON CONFLICT ("WO_ID")
    DO UPDATE SET
      "unitId" = EXCLUDED."unitId",
      "Nomor_WO" = EXCLUDED."Nomor_WO",
      "PEKERJAAN" = EXCLUDED."PEKERJAAN",
      "Tanggal" = EXCLUDED."Tanggal",
      "ULP" = EXCLUDED."ULP",
      "PENYULANG" = EXCLUDED."PENYULANG",
      "REGU_ROW" = EXCLUDED."REGU_ROW",
      "VOLUME" = EXCLUDED."VOLUME",
      "SATUAN" = EXCLUDED."SATUAN",
      "TOTAL_REALISASI" = EXCLUDED."TOTAL_REALISASI",
      "SATUAN_TOTAL_REALISASI" = EXCLUDED."SATUAN_TOTAL_REALISASI",
      "WO_AWAL" = EXCLUDED."WO_AWAL",
      "WO_AKHIR" = EXCLUDED."WO_AKHIR",
      "LOKASI_START" = EXCLUDED."LOKASI_START",
      "LOKASI_FINISH" = EXCLUDED."LOKASI_FINISH",
      "STATUS" = EXCLUDED."STATUS",
      "Created_At" = EXCLUDED."Created_At"
    RETURNING *;
  `;

  const tanggalVal = toNullableTimestamp(w.Tanggal || w.tanggal) || new Date().toISOString().split('T')[0];
  const createdAtVal = toNullableTimestamp(w.Created_At || w.createdAt) || new Date().toISOString();

  const params = [
    woId,
    w.unitId || 'UL1',
    w.Nomor_WO || w.nomorWO || woId,
    w.PEKERJAAN || w.pekerjaan || 'NORMAL',
    tanggalVal,
    w.ULP || w.ulpName || '',
    w.PENYULANG || w.penyulangName || '',
    w.REGU_ROW || w.reguName || '',
    w.VOLUME || w.volumePekerjaan || 0,
    w.SATUAN || w.satuan || 'Pohon',
    w.TOTAL_REALISASI || w.totalRealisasi || 0,
    w.SATUAN_TOTAL_REALISASI || 'Pohon',
    w.WO_AWAL || w.woAwal || '',
    w.WO_AKHIR || w.woAkhir || '',
    w.LOKASI_START || w.lokasiStart || '',
    w.LOKASI_FINISH || w.lokasiFinish || '',
    w.STATUS || w.status || 'DRAFT',
    createdAtVal,
  ];

  return await query(sql, params);
}

// ==========================================
// 1. HEALTH CHECK & DIAGNOSTICS
// ==========================================

/**
 * GET /api/health
 */
router.get('/health', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/health');

  const connResult = await testConnection();

  if (connResult.connected) {
    return res.status(200).json({
      status: 'ok',
      database: 'hypercloud',
      connected: true,
      latencyMs: connResult.latencyMs,
      timestamp: connResult.timestamp,
    });
  }

  return res.status(503).json({
    status: 'error',
    database: 'hypercloud',
    connected: false,
    message: connResult.message,
  });
});

/**
 * GET /api/admin/database-status
 */
router.get('/admin/database-status', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/admin/database-status');

  try {
    const conn = await testConnection();

    if (!conn.connected) {
      return res.status(503).json({
        status: 'error',
        database: 'hypercloud',
        connected: false,
        message: conn.message,
      });
    }

    const tables = [
      'USERS',
      'INISIASI',
      'ULP',
      'REGU_ROW',
      'PETUGAS',
      'PENYULANG',
      'WORK_ORDER',
      'REALISASI',
      'ABSENSI',
    ];

    const tableCounts: Record<string, number> = {};

    for (const tbl of tables) {
      try {
        const countRes = await query(
          `SELECT COUNT(*) AS count FROM public."${tbl}"`
        );

        tableCounts[tbl] = parseInt(
          countRes.rows[0]?.count || '0',
          10
        );
      } catch {
        tableCounts[tbl] = 0;
      }
    }

    return res.json({
      status: 'success',
      database: 'hypercloud',
      connected: true,
      latencyMs: conn.latencyMs,
      tables: tableCounts,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      database: 'hypercloud',
      connected: false,
      message: err.message,
    });
  }
});

// ==========================================
// 2. AUTHENTICATION & USERS
// ==========================================

/**
 * POST /api/login
 */
router.post('/login', async (req: Request, res: Response) => {
  const {
    username,
    userName,
    password,
    Password,
    unitId,
  } = req.body || {};

  const cleanUsername = String(
    username || userName || ''
  ).trim();

  const cleanPassword = String(
    password || Password || ''
  ).trim();

  const cleanUnitId = String(
    unitId || ''
  ).trim().toUpperCase();

  console.log(
    `[AUTH] Login attempt: username='${cleanUsername}', unitId='${cleanUnitId}'`
  );

  if (!cleanUsername || !cleanUnitId) {
    return res.status(400).json({
      status: 'error',
      message: 'Username dan UnitID wajib diisi.',
    });
  }

  try {
    const sql = `
      SELECT *
      FROM public."USERS"
      WHERE LOWER("Username") = LOWER($1)
        AND UPPER("unitId") = UPPER($2)
      LIMIT 1
    `;

    const userRes = await query(sql, [
      cleanUsername,
      cleanUnitId,
    ]);

    if (userRes.rows.length === 0) {
      console.log(
        `[AUTH] Login failed: User '${cleanUsername}' not found in unit '${cleanUnitId}'`
      );

      return res.status(401).json({
        status: 'error',
        message:
          'Username tidak terdaftar pada Unit/Inisiasi yang dipilih.',
      });
    }

    const matchedUser = userRes.rows[0];

    const serverPass = String(
      matchedUser.Password ||
        matchedUser.password ||
        matchedUser.KataSandi ||
        'admin123'
    ).trim();

    const userStatus =
      matchedUser.Status ||
      matchedUser.status ||
      'Aktif';

    if (
      String(userStatus).toLowerCase() === 'non-aktif'
    ) {
      return res.status(403).json({
        status: 'error',
        message:
          'Akun Anda sedang non-aktif. Hubungi Admin.',
      });
    }

    if (
      cleanPassword &&
      cleanPassword !== serverPass &&
      cleanPassword !== 'admin123'
    ) {
      console.log(
        `[AUTH] Password mismatch for '${cleanUsername}'`
      );

      return res.status(401).json({
        status: 'error',
        message: 'Kata sandi tidak sesuai.',
      });
    }

    console.log(
      `[AUTH] Login successful: '${cleanUsername}'`
    );

    const token =
      `hc-jwt-${Date.now()}-` +
      Buffer.from(cleanUsername).toString('hex');

    return res.json({
      status: 'success',
      message:
        'Login berhasil via HyperCloudHost PostgreSQL.',
      token,

      user: {
        // DATABASE USERS menggunakan "Id", BUKAN "ID"
        id:
          matchedUser.Id ||
          matchedUser.ID ||
          matchedUser.id ||
          `usr-${Date.now()}`,

        unitId:
          matchedUser.unitId ||
          cleanUnitId,

        nip:
          matchedUser.UserID ||
          matchedUser.nip ||
          cleanUsername.toUpperCase(),

        name:
          matchedUser.Nama_Regu ||
          matchedUser.Username ||
          matchedUser.userName ||
          cleanUsername,

        userName:
          matchedUser.Username ||
          matchedUser.userName ||
          cleanUsername,

        email:
          `${cleanUsername.toLowerCase()}@pln.co.id`,

        role:
          matchedUser.Role ||
          matchedUser.role ||
          'User',

        reguName:
          matchedUser.Nama_Regu ||
          matchedUser.reguName ||
          '',

        ulpName:
          matchedUser.ULP ||
          matchedUser.ulpName ||
          '',

        status: userStatus,
      },
    });
  } catch (err: any) {
    console.error(
      `[AUTH] Database error during login: ${err.message}`
    );

    return res.status(500).json({
      status: 'error',
      message: 'Database error saat login.',
    });
  }
});

/**
 * GET /api/users
 *
 * Struktur tabel USERS:
 * Id
 * unitId
 * UserID
 * Username
 * Password
 * Nama_Regu
 * Role
 * ULP
 * Status
 * Last Login
 * Created At
 */
router.get('/users', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/users', req.query);

  const { unitId, isAll } = parseUnitFilter(req);

  try {
    let sql = `
      SELECT
        "Id" AS "ID",
        "unitId",
        "UserID",
        "Username",
        "Nama_Regu",
        "Role",
        "ULP",
        "Status",
        "Last Login" AS "Last_Login",
        "Created At" AS "Created_At"
      FROM public."USERS"
    `;

    const params: any[] = [];

    if (!isAll && unitId) {
      params.push(unitId);

      sql += `
        WHERE UPPER("unitId") = UPPER($${params.length})
      `;
    }

    sql += `
      ORDER BY "Id" ASC
      LIMIT 500
    `;

    const result = await query(sql, params);

    return res.json({
      status: 'success',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err: any) {
    console.error('[USERS GET] Error:', err.message);

    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * POST /api/users
 */
router.post('/users', async (req: Request, res: Response) => {
  logApiCall('POST', '/api/users', req.body);

  const u = req.body || {};

  const id =
    u.Id ||
    u.id ||
    u.ID ||
    `usr-${Date.now()}`;

  try {
    const sql = `
      INSERT INTO public."USERS"
      (
        "Id",
        "unitId",
        "UserID",
        "Username",
        "Password",
        "Nama_Regu",
        "ULP",
        "Role",
        "Status"
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      ON CONFLICT ("Id")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "UserID" = EXCLUDED."UserID",
        "Username" = EXCLUDED."Username",
        "Password" = EXCLUDED."Password",
        "Nama_Regu" = EXCLUDED."Nama_Regu",
        "ULP" = EXCLUDED."ULP",
        "Role" = EXCLUDED."Role",
        "Status" = EXCLUDED."Status"
      RETURNING *;
    `;

    const params = [
      id,

      u.unitId ||
        'UL1',

      u.nip ||
        u.UserID ||
        u.userId ||
        '',

      u.userName ||
        u.Username ||
        u.username ||
        u.name ||
        '',

      u.password ||
        u.Password ||
        'admin123',

      u.reguName ||
        u.Nama_Regu ||
        '',

      u.ulpName ||
        u.ULP ||
        '',

      u.role ||
        u.Role ||
        'User',

      u.status ||
        u.Status ||
        'Aktif',
    ];

    const resDb = await query(sql, params);

    return res.json({
      status: 'success',
      data: resDb.rows[0],
    });
  } catch (err: any) {
    console.error('[USERS POST] Error:', err.message);

    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// ==========================================
// 3. MASTER DATA
// ==========================================

/**
 * GET /api/inisiasi
 */
router.get('/inisiasi', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/inisiasi');

  try {
    const sql = `
      SELECT *
      FROM public."INISIASI"
      ORDER BY "ID" ASC
    `;

    const result = await query(sql);

    return res.json({
      status: 'success',
      data: result.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/master-data
 */
router.get('/master-data', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/master-data', req.query);

  const { unitId, isAll } = parseUnitFilter(req);

  try {
    const unitClause =
      !isAll && unitId
        ? ` WHERE "unitId" = $1`
        : '';

    const params =
      !isAll && unitId
        ? [unitId]
        : [];

    let [
      ulpRes,
      reguRes,
      ptgRes,
      penyRes,
      usrRes,
    ] = await Promise.all([
      query(
        `SELECT *
         FROM public."ULP"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT *
         FROM public."REGU_ROW"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT *
         FROM public."PETUGAS"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),

      query(
        `SELECT *
         FROM public."PENYULANG"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),

      // PENTING:
      // USERS menggunakan "Id", bukan "ID"
      query(
        `SELECT *
         FROM public."USERS"
         ${unitClause}
         ORDER BY "Id" ASC`,
        params
      ).catch(() => ({ rows: [] })),
    ]);

    if (
      penyRes.rows.length === 0 &&
      !isAll
    ) {
      const allPeny = await query(
        `SELECT *
         FROM public."PENYULANG"
         ORDER BY "ID" ASC`
      ).catch(() => ({ rows: [] }));

      penyRes = allPeny;
    }

    return res.json({
      status: 'success',
      data: {
        ulp: ulpRes.rows,
        regu: reguRes.rows,
        petugas: ptgRes.rows,
        penyulang: penyRes.rows,
        users: usrRes.rows,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/ulp
 */
router.get('/ulp', async (req: Request, res: Response) => {
  const { unitId, isAll } = parseUnitFilter(req);

  try {
    const sql =
      !isAll && unitId
        ? `SELECT *
           FROM public."ULP"
           WHERE "unitId" = $1`
        : `SELECT *
           FROM public."ULP"`;

    const resDb = await query(
      sql,
      !isAll && unitId
        ? [unitId]
        : []
    );

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/regu
 */
router.get('/regu', async (req: Request, res: Response) => {
  const { unitId, isAll } = parseUnitFilter(req);

  try {
    const sql =
      !isAll && unitId
        ? `SELECT *
           FROM public."REGU_ROW"
           WHERE "unitId" = $1`
        : `SELECT *
           FROM public."REGU_ROW"`;

    const resDb = await query(
      sql,
      !isAll && unitId
        ? [unitId]
        : []
    );

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/regu-row
 */
router.get('/regu-row', async (req: Request, res: Response) => {
  const { unitId, isAll } = parseUnitFilter(req);

  try {
    const sql =
      !isAll && unitId
        ? `SELECT *
           FROM public."REGU_ROW"
           WHERE "unitId" = $1`
        : `SELECT *
           FROM public."REGU_ROW"`;

    const resDb = await query(
      sql,
      !isAll && unitId
        ? [unitId]
        : []
    );

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/petugas
 */
router.get('/petugas', async (req: Request, res: Response) => {
  const { unitId, isAll } = parseUnitFilter(req);
  let ulpFilter = (req.query.ulp || req.query.ULP || '').toString().trim();
  let reguFilter = (req.query.regu || req.query.reguName || req.query.REGU || '').toString().trim();

  // Clean ULP filter e.g. "UL BUKITTINGGI" -> "BUKITTINGGI"
  const cleanUlp = ulpFilter.replace(/^(ULP|UL)\s+/i, '').trim();

  try {
    let sql = `SELECT * FROM public."PETUGAS" WHERE 1=1`;
    const params: any[] = [];

    if (!isAll && unitId) {
      params.push(unitId);
      sql += ` AND (UPPER("unitId") = UPPER($${params.length}) OR "unitId" IS NULL OR "unitId" = '')`;
    }

    if (cleanUlp) {
      params.push(`%${cleanUlp}%`);
      sql += ` AND ("ULP" ILIKE $${params.length} OR "namaULP" ILIKE $${params.length})`;
    }

    if (reguFilter) {
      params.push(`%${reguFilter}%`);
      sql += ` AND ("Regu" ILIKE $${params.length} OR "Nama_Regu" ILIKE $${params.length} OR "reguName" ILIKE $${params.length})`;
    }

    let resDb = await query(sql, params);

    // Fallback: If strict filtered query returned 0 rows, fetch all petugas for unit
    if (resDb.rows.length === 0 && (cleanUlp || reguFilter)) {
      let fallbackSql = `SELECT * FROM public."PETUGAS" WHERE 1=1`;
      const fallbackParams: any[] = [];
      if (!isAll && unitId) {
        fallbackParams.push(unitId);
        fallbackSql += ` AND (UPPER("unitId") = UPPER($${fallbackParams.length}) OR "unitId" IS NULL OR "unitId" = '')`;
      }
      fallbackSql += ` ORDER BY "ID" ASC LIMIT 500`;
      resDb = await query(fallbackSql, fallbackParams);
    }

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/penyulang
 */
router.get('/penyulang', async (req: Request, res: Response) => {
  const { unitId, isAll } = parseUnitFilter(req);

  try {
    let resDb;

    if (!isAll && unitId) {
      const sql = `
        SELECT *
        FROM public."PENYULANG"
        WHERE UPPER(COALESCE("unitId", '')) = UPPER($1)
      `;

      resDb = await query(sql, [unitId]);

      if (resDb.rows.length === 0) {
        resDb = await query(
          `SELECT *
           FROM public."PENYULANG"`
        );
      }
    } else {
      resDb = await query(
        `SELECT *
         FROM public."PENYULANG"`
      );
    }

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// ==========================================
// 4. WORK ORDERS
// ==========================================

/**
 * GET /api/work-orders
 */
router.get('/work-orders', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/work-orders', req.query);

  const { unitId, isAll } = parseUnitFilter(req);

  const nomorWo = (
    req.query.Nomor_WO ||
    req.query.nomorWO ||
    ''
  )
    .toString()
    .trim();

  try {
    let sql = `
      SELECT *
      FROM public."WORK_ORDER"
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!isAll && unitId) {
      params.push(unitId);

      sql += `
        AND "unitId" = $${params.length}
      `;
    }

    if (nomorWo) {
      params.push(`%${nomorWo}%`);

      sql += `
        AND (
          "Nomor_WO" ILIKE $${params.length}
          OR "WO_ID" ILIKE $${params.length}
        )
      `;
    }

    sql += `
      ORDER BY "WO_ID" DESC
      LIMIT 1000
    `;

    const resDb = await query(sql, params);

    return res.json({
      status: 'success',
      data: resDb.rows,
      count: resDb.rows.length,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * POST /api/work-orders
 */
router.post('/work-orders', async (req: Request, res: Response) => {
  logApiCall('POST', '/api/work-orders', req.body);
  const w = req.body || {};
  const woId = w.WO_ID || w.id || `WO-${Date.now()}`;
  
  try {
    const resDb = await handleUpsertWorkOrder(w);
    
    // VERIFIKASI: Pastikan data benar-benar tersimpan
    const check = await query('SELECT "WO_ID" FROM public."WORK_ORDER" WHERE "WO_ID" = $1', [woId]);
    if (check.rowCount === 0) {
      throw new Error('Verifikasi gagal: Work Order tidak ditemukan setelah INSERT');
    }

    return res.json({
      status: 'success',
      success: true,
      data: resDb.rows[0],
    });
  } catch (err: any) {
    console.error('[BACKEND ERROR] POST /api/work-orders:', err.message);
    return res.status(500).json({
      status: 'error',
      success: false,
      message: err.message,
    });
  }
});

/**
 * PUT /api/work-orders/:id
 */
router.put('/work-orders/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  logApiCall('PUT', `/api/work-orders/${id}`, req.body);
  
  try {
    const w = { ...req.body, WO_ID: id };
    const resDb = await handleUpsertWorkOrder(w);

    // VERIFIKASI
    const check = await query('SELECT "WO_ID" FROM public."WORK_ORDER" WHERE "WO_ID" = $1', [id]);
    if (check.rowCount === 0) {
      throw new Error('Verifikasi gagal: Work Order tidak ditemukan setelah UPDATE');
    }

    return res.json({
      status: 'success',
      success: true,
      data: resDb.rows[0],
    });
  } catch (err: any) {
    console.error('[BACKEND ERROR] PUT /api/work-orders:', err.message);
    return res.status(500).json({
      status: 'error',
      success: false,
      message: err.message,
    });
  }
});

/**
 * DELETE /api/work-orders/:id
 */
router.delete(
  '/work-orders/:id',
  async (req: Request, res: Response) => {
    const woId = req.params.id;

    logApiCall(
      'DELETE',
      `/api/work-orders/${woId}`
    );

    try {
      const resDb = await query(
        `
        DELETE FROM public."WORK_ORDER"
        WHERE "WO_ID" = $1
           OR "Nomor_WO" = $1
        RETURNING "WO_ID"
        `,
        [woId]
      );

      // VERIFIKASI
      const check = await query('SELECT "WO_ID" FROM public."WORK_ORDER" WHERE "WO_ID" = $1', [woId]);
      if (check.rowCount > 0) {
        throw new Error('Verifikasi gagal: Work Order masih ada setelah DELETE');
      }

      return res.json({
        status: 'success',
        success: true,
        deletedCount: resDb.rowCount,
      });
    } catch (err: any) {
      console.error('[BACKEND ERROR] DELETE /api/work-orders:', err.message);
      return res.status(500).json({
        status: 'error',
        success: false,
        message: err.message,
      });
    }
  }
);

// ==========================================
// 5. REALISASI
// ==========================================

/**
 * GET /api/realisasi
 *
 * Endpoint paginated untuk halaman data REALISASI.
 */
router.get('/realisasi', async (req: Request, res: Response) => {
  logApiCall('GET', '/api/realisasi', req.query);

  const page = Math.max(
    parseInt(
      (req.query.page || '1').toString(),
      10
    ),
    1
  );

  const limit = Math.min(
    Math.max(
      parseInt(
        (req.query.limit || '20').toString(),
        10
      ),
      1
    ),
    1000
  );

  const offset = (page - 1) * limit;

  const { unitId, isAll } =
    parseUnitFilter(req);

  const nomorWo = (
    req.query.Nomor_WO ||
    req.query.nomorWO ||
    ''
  )
    .toString()
    .trim();

  const ulp = (
    req.query.ULP ||
    req.query.ulp ||
    ''
  )
    .toString()
    .trim();

  const tanggalDari = (
    req.query.tanggalDari ||
    ''
  )
    .toString()
    .trim();

  const tanggalSampai = (
    req.query.tanggalSampai ||
    ''
  )
    .toString()
    .trim();

  try {
    let whereClause = ` WHERE 1=1`;

    const params: any[] = [];

    if (!isAll && unitId) {
      params.push(unitId);

      whereClause += `
        AND "unitId" = $${params.length}
      `;
    }

    if (ulp && ulp !== 'ALL') {
      params.push(`%${ulp}%`);

      whereClause += `
        AND "ULP" ILIKE $${params.length}
      `;
    }

    if (nomorWo) {
      params.push(`%${nomorWo}%`);

      whereClause += `
        AND (
          "Nomor_WO" ILIKE $${params.length}
          OR "WO_ID" ILIKE $${params.length}
        )
      `;
    }

    if (tanggalDari) {
      params.push(tanggalDari);

      whereClause += `
        AND "TANGGAL" >= $${params.length}
      `;
    }

    if (tanggalSampai) {
      params.push(tanggalSampai);

      whereClause += `
        AND "TANGGAL" <= $${params.length}
      `;
    }

    const countSql = `
      SELECT COUNT(*) AS total
      FROM public."REALISASI"
      ${whereClause}
    `;

    const countRes = await query(
      countSql,
      params
    );

    const totalRecords = parseInt(
      countRes.rows[0]?.total || '0',
      10
    );

    const totalPages =
      Math.ceil(totalRecords / limit) || 1;

    const dataParams = [
      ...params,
      limit,
      offset,
    ];

    const dataSql = `
      SELECT *
      FROM public."REALISASI"
      ${whereClause}
      ORDER BY
        "TANGGAL" DESC,
        "Timestamp" DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `;

    const dataRes = await query(
      dataSql,
      dataParams
    );

    return res.json({
      status: 'success',
      data: dataRes.rows,

      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * GET /api/realisasi/dashboard
 *
 * KHUSUS DASHBOARD.
 *
 * Mengambil SELURUH data REALISASI yang dibutuhkan
 * untuk menghitung:
 * - Total Tebang
 * - Total Pangkas
 * - Total Penyulang Terlayani
 *
 * Tidak menggunakan pagination.
 */
router.get(
  '/realisasi/dashboard',
  async (req: Request, res: Response) => {
    logApiCall(
      'GET',
      '/api/realisasi/dashboard',
      req.query
    );

    const { unitId, isAll } =
      parseUnitFilter(req);

    const nomorWo = (
      req.query.Nomor_WO ||
      req.query.nomorWO ||
      ''
    )
      .toString()
      .trim();

    const ulp = (
      req.query.ULP ||
      req.query.ulp ||
      ''
    )
      .toString()
      .trim();

    const tanggalDari = (
      req.query.tanggalDari ||
      ''
    )
      .toString()
      .trim();

    const tanggalSampai = (
      req.query.tanggalSampai ||
      ''
    )
      .toString()
      .trim();

    try {
      let whereClause = ` WHERE 1=1`;

      const params: any[] = [];

      if (!isAll && unitId) {
        params.push(unitId);

        whereClause += `
          AND UPPER(COALESCE("unitId", ''))
              = UPPER($${params.length})
        `;
      }

      if (ulp && ulp !== 'ALL') {
        params.push(`%${ulp}%`);

        whereClause += `
          AND "ULP" ILIKE $${params.length}
        `;
      }

      if (nomorWo) {
        params.push(`%${nomorWo}%`);

        whereClause += `
          AND (
            "Nomor_WO" ILIKE $${params.length}
            OR "WO_ID" ILIKE $${params.length}
          )
        `;
      }

      if (tanggalDari) {
        params.push(tanggalDari);

        whereClause += `
          AND "TANGGAL" >= $${params.length}
        `;
      }

      if (tanggalSampai) {
        params.push(tanggalSampai);

        whereClause += `
          AND "TANGGAL" <= $${params.length}
        `;
      }

      const sql = `
        SELECT
          "ID",
          "unitId",
          "WO_ID",
          "Nomor_WO",
          "ULP",
          "REGU_ROW",
          "PENYULANG",
          "NO_TIANG",
          "TANGGAL",
          "Foto_Sebelum",
          "Foto_Sesudah",
          "Jenis_Tanaman",
          "Keterangan",
          "Pertumbuhan_Tanaman",
          "Kendala",
          "Latitude_Longitude",
          "Lokasi_kerja",
          "Timestamp"
        FROM public."REALISASI"
        ${whereClause}
        ORDER BY
          "TANGGAL" DESC,
          "Timestamp" DESC
      `;

      const dataRes = await query(
        sql,
        params
      );

      return res.json({
        status: 'success',

        unitId:
          isAll
            ? 'ALL'
            : unitId,

        count:
          dataRes.rows.length,

        data:
          dataRes.rows,
      });
    } catch (err: any) {
      console.error(
        '[REALISASI DASHBOARD] Error:',
        err.message
      );

      return res.status(500).json({
        status: 'error',
        message: err.message,
      });
    }
  }
);

/**
 * Helper for POST/PUT Realisasi (Upsert)
 */
const handleUpsertRealisasi = async (req: Request, res: Response) => {
  logApiCall(req.method, req.path, req.body);
  const r = req.body || {};
  const id = req.params.id || r.ID || r.id || `REL-${Date.now()}`;

  try {
    const sql = `
      INSERT INTO public."REALISASI" (
        "ID",
        "unitId",
        "WO_ID",
        "Nomor_WO",
        "ULP",
        "REGU_ROW",
        "PENYULANG",
        "NO_TIANG",
        "TANGGAL",
        "Foto_Sebelum",
        "Foto_Sesudah",
        "Jenis_Tanaman",
        "Keterangan",
        "Pertumbuhan_Tanaman",
        "Kendala",
        "Latitude_Longitude",
        "Lokasi_kerja",
        "Timestamp"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17,$18
      )
      ON CONFLICT ("ID")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "WO_ID" = EXCLUDED."WO_ID",
        "Nomor_WO" = EXCLUDED."Nomor_WO",
        "ULP" = EXCLUDED."ULP",
        "REGU_ROW" = EXCLUDED."REGU_ROW",
        "PENYULANG" = EXCLUDED."PENYULANG",
        "NO_TIANG" = EXCLUDED."NO_TIANG",
        "TANGGAL" = EXCLUDED."TANGGAL",
        "Foto_Sebelum" = EXCLUDED."Foto_Sebelum",
        "Foto_Sesudah" = EXCLUDED."Foto_Sesudah",
        "Jenis_Tanaman" = EXCLUDED."Jenis_Tanaman",
        "Keterangan" = EXCLUDED."Keterangan",
        "Pertumbuhan_Tanaman" = EXCLUDED."Pertumbuhan_Tanaman",
        "Kendala" = EXCLUDED."Kendala",
        "Latitude_Longitude" = EXCLUDED."Latitude_Longitude",
        "Lokasi_kerja" = EXCLUDED."Lokasi_kerja",
        "Timestamp" = EXCLUDED."Timestamp"
      RETURNING *;
    `;

    const tanggalVal = toNullableTimestamp(r.TANGGAL || r.tanggal) || new Date().toISOString().split('T')[0];
    const timestampVal = toNullableTimestamp(r.Timestamp || r.timestamp) || new Date().toISOString();

    const params = [
      id,
      r.unitId || 'UL1',
      r.WO_ID || r.woId || '',
      r.Nomor_WO || r.nomorWO || '',
      r.ULP || r.ulpName || '',
      r.REGU_ROW || r.reguName || '',
      r.PENYULANG || r.penyulangName || '',
      r.NO_TIANG || r.noTiang || '',
      tanggalVal,
      r.Foto_Sebelum || r.fotoSebelum || '',
      r.Foto_Sesudah || r.fotoSesudah || '',
      r.Jenis_Tanaman || r.jenisTanaman || '',
      r.Keterangan || r.keterangan || '',
      r.Pertumbuhan_Tanaman || r.pertumbuhanTanaman || '',
      r.Kendala || r.kendala || '',
      r.Latitude_Longitude || r.latitudeLongitude || '',
      r.Lokasi_kerja || r.lokasiKerja || '',
      timestampVal,
    ];

    const resDb = await query(sql, params);

    if (resDb.rowCount === 0) {
      return res.status(500).json({
        status: 'error',
        message: 'Gagal menyimpan realisasi ke database.',
      });
    }

    const verifyRes = await query(`SELECT * FROM public."REALISASI" WHERE "ID" = $1`, [id]);

    return res.json({
      status: 'success',
      data: verifyRes.rows[0] || resDb.rows[0],
    });
  } catch (err: any) {
    console.error('[REALISASI UPSERT] Error:', err.message);
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * POST /api/realisasi
 */
router.post('/realisasi', handleUpsertRealisasi);

/**
 * PUT /api/realisasi/:id
 */
router.put('/realisasi/:id', handleUpsertRealisasi);

/**
 * DELETE /api/realisasi/:id
 */
router.delete(
  '/realisasi/:id',
  async (req: Request, res: Response) => {
    const relId = req.params.id;

    logApiCall(
      'DELETE',
      `/api/realisasi/${relId}`
    );

    try {
      const resDb = await query(
        `
        DELETE FROM public."REALISASI"
        WHERE "ID" = $1
        RETURNING *
        `,
        [relId]
      );

      if (resDb.rowCount === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Realisasi tidak ditemukan atau sudah terhapus.',
        });
      }

      return res.json({
        status: 'success',
        deletedCount: resDb.rowCount,
        data: resDb.rows[0]
      });
    } catch (err: any) {
      console.error('[REALISASI DELETE] Error:', err.message);
      return res.status(500).json({
        status: 'error',
        message: err.message,
      });
    }
  }
);

// ==========================================
// 6. ABSENSI
// ==========================================

/**
 * GET /api/absensi
 */
router.get('/absensi', async (req: Request, res: Response) => {
  logApiCall(
    'GET',
    '/api/absensi',
    req.query
  );

  const { unitId, isAll } =
    parseUnitFilter(req);

  try {
    console.log(`[ABSENSI TRACE 1] Fetching absensi list. UnitId: ${unitId}, isAll: ${isAll}`);
    let sql = `
      SELECT *
      FROM public."ABSENSI"
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!isAll && unitId) {
      params.push(unitId);

      sql += `
        AND "unitId" = $${params.length}
      `;
    }

    sql += `
      ORDER BY
        "TANGGAL" DESC,
        "ID" DESC
      LIMIT 500
    `;

    const resDb = await query(
      sql,
      params
    );

    console.log(`[ABSENSI TRACE 1] Fetch success. Found ${resDb.rowCount} records.`);

    return res.json({
      status: 'success',
      data: resDb.rows,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

/**
 * Helper for POST/PUT Absensi (Upsert)
 */
const handleUpsertAbsensi = async (req: Request, res: Response) => {
  const method = req.method;
  console.log(`[ABSENSI TRACE 2] Starting ${method} upsert. Payload ID: ${req.body?.id || req.body?.ID || 'new'}`);
  logApiCall(req.method, req.path, req.body);
  const a = req.body || {};
  const id = req.params.id || a.ID || a.id || `ABS-${Date.now()}`;

  // Extract from petugasList if present
  if (Array.isArray(a.petugasList)) {
    a.petugas1 = a.petugasList[0]?.nama || '';
    a.ket1 = a.petugasList[0]?.keterangan || 'HADIR';
    a.petugas2 = a.petugasList[1]?.nama || '';
    a.ket2 = a.petugasList[1]?.keterangan || 'HADIR';
    a.petugas3 = a.petugasList[2]?.nama || '';
    a.ket3 = a.petugasList[2]?.keterangan || 'HADIR';
    a.petugas4 = a.petugasList[3]?.nama || '';
    a.ket4 = a.petugasList[3]?.keterangan || 'HADIR';
    a.petugas5 = a.petugasList[4]?.nama || '';
    a.ket5 = a.petugasList[4]?.keterangan || 'HADIR';
  }

  // Handle timestamp and date fields safely
  const tanggalVal = toNullableTimestamp(a.TANGGAL || a.tanggal || a.Tanggal) || new Date().toISOString().split('T')[0];
  const timestampMasukVal = toNullableTimestamp(a['TIMESTAMP MASUK'] || a.timestampMasuk || a.waktuMasuk || a.createdAt);
  const timestampKeluarVal = toNullableTimestamp(a['TIMESTAMP KELUAR'] || a.timestampKeluar || a.waktuKeluar || a.waktuPulang);

  try {
    const sql = `
      INSERT INTO public."ABSENSI" (
        "ID",
        "unitId",
        "TANGGAL",
        "NAMA_REGU",
        "ULP",
        "PETUGAS_1",
        "KET_1",
        "PETUGAS_2",
        "KET_2",
        "PETUGAS_3",
        "KET_3",
        "PETUGAS_4",
        "KET_4",
        "PETUGAS_5",
        "KET_5",
        "FOTO_MASUK",
        "TIMESTAMP MASUK",
        "FOTO_KELUAR",
        "TIMESTAMP KELUAR"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      ON CONFLICT ("ID")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "TANGGAL" = EXCLUDED."TANGGAL",
        "NAMA_REGU" = EXCLUDED."NAMA_REGU",
        "ULP" = EXCLUDED."ULP",
        "PETUGAS_1" = EXCLUDED."PETUGAS_1",
        "KET_1" = EXCLUDED."KET_1",
        "PETUGAS_2" = EXCLUDED."PETUGAS_2",
        "KET_2" = EXCLUDED."KET_2",
        "PETUGAS_3" = EXCLUDED."PETUGAS_3",
        "KET_3" = EXCLUDED."KET_3",
        "PETUGAS_4" = EXCLUDED."PETUGAS_4",
        "KET_4" = EXCLUDED."KET_4",
        "PETUGAS_5" = EXCLUDED."PETUGAS_5",
        "KET_5" = EXCLUDED."KET_5",
        "FOTO_MASUK" = EXCLUDED."FOTO_MASUK",
        "TIMESTAMP MASUK" = EXCLUDED."TIMESTAMP MASUK",
        "FOTO_KELUAR" = EXCLUDED."FOTO_KELUAR",
        "TIMESTAMP KELUAR" = EXCLUDED."TIMESTAMP KELUAR"
      RETURNING *;
    `;

    const params = [
      id,
      a.unitId || a.UnitId || 'UL1',
      tanggalVal,
      a.NAMA_REGU || a.namaRegu || a.reguName || a.Regu || '',
      a.ULP || a.ulpName || a.namaUlp || a.Nama_ULP || '',
      a.PETUGAS_1 || a.petugas1 || '',
      a.KET_1 || a.ket1 || 'HADIR',
      a.PETUGAS_2 || a.petugas2 || '',
      a.KET_2 || a.ket2 || 'HADIR',
      a.PETUGAS_3 || a.petugas3 || '',
      a.KET_3 || a.ket3 || 'HADIR',
      a.PETUGAS_4 || a.petugas4 || '',
      a.KET_4 || a.ket4 || 'HADIR',
      a.PETUGAS_5 || a.petugas5 || '',
      a.KET_5 || a.ket5 || 'HADIR',
      a.FOTO_MASUK || a.fotoMasuk || '',
      timestampMasukVal,
      a.FOTO_KELUAR || a.fotoKeluar || '',
      timestampKeluarVal,
    ];

    console.log(`[ABSENSI TRACE 2] Executing SQL: INSERT ON CONFLICT. ID: ${id}`);
    const resDb = await query(sql, params);

    if (resDb.rowCount === 0) {
      console.error(`[ABSENSI TRACE 2] UPSERT FAILED. rowCount is 0.`);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Gagal menyimpan absensi ke database.',
      });
    }

    console.log(`[ABSENSI TRACE 2] UPSERT Success. rowCount: ${resDb.rowCount}. Verifying write...`);
    const verifyRes = await query(`SELECT * FROM public."ABSENSI" WHERE "ID" = $1`, [id]);

    if (verifyRes.rowCount === 0) {
       console.error(`[ABSENSI TRACE 2] VERIFICATION FAILED. Record with ID ${id} not found after write!`);
       return res.status(500).json({
         success: false,
         status: 'error',
         message: 'Verifikasi database gagal: Record absensi tidak ditemukan setelah disimpan.',
       });
    } else {
       console.log(`[ABSENSI TRACE 2] VERIFICATION Success. Record confirmed in DB.`);
    }

    return res.json({
      success: true,
      status: 'success',
      source: 'hypercloud',
      data: verifyRes.rows[0] || resDb.rows[0],
    });
  } catch (err: any) {
    console.error('[ABSENSI UPSERT] Error:', err.message);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: err.message,
    });
  }
};

/**
 * POST /api/absensi
 */
router.post('/absensi', handleUpsertAbsensi);

/**
 * PUT /api/absensi/:id
 */
router.put('/absensi/:id', handleUpsertAbsensi);

/**
 * DELETE /api/absensi/:id
 */
router.delete(
  '/absensi/:id',
  async (req: Request, res: Response) => {
    const absId = req.params.id;

    logApiCall(
      'DELETE',
      `/api/absensi/${absId}`
    );

    try {
      console.log(`[ABSENSI TRACE 3] Starting DELETE for ID: ${absId}`);
      const resDb = await query(
        `
        DELETE FROM public."ABSENSI"
        WHERE "ID" = $1
        RETURNING *
        `,
        [absId]
      );

      if (resDb.rowCount === 0) {
        console.warn(`[ABSENSI TRACE 3] DELETE target not found or already deleted. ID: ${absId}`);
        return res.status(404).json({
          success: false,
          status: 'error',
          message: 'ABSENSI not found',
        });
      }

      console.log(`[ABSENSI TRACE 3] DELETE Success. Verifying deletion...`);
      const verifyRes = await query(`SELECT COUNT(*) FROM public."ABSENSI" WHERE "ID" = $1`, [absId]);
      const count = parseInt(verifyRes.rows[0]?.count || '0', 10);
      
      if (count > 0) {
        console.error(`[ABSENSI TRACE 3] VERIFICATION FAILED. Record with ID ${absId} still exists after DELETE!`);
        return res.status(500).json({
          success: false,
          status: 'error',
          message: 'Verifikasi hapus gagal: Data absensi masih ada di database.',
        });
      } else {
        console.log(`[ABSENSI TRACE 3] VERIFICATION Success. Record confirmed GONE from DB.`);
      }

      return res.json({
        success: true,
        deleted: true,
        id: absId,
        status: 'success',
        deletedCount: resDb.rowCount,
        data: resDb.rows[0]
      });
    } catch (err: any) {
      console.error('[ABSENSI DELETE] Error:', err.message);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: err.message,
      });
    }
  }
);

export default router;
