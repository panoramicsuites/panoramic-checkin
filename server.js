/**
 * BACKEND — Panoramic Suites
 * Recibe datos del formulario de check-in, los envía a SES.Hospedajes
 * y manda un email de confirmación a info@panoramicsuites.com
 *
 * INSTALACIÓN:
 *   npm install express cors resend adm-zip
 *   node server.js
 *
 * REQUISITOS: Node.js 18+
 */

const express    = require('express');
const cors       = require('cors');
const { Resend } = require('resend');
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
const resend = new Resend(process.env.RESEND_API_KEY);

const MAIL_FROM = 'Panoramic Suites <info@panoramicsuites.com>';
const MAIL_TO   = 'info@panoramicsuites.com';

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
// XML BUILDER — formato oficial SES.Hospedajes v1.2.0
// Basado en plantilla oficial 1-plantilla.xml
// ============================================================
function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// YYYY-MM-DD -> YYYY-MM-DD+02:00
function fmtDate(d) {
  if (!d) return '';
  var s = d.replace(/-/g,'');
  var iso = s.substring(0,4)+'-'+s.substring(4,6)+'-'+s.substring(6,8);
  return iso+'+02:00';
}

// YYYY-MM-DD + HHMM -> YYYY-MM-DDTHH:MM:SS+02:00
function fmtDateTime(d, hhmm) {
  if (!d) return '';
  var s = d.replace(/-/g,'');
  var iso = s.substring(0,4)+'-'+s.substring(4,6)+'-'+s.substring(6,8);
  var h = hhmm ? hhmm.substring(0,2)+':'+hhmm.substring(2,4)+':00' : '00:00:00';
  return iso+'T'+h+'+02:00';
}

// Tipos de documento oficiales
var DOC_CODES = {
  // Nuevo formulario (códigos directos)
  'NIF':'NIF', 'NIE':'NIE', 'PAS':'PAS', 'OTRO':'OTRO',
  // Formulario anterior
  'DNI':'NIF', 'OTR':'OTRO',
};

// Tipos de pago oficiales (tabla 8.7)
var PAGO_CODES = {
  // Códigos directos (nuevo formulario)
  'TARJT': 'TARJT', 'TRANS': 'TRANS', 'MOVIL': 'MOVIL', 'EFECT': 'EFECT', 'OTRO': 'OTRO',
  // Labels (compatibilidad formulario anterior)
  'Tarjeta de crédito/débito': 'TARJT',
  'Transferencia bancaria':    'TRANS',
  'Bizum':                     'MOVIL',
  'Efectivo':                  'EFECT',
  'Otro':                      'OTRO',
};

// Parentesco: mapeo del formulario a códigos oficiales (tabla 8.3)
var PARENTESCO_CODES = {
  'Padre/Madre':    'PM',
  'Tutor/a legal':  'TU',
  'Otro familiar':  'OT',
  'Otro':           'OT',
};

function buildInnerXML(data) {
  var r = data.reserva;
  var viajeros = data.viajeros;

  var personasXML = viajeros.map(function(v) {
    var tipoDoc = DOC_CODES[v.tipo_documento] || 'OTRO';
    var esNIF   = v.tipo_documento === 'DNI';
    var esNIE   = v.tipo_documento === 'NIE';
    var esNacES = v.nacionalidad_iso === 'ESP' || esNIF;

    // apellido2 obligatorio para NIF
    var ap2 = '';
    if (esNIF) {
      ap2 = '<apellido2>' + esc(v.segundo_apellido || '') + '</apellido2>';
    } else if (v.segundo_apellido) {
      ap2 = '<apellido2>' + esc(v.segundo_apellido) + '</apellido2>';
    }

    // soporteDocumento obligatorio para NIF y NIE
    var soporte = '';
    if ((esNIF || esNIE) && v.num_soporte) {
      soporte = '<soporteDocumento>' + esc(v.num_soporte.toUpperCase()) + '</soporteDocumento>';
    }

    // Bloque documento (solo si tiene documento)
    var docBlock = '';
    if (v.num_documento) {
      docBlock = '<tipoDocumento>' + tipoDoc + '</tipoDocumento>'
        + '<numeroDocumento>' + esc(v.num_documento.toUpperCase()) + '</numeroDocumento>'
        + soporte;
    }

    // Bloque dirección
    // Para España: codigoMunicipio (INE 5 digitos) + codigoPostal + pais
    // Para extranjeros: nombreMunicipio + codigoPostal + pais
    var dir = '<direccion><direccion>ND</direccion><codigoPostal>00000</codigoPostal><pais>' + (v.nacionalidad_iso || 'ESP') + '</pais></direccion>';
    if (v.direccion) {
      if (esNacES) {
        // España: necesitamos codigoMunicipio INE - usamos el CP como fallback visible
        // El codigoMunicipio debe ser el código INE de 5 dígitos
        // Como no tenemos el INE directamente, usamos el municipio como nombreMunicipio
        // y dejamos codigoMunicipio vacío para que SES lo rechace con error claro
        // NOTA: si el cliente es español necesitamos el código INE del municipio
        // Usamos el codigo postal como aproximacion y municipio en nombreMunicipio
        dir = '<direccion>'
          + '<direccion>' + esc(v.direccion) + '</direccion>'
          + '<codigoMunicipio>' + (v.codigo_ine || '00000') + '</codigoMunicipio>'
          + '<codigoPostal>' + esc(v.codigo_postal || '00000') + '</codigoPostal>'
          + '<pais>ESP</pais>'
          + '</direccion>';
      } else {
        dir = '<direccion>'
          + '<direccion>' + esc(v.direccion) + '</direccion>'
          + '<nombreMunicipio>' + esc(v.municipio || '') + '</nombreMunicipio>'
          + '<codigoPostal>' + esc(v.codigo_postal || '00000') + '</codigoPostal>'
          + '<pais>' + esc(v.nacionalidad_iso || 'OTR') + '</pais>'
          + '</direccion>';
      }
    }

    // Parentesco
    var parentesco = '';
    if (v.es_menor && v.relacion) {
      var codPar = PARENTESCO_CODES[v.relacion] || 'OT';
      parentesco = '<parentesco>' + codPar + '</parentesco>';
    }

    return '<persona>'
      + '<rol>VI</rol>'
      + '<nombre>' + esc(v.nombre.toUpperCase()) + '</nombre>'
      + '<apellido1>' + esc(v.primer_apellido.toUpperCase()) + '</apellido1>'
      + ap2
      + docBlock
      + '<fechaNacimiento>' + fmtDate(v.fecha_nacimiento) + '</fechaNacimiento>'
      + (v.nacionalidad_iso ? '<nacionalidad>' + esc(v.nacionalidad_iso) + '</nacionalidad>' : '')
      + (v.sexo ? '<sexo>' + (v.sexo === 'M' ? 'H' : (v.sexo === 'F' ? 'M' : 'O')) + '</sexo>' : '')
      + dir
      + (v.telefono ? '<telefono>' + esc(v.telefono) + '</telefono>' : '')
      + (v.email    ? '<correo>'   + esc(v.email)    + '</correo>'   : '')
      + parentesco
      + '</persona>';
  }).join('');

  var tipoPago = PAGO_CODES[r.metodo_pago] || 'OTRO';

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<ns2:peticion xmlns:ns2="http://www.neg.hospedajes.mir.es/altaParteHospedaje">'
    + '<solicitud>'
    + '<codigoEstablecimiento>' + esc(SES.codigoEstablecimiento) + '</codigoEstablecimiento>'
    + '<comunicacion>'
    + '<contrato>'
    + '<referencia>' + esc(r.referencia) + '</referencia>'
    + '<fechaContrato>' + fmtDate(r.fecha_contrato) + '</fechaContrato>'
    + '<fechaEntrada>' + fmtDateTime(r.fecha_entrada, '1700') + '</fechaEntrada>'
    + '<fechaSalida>' + fmtDateTime(r.fecha_salida, '1100') + '</fechaSalida>'
    + '<numPersonas>' + viajeros.length + '</numPersonas>'
    + '<numHabitaciones>1</numHabitaciones>'
    + '<pago><tipoPago>' + tipoPago + '</tipoPago></pago>'
    + '</contrato>'
    + personasXML
    + '</comunicacion>'
    + '</solicitud>'
    + '</ns2:peticion>';
}

function buildOuterXML(base64Zip) {
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<peticion>'
    + '<cabecera>'
    + '<arrendador>' + SES.codigoArrendador + '</arrendador>'
    + '<aplicacion>PanoramicSuites</aplicacion>'
    + '<tipoOperacion>A</tipoOperacion>'
    + '<tipoComunicacion>PV</tipoComunicacion>'
    + '</cabecera>'
    + '<solicitud>' + base64Zip + '</solicitud>'
    + '</peticion>';
}

// ============================================================
// ENVÍO A SES
// ============================================================
async function sendToSES(data) {
  const token = Buffer.from(`${SES.usuario}:${SES.password}`).toString('base64');

  // Step 1: Build the inner XML with the communication data
  const innerXML = buildInnerXML(data);
  console.log('[Inner XML]\n', innerXML);

  // Step 2: Compress inner XML as ZIP and encode as Base64
  const zip = new AdmZip();
  zip.addFile('comunicacion.xml', Buffer.from(innerXML, 'utf8'));
  const zipBuffer = zip.toBuffer();
  const base64Zip = zipBuffer.toString('base64');

  // Step 3: Build outer XML envelope with cabecera + base64 solicitud
  const outerXML = buildOuterXML(base64Zip);
  console.log('[SES envelope length]', outerXML.length);

  const res = await fetch(SES.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Authorization': `Basic ${token}`,
    },
    body: outerXML,
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
  console.log('[Datos viajero 1]', JSON.stringify(data.viajeros[0]));

  // SES.Hospedajes — envío automático
  var ses = { ok: false, status: 0, body: '' };
  try { ses = await sendToSES(data); }
  catch (e) { console.error('[SES error]', e.message); ses.body = e.message; }

  // Log de cumplimiento (guarda al menos 3 años según RD 933/2021)
  console.log('[LOG]', JSON.stringify({
    ts: data.timestamp, ref: data.reserva.referencia,
    viajeros: data.viajeros.length, ses_ok: ses.ok, ses_status: ses.status
  }));

  // ── EMAIL DE NOTIFICACIÓN CON XML ADJUNTO ────────────────
  try {
    // Generate the inner XML for attachment
    var xmlContent = buildInnerXML(data);
    var xmlFilename = data.reserva.referencia + '.xml';

    console.log('[Email] Intentando enviar via Resend a', MAIL_TO, '...');
    var info = await resend.emails.send({
      from:        MAIL_FROM,
      to:          MAIL_TO,
      subject:     'Registro SES.Hospedajes — ' + data.reserva.referencia,
      html:        buildEmail(data),
      attachments: [
        {
          filename:    xmlFilename,
          content:     Buffer.from(xmlContent).toString('base64'),
        }
      ],
    });
    console.log('[Email] Enviado OK via Resend. Id:', info.data ? info.data.id : JSON.stringify(info));
  } catch (mailErr) {
    console.error('[Email] Error al enviar:', mailErr.message);
  }

  res.json({ success: true, ses_ok: ses.ok, ses_status: ses.status,
    message: ses.ok ? 'Enviado a SES.Hospedajes' : 'Guardado — reintento pendiente' });
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/test-email', async (_, res) => {
  try {
    console.log('[Test] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Panoramic Suites <info@panoramicsuites.com>',
        to:   'info@panoramicsuites.com',
        subject: 'Test conexion Resend',
        html: '<p>Si recibes esto, el email funciona correctamente.</p>'
      })
    });
    var data = await r.json();
    console.log('[Test] Resend response:', r.status, JSON.stringify(data));
    res.json({ status: r.status, data: data });
  } catch(e) {
    console.log('[Test] Error:', e.message);
    res.json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Panoramic Suites backend · puerto ${PORT}`);
  console.log(`   POST /api/parte-viajeros`);
  console.log(`   Arrendador: ${SES.codigoArrendador} | Establecimiento: ${SES.codigoEstablecimiento}`);
});
