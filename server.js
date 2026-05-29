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

const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const zlib       = require('zlib');
const AdmZip     = require('adm-zip');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: ['https://panoramicsuites.com', 'http://localhost:3000'] }));

// ============================================================
// CREDENCIALES SES.HOSPEDAJES  ⚠️ Cambia la contraseña tras el despliegue
// ============================================================
const SES = {
  usuario:               process.env.SES_USER     || 'B70697537WS',
  password:              process.env.SES_PASSWORD  || 'lQDkG??3',
  codigoArrendador:      process.env.SES_ARRENDADOR     || '0000229666',
  codigoEstablecimiento: process.env.SES_ESTABLECIMIENTO || '0000368319',
  endpoint:             'https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion',
};

// ============================================================
// CONFIGURACIÓN DE EMAIL
// ============================================================
// Opciones para el transporte SMTP. Rellena con los datos de tu
// servidor de correo o proveedor (ver sección SMTP más abajo).
const MAIL_CONFIG = {
  host:   process.env.SMTP_HOST   || 'mail.panoramicsuites.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' ? true : (Number(process.env.SMTP_PORT) === 465),
  auth: {
    user: process.env.SMTP_USER || 'info@panoramicsuites.com',
    pass: process.env.SMTP_PASS || 'TU_CONTRASEÑA_SMTP',
  },
  tls: { rejectUnauthorized: false },
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
// XML BUILDER — formato oficial SES.Hospedajes v3.1.2
// ============================================================
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function fmtDate(d) { return (d||'').replace(/-/g,''); } // YYYYMMDD

// Códigos de tipo de documento según catálogo SES
const DOC_CODES = {
  DNI: 'NIF',   // Documento Nacional de Identidad
  NIE: 'NIE',   // Número de Identificación de Extranjero
  PAS: 'PAS',   // Pasaporte
  OTR: 'OTR'   // Otro documento
};

function buildXML(data) {
  const { reserva: r, viajeros } = data;

  const vXML = viajeros.map((v, i) => {
    const tipoDoc = DOC_CODES[v.tipo_documento] || 'OTR';
    const esNacES  = v.nacionalidad_iso === 'ESP';
    const esDNI    = v.tipo_documento === 'DNI';
    const esNIE    = v.tipo_documento === 'NIE';
    const needsAddr = esNacES || esDNI;

    // Segundo apellido obligatorio para NIF y NIE
    const segundoAp = v.segundo_apellido
      ? `<segundoApellido>${esc(v.segundo_apellido.toUpperCase())}</segundoApellido>`
      : (esDNI || esNIE) ? `<segundoApellido></segundoApellido>` : '';

    // Número de soporte solo para DNI y NIE
    const soporte = (esDNI || esNIE) && v.num_soporte
      ? `<numeroSoporte>${esc(v.num_soporte.toUpperCase())}</numeroSoporte>`
      : '';

    // Dirección para nacionales españoles
    const domicilio = needsAddr && v.direccion ? `
        <domicilio>
          <direccion>${esc(v.direccion)}</direccion>
          ${v.municipio     ? `<municipio>${esc(v.municipio)}</municipio>`         : ''}
          ${v.codigo_postal ? `<codigoPostal>${esc(v.codigo_postal)}</codigoPostal>` : ''}
          ${v.provincia     ? `<provincia>${esc(v.provincia)}</provincia>`         : ''}
          <pais>ESP</pais>
        </domicilio>` : '';

    const parentesco = v.es_menor && v.relacion
      ? `<parentesco>${esc(v.relacion)}</parentesco>` : '';

    return `
      <persona>
        <rol>V</rol>
        <tipoDocumento>${tipoDoc}</tipoDocumento>
        ${v.num_documento ? `<numeroDocumento>${esc(v.num_documento.toUpperCase())}</numeroDocumento>` : ''}
        ${soporte}
        <nombre>${esc(v.nombre.toUpperCase())}</nombre>
        <primerApellido>${esc(v.primer_apellido.toUpperCase())}</primerApellido>
        ${segundoAp}
        <fechaNacimiento>${fmtDate(v.fecha_nacimiento)}</fechaNacimiento>
        <sexo>${v.sexo === 'M' ? 'H' : 'M'}</sexo>
        <nacionalidad>${v.nacionalidad_iso || 'OTR'}</nacionalidad>
        ${v.telefono ? `<telefono>${esc(v.telefono)}</telefono>` : ''}
        ${v.email    ? `<correo>${esc(v.email)}</correo>`        : ''}
        ${domicilio}
        ${parentesco}
      </persona>`;
  }).join('');

  // Bloque pago
  const pagoCodigo = {
    'Tarjeta de crédito/débito': 'TARJETA',
    'Transferencia bancaria': 'TRANSFERENCIA',
    'Bizum': 'BIZUM',
    'Efectivo': 'EFECTIVO',
  }[r.metodo_pago] || 'OTROS';

  const pagoBloque = r.metodo_pago ? `
    <pago>
      <tipoPago>${pagoCodigo}</tipoPago>
    </pago>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<peticion xmlns="http://www.administracion.gob.es/mir/hospedajes">
  <cabecera>
    <codigoArrendador>${SES.codigoArrendador}</codigoArrendador>
    <tipoComunicacion>P</tipoComunicacion>
  </cabecera>
  <comunicaciones>
    <comunicacion>
      <referencia>${esc(r.referencia)}</referencia>
      <codigoEstablecimiento>${SES.codigoEstablecimiento}</codigoEstablecimiento>
      <fechaContrato>${fmtDate(r.fecha_contrato)}</fechaContrato>
      <fechaEntrada>${fmtDate(r.fecha_entrada)}</fechaEntrada>
      <horaEntrada>1700</horaEntrada>
      <fechaSalida>${fmtDate(r.fecha_salida)}</fechaSalida>
      <horaSalida>1100</horaSalida>
      <numHabitaciones>1</numHabitaciones>
      <numPersonas>${viajeros.length}</numPersonas>
      ${pagoBloque}
      <personas>${vXML}
      </personas>
    </comunicacion>
  </comunicaciones>
</peticion>`;
}

// ============================================================
// ENVÍO A SES
// ============================================================
async function sendToSES(xml) {
  const token = Buffer.from(`${SES.usuario}:${SES.password}`).toString('base64');

  // SES requires XML compressed as ZIP and encoded in Base64
  const zip = new AdmZip();
  zip.addFile('comunicacion.xml', Buffer.from(xml, 'utf8'));
  const zipBuffer = zip.toBuffer();
  const base64Zip = zipBuffer.toString('base64');

  // Build the SOAP/REST envelope with the Base64 content
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<peticion xmlns="http://hospedajes.ses.mir.es/hospedajes">
  <cabecera>
    <codigoArrendador>${SES.codigoArrendador}</codigoArrendador>
    <tipoPeticion>ALTA</tipoPeticion>
    <tipoComunicacion>P</tipoComunicacion>
  </cabecera>
  <solicitud>${base64Zip}</solicitud>
</peticion>`;

  console.log('[SES envelope length]', body.length);

  const res = await fetch(SES.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Authorization': `Basic ${token}`,
    },
    body: body,
  });
  const responseText = await res.text();
  console.log(`[SES] ${res.status} — ${responseText.substring(0,1000)}`);
  return { ok: res.ok, status: res.status, body: responseText };
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
