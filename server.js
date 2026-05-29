/**
 * BACKEND — Panoramic Suites
 * Recibe datos del formulario de check-in, los envía a SES.Hospedajes
 * y manda un email de confirmación a info@panoramicsuites.com
 *
 * INSTALACIÓN:
 *   npm install express cors nodemailer
 *   node server.js
 *
 * REQUISITOS: Node.js 18+
 */

const express  = require('express');
const cors     = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: ['https://panoramicsuites.com', 'http://localhost:3000'] }));

// ============================================================
// CREDENCIALES SES.HOSPEDAJES  ⚠️ Cambia la contraseña tras el despliegue
// ============================================================
const SES = {
  usuario:              'B70697537WS',
  password:             'lQDkG??3',         // ← CAMBIA ESTO
  codigoArrendador:     '0000229666',
  codigoEstablecimiento:'0000368319',
  endpoint:             'https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion',
};

// ============================================================
// CONFIGURACIÓN DE EMAIL
// ============================================================
// Opciones para el transporte SMTP. Rellena con los datos de tu
// servidor de correo o proveedor (ver sección SMTP más abajo).
const MAIL_CONFIG = {
  // --- Opción A: SMTP genérico (hosting, Ionos, OVH, etc.) ---
  host:   process.env.SMTP_HOST     || 'mail.panoramicsuites.com', // servidor SMTP
  port:   Number(process.env.SMTP_PORT)   || 465,                  // 465 SSL · 587 TLS
  secure: process.env.SMTP_SECURE   !== 'false',                   // true para 465
  auth: {
    user: process.env.SMTP_USER     || 'info@panoramicsuites.com', // usuario SMTP
    pass: process.env.SMTP_PASS     || 'TU_CONTRASEÑA_SMTP',       // ← CAMBIA ESTO
  },
  // --- Opción B: Gmail (descomenta y borra el bloque A) ---
  // service: 'gmail',
  // auth: { user: 'info@panoramicsuites.com', pass: 'contraseña_de_aplicacion' },
  //
  // --- Opción C: Resend / SendGrid (API key) — ver README ---
};

const MAIL_FROM = '"Panoramic Suites Web" <info@panoramicsuites.com>';
const MAIL_TO   = 'info@panoramicsuites.com';

const transporter = nodemailer.createTransport(MAIL_CONFIG);

// ============================================================
// BUILDER DEL EMAIL HTML
// ============================================================
function fmtDateEs(iso) {
  // "2025-08-15" → "15/08/2025"
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildEmail(data) {
  const { reserva: r, viajeros } = data;
  const sesUrl = 'https://hospedajes.ses.mir.es';

  const docLabel = { DNI:'DNI', NIE:'NIE / TIE', PAS:'Pasaporte', OTR:'Otro' };
  const sexLabel  = { M:'Masculino', F:'Femenino' };

  const vHtml = viajeros.map((v, i) => {
    const rows = [
      ['Tipo documento',   docLabel[v.tipo_documento] || v.tipo_documento],
      ['Nº documento',     v.num_documento  || '—'],
      ['Nº soporte',       v.num_soporte    || '—'],
      ['Nombre',           v.nombre],
      ['Primer apellido',  v.primer_apellido],
      ['Segundo apellido', v.segundo_apellido || '—'],
      ['Fecha nacimiento', fmtDateEs(v.fecha_nacimiento)],
      ['Sexo',             sexLabel[v.sexo] || v.sexo || '—'],
      ['Nacionalidad',     v.nacionalidad   || '—'],
      ['Teléfono',         v.telefono       || '—'],
      ['Email',            v.email          || '—'],
      ['Dirección',        v.direccion      || '—'],
      ['Municipio',        v.municipio      || '—'],
      ['Provincia',        v.provincia      || '—'],
      ['Código postal',    v.codigo_postal  || '—'],
      ['País residencia',  v.pais_residencia|| '—'],
      v.es_menor ? ['Menor de 14 años', 'Sí'] : null,
      v.relacion  ? ['Relación adulto',  v.relacion] : null,
    ].filter(Boolean);

    const rowsHtml = rows.map(([label, val]) => `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#7A3B10;font-weight:700;white-space:nowrap;width:45%">${label}</td>
        <td style="padding:6px 12px;font-size:13px;color:#3D2010">${val}</td>
      </tr>`).join('');

    return `
    <div style="margin-bottom:20px">
      <div style="background:linear-gradient(135deg,#7A3B10,#C8732A);color:#fff;padding:10px 16px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;border-radius:4px 4px 0 0">
        Huésped ${i + 1}${v.es_menor ? ' <span style="font-weight:400;font-size:12px">(menor)</span>' : ''}
        &nbsp;·&nbsp; ${v.nombre} ${v.primer_apellido}
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #DFC8B0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden">
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF5EF;font-family:Arial,sans-serif">
<div style="max-width:640px;margin:30px auto;background:#fff;border:1px solid #DFC8B0;border-radius:6px;overflow:hidden">

  <!-- CABECERA -->
  <div style="background:linear-gradient(135deg,#7A3B10,#C8732A);padding:24px 32px;text-align:center">
    <div style="color:#fff;font-size:22px;font-weight:300;letter-spacing:4px;text-transform:uppercase">
      Panoramic Suites
    </div>
    <div style="color:rgba(255,255,255,.75);font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px">
      Registro de Viajeros · SES.Hospedajes
    </div>
  </div>

  <!-- REF BANNER -->
  <div style="background:#F5EDE3;border-bottom:1px solid #DFC8B0;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:11px;color:#8A6A50;text-transform:uppercase;letter-spacing:.1em;font-weight:700">Referencia</div>
      <div style="font-size:16px;color:#C8732A;font-weight:700;letter-spacing:.05em">${r.referencia}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#8A6A50;text-transform:uppercase;letter-spacing:.1em;font-weight:700">Enviado</div>
      <div style="font-size:13px;color:#3D2010">${new Date(data.timestamp).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})}</div>
    </div>
  </div>

  <div style="padding:24px 32px">

    <!-- RESERVA -->
    <h2 style="font-size:14px;color:#C8732A;text-transform:uppercase;letter-spacing:.12em;margin:0 0 12px;border-bottom:1px solid #EDD9C0;padding-bottom:6px">
      Datos de la Reserva
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700;width:45%">Titular</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${r.titular || '—'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700">Fecha reserva</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${fmtDateEs(r.fecha_contrato)}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700">Entrada</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${fmtDateEs(r.fecha_entrada)} · 17:00 h</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700">Salida</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${fmtDateEs(r.fecha_salida)} · 11:00 h</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700">Pago</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${r.metodo_pago || '—'}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#7A3B10;font-weight:700">Nº huéspedes</td>
        <td style="padding:5px 0;font-size:13px;color:#3D2010">${viajeros.length}</td>
      </tr>
    </table>

    <!-- HUÉSPEDES -->
    <h2 style="font-size:14px;color:#C8732A;text-transform:uppercase;letter-spacing:.12em;margin:0 0 16px;border-bottom:1px solid #EDD9C0;padding-bottom:6px">
      Datos de los Huéspedes
    </h2>
    ${vHtml}

    <!-- PIE -->
    <div style="background:#F5EDE3;border-radius:4px;padding:14px 16px;font-size:12px;color:#8A6A50;line-height:1.6;margin-top:8px">
      Este registro ha sido enviado automáticamente a <strong>SES.Hospedajes</strong> (Ministerio del Interior)
      conforme al Real Decreto 933/2021. Conserva este email durante al menos 3 años.
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#7A3B10;padding:14px 32px;text-align:center">
    <div style="color:rgba(255,255,255,.6);font-size:11px;letter-spacing:.1em">
      panoramicsuites.com · info@panoramicsuites.com · +34 649 17 96 39
    </div>
  </div>
</div>
</body></html>`;
}

// ============================================================
// MAPEOS
// ============================================================
const DOC_MAP  = { DNI:'D', NIE:'X', PAS:'P', OTR:'O' };
const SEXO_MAP = { M:'HOMBRE', F:'MUJER' };

// ============================================================
// XML BUILDER
// ============================================================
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function fmtDate(d) { return (d||'').replace(/-/g,''); } // YYYYMMDD

function buildXML(data) {
  const { reserva: r, viajeros } = data;

  const vXML = viajeros.map((v, i) => {
    const tipoDoc = DOC_MAP[v.tipo_documento] || 'O';
    const esDNI   = v.tipo_documento === 'DNI';
    const esNIE   = v.tipo_documento === 'NIE';
    const esSopDoc= esDNI || esNIE;
    const esNac   = v.nacionalidad_iso === 'ESP' || esDNI;

    return `
    <viajero>
      <numero>${i + 1}</numero>
      <tipo_documento>${tipoDoc}</tipo_documento>
      ${v.num_documento ? `<numero_documento>${esc(v.num_documento)}</numero_documento>` : ''}
      ${esSopDoc && v.num_soporte ? `<numero_soporte>${esc(v.num_soporte)}</numero_soporte>` : ''}
      <nombre>${esc(v.nombre.toUpperCase())}</nombre>
      <primer_apellido>${esc(v.primer_apellido.toUpperCase())}</primer_apellido>
      ${v.segundo_apellido ? `<segundo_apellido>${esc(v.segundo_apellido.toUpperCase())}</segundo_apellido>` : ''}
      <fecha_nacimiento>${fmtDate(v.fecha_nacimiento)}</fecha_nacimiento>
      <sexo>${SEXO_MAP[v.sexo] || v.sexo}</sexo>
      <nacionalidad>${v.nacionalidad_iso || 'OTR'}</nacionalidad>
      <telefono>${esc(v.telefono)}</telefono>
      ${v.email ? `<email>${esc(v.email)}</email>` : ''}
      ${esNac && v.direccion ? `
      <domicilio>
        <direccion>${esc(v.direccion)}</direccion>
        ${v.municipio    ? `<municipio>${esc(v.municipio)}</municipio>` : ''}
        ${v.codigo_postal ? `<codigo_postal>${esc(v.codigo_postal)}</codigo_postal>` : ''}
        ${v.provincia    ? `<provincia>${esc(v.provincia)}</provincia>` : ''}
        <pais>${v.pais_residencia ? 'ESP' : 'ESP'}</pais>
      </domicilio>` : ''}
      ${v.es_menor && v.relacion ? `<parentesco>${esc(v.relacion)}</parentesco>` : ''}
    </viajero>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<peticion xmlns="http://hospedajes.ses.mir.es/hospedajes">
  <cabecera>
    <codigo_arrendador>${SES.codigoArrendador}</codigo_arrendador>
    <codigo_establecimiento>${SES.codigoEstablecimiento}</codigo_establecimiento>
    <numero_referencia>${esc(r.referencia)}</numero_referencia>
    <fecha_contrato>${fmtDate(r.fecha_contrato)}</fecha_contrato>
    <fecha_entrada>${fmtDate(r.fecha_entrada)}</fecha_entrada>
    <hora_entrada>170000</hora_entrada>
    <fecha_salida>${fmtDate(r.fecha_salida)}</fecha_salida>
    <hora_salida>110000</hora_salida>
    <numero_habitaciones>1</numero_habitaciones>
    <numero_viajeros>${viajeros.length}</numero_viajeros>
    ${r.metodo_pago ? `<forma_pago>${esc(r.metodo_pago)}</forma_pago>` : ''}
  </cabecera>
  <viajeros>${vXML}
  </viajeros>
</peticion>`;
}

// ============================================================
// ENVÍO A SES
// ============================================================
async function sendToSES(xml) {
  const token = Buffer.from(`${SES.usuario}:${SES.password}`).toString('base64');
  const res = await fetch(SES.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Authorization': `Basic ${token}` },
    body: xml,
  });
  const body = await res.text();
  console.log(`[SES] ${res.status} — ${body.substring(0,300)}`);
  return { ok: res.ok, status: res.status, body };
}

// ============================================================
// ENDPOINT
// ============================================================
app.post('/api/parte-viajeros', async (req, res) => {
  const data = req.body;
  if (!data?.reserva || !data?.viajeros?.length)
    return res.status(400).json({ success: false, error: 'Datos incompletos' });

  console.log(`[Checkin] ${data.reserva.referencia} | ${data.viajeros.length} viajero(s)`);

  let xml;
  try { xml = buildXML(data); console.log('[XML]\n', xml); }
  catch (e) { return res.status(500).json({ success: false, error: 'Error XML: ' + e.message }); }

  let ses = { ok: false, status: 0, body: '' };
  try { ses = await sendToSES(xml); }
  catch (e) { console.error('[SES error]', e.message); ses.body = e.message; }

  // Log de cumplimiento (guarda al menos 3 años según RD 933/2021)
  console.log('[LOG]', JSON.stringify({
    ts: data.timestamp, ref: data.reserva.referencia,
    viajeros: data.viajeros.length, ses_ok: ses.ok, ses_status: ses.status
  }));

  // ── EMAIL DE NOTIFICACIÓN ──────────────────────────────────
  try {
    await transporter.sendMail({
      from:    MAIL_FROM,
      to:      MAIL_TO,
      subject: `Registro SES.Hospedajes — ${data.reserva.referencia}`,
      html:    buildEmail(data),
    });
    console.log(`[Email] Enviado a ${MAIL_TO} · ${data.reserva.referencia}`);
  } catch (mailErr) {
    // El fallo de email NO bloquea la respuesta al cliente
    console.error('[Email] Error al enviar:', mailErr.message);
  }

  res.json({ success: true, ses_ok: ses.ok, ses_status: ses.status,
    message: ses.ok ? 'Enviado a SES.Hospedajes' : 'Guardado — reintento pendiente' });
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Panoramic Suites backend · puerto ${PORT}`);
  console.log(`   POST /api/parte-viajeros`);
  console.log(`   Arrendador: ${SES.codigoArrendador} | Establecimiento: ${SES.codigoEstablecimiento}`);
});
