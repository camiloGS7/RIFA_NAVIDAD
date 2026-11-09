const PRECIO_BOLETO = 10000;

let boletos = [];
let numeroSeleccionado = null;
let guardandoVenta = false;

// Referencias del DOM
const grillaBoletos = document.getElementById('grilla-boletos');
const estadoCarga = document.getElementById('estado-carga');

const statDisponibles = document.getElementById('stat-disponibles');
const statVendidos = document.getElementById('stat-vendidos');
const statRecaudado = document.getElementById('stat-recaudado');
const badgeVendidos = document.getElementById('badge-vendidos');

const cuadreCantidad = document.getElementById('cuadre-cantidad');
const cuadreTotalDinero = document.getElementById('cuadre-total-dinero');
const tablaVendidosBody = document.getElementById('tabla-vendidos-body');
const estadoSinVentas = document.getElementById('estado-sin-ventas');
const inputBuscarVendido = document.getElementById('input-buscar-vendido');

const panelCuadre = document.getElementById('panel-cuadre');
const btnAbrirCuadre = document.getElementById('btn-abrir-cuadre');
const btnCerrarCuadre = document.getElementById('btn-cerrar-cuadre');
const btnRecargar = document.getElementById('btn-recargar');

const modalVenta = document.getElementById('modal-venta');
const modalNumeroBadge = document.getElementById('modal-numero-badge');
const modalNumeroTexto = document.getElementById('modal-numero-texto');
const formVenta = document.getElementById('form-venta');
const inputComprador = document.getElementById('input-comprador');
const modalError = document.getElementById('modal-error');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');
const btnCancelarVenta = document.getElementById('btn-cancelar-venta');
const btnGuardarVenta = document.getElementById('btn-guardar-venta');
const textoBtnGuardar = document.getElementById('texto-btn-guardar');

const toastNotificacion = document.getElementById('toast-notificacion');
const toastMensaje = document.getElementById('toast-mensaje');

let toastTimeout = null;

/**
 * Formatea un valor numerico en pesos colombianos ($10.000)
 */
function formatearPesos(valor) {
  return '$' + Number(valor).toLocaleString('es-CO');
}

/**
 * Formatea la fecha de venta de forma legible y corta
 */
function formatearFecha(fechaIso) {
  if (!fechaIso) return '-';
  const fecha = new Date(fechaIso);
  if (isNaN(fecha.getTime())) return '-';
  return fecha.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Muestra un mensaje flotante rapido (Toast)
 */
function mostrarToast(mensaje) {
  toastMensaje.textContent = mensaje;
  toastNotificacion.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastNotificacion.classList.add('hidden');
  }, 3500);
}

/**
 * Genera una lista local de respaldo ('01' al '99' y '00') si aun no hay conexion a BD
 */
function generarBoletosRespaldo() {
  const lista = [];
  for (let i = 1; i <= 100; i++) {
    const numero = i === 100 ? '00' : String(i).padStart(2, '0');
    lista.push({
      id: i,
      numero,
      nombre_comprador: null,
      estado: false,
      fecha_venta: null,
    });
  }
  return lista;
}

/**
 * Obtiene los 100 boletos desde el Backend (Neon DB)
 */
async function cargarBoletos() {
  try {
    const respuesta = await fetch('/api/boletos');
    const data = await respuesta.json();

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.mensaje || 'Error al cargar los boletos');
    }

    boletos = data.boletos && data.boletos.length > 0
      ? data.boletos
      : generarBoletosRespaldo();
  } catch (error) {
    console.error('Error cargando boletos:', error);
    if (boletos.length === 0) {
      boletos = generarBoletosRespaldo();
    }
    mostrarToast('Verifica la conexion a la base de datos (DATABASE_URL).');
  } finally {
    estadoCarga.classList.add('hidden');
    grillaBoletos.classList.remove('hidden');
    renderizarTodo();
  }
}

/**
 * Renderiza tanto la cuadricula 10x10 como las estadisticas y la tabla de Cuadre de Caja
 */
function renderizarTodo() {
  renderizarGrilla();
  renderizarEstadisticasYCuadre();
}

/**
 * Construye la cuadricula 10x10 del 01 al 99 y terminando en 00
 */
function renderizarGrilla() {
  grillaBoletos.innerHTML = '';

  boletos.forEach((boleto) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.dataset.numero = boleto.numero;

    if (boleto.estado) {
      // Boleto VENDIDO (Deshabilitado para evitar dobles ventas)
      boton.disabled = true;
      boton.className =
        'boleto-vendido aspect-square flex flex-col items-center justify-center rounded-md sm:rounded-lg font-black text-sm sm:text-lg md:text-xl select-none p-0.5';
      boton.title = `VENDIDO a: ${boleto.nombre_comprador || 'Comprador registrado'}`;
      boton.innerHTML = `
        <span class="leading-none line-through decoration-amber-400/80">${boleto.numero}</span>
        <span class="text-[8px] sm:text-[9px] leading-none text-amber-300 font-extrabold mt-0.5 uppercase tracking-tighter">VENDIDO</span>
      `;
    } else {
      // Boleto DISPONIBLE
      boton.className =
        'boleto-disponible aspect-square flex items-center justify-center rounded-md sm:rounded-lg font-extrabold text-sm sm:text-lg md:text-xl cursor-pointer select-none';
      boton.title = `Boleto #${boleto.numero} disponible - Clic para vender`;
      boton.textContent = boleto.numero;

      boton.addEventListener('click', () => abrirModalVenta(boleto.numero));
    }

    grillaBoletos.appendChild(boton);
  });
}

/**
 * Actualiza los contadores superiores y la tabla del panel de Cuadre de Caja
 */
function renderizarEstadisticasYCuadre() {
  const vendidos = boletos.filter((b) => b.estado === true);
  const cantidadVendidos = vendidos.length;
  const cantidadDisponibles = boletos.length - cantidadVendidos;
  const totalRecaudado = cantidadVendidos * PRECIO_BOLETO;

  // Contadores barra superior
  statDisponibles.textContent = cantidadDisponibles;
  statVendidos.textContent = cantidadVendidos;
  statRecaudado.textContent = formatearPesos(totalRecaudado);
  badgeVendidos.textContent = cantidadVendidos;

  // Contadores panel de Cuadre
  cuadreCantidad.textContent = cantidadVendidos;
  cuadreTotalDinero.textContent = formatearPesos(totalRecaudado);

  // Filtrado por buscador
  const termino = (inputBuscarVendido.value || '').trim().toLowerCase();
  const vendidosFiltrados = vendidos.filter((b) => {
    if (!termino) return true;
    const coincideNumero = b.numero.toLowerCase().includes(termino);
    const coincideNombre = (b.nombre_comprador || '').toLowerCase().includes(termino);
    return coincideNumero || coincideNombre;
  });

  tablaVendidosBody.innerHTML = '';

  if (vendidosFiltrados.length === 0) {
    estadoSinVentas.classList.remove('hidden');
    estadoSinVentas.textContent = termino
      ? 'No se encontraron ventas que coincidan con la busqueda.'
      : 'Aun no hay boletos vendidos. Haz clic en un numero de la cuadricula para registrar la primera venta.';
    return;
  }

  estadoSinVentas.classList.add('hidden');

  vendidosFiltrados.forEach((boleto) => {
    const fila = document.createElement('tr');
    fila.className = 'hover:bg-red-900/40 transition';

    const tdNumero = document.createElement('td');
    tdNumero.className = 'py-2.5 px-3 font-black text-amber-300 text-base';
    tdNumero.textContent = `#${boleto.numero}`;

    const tdComprador = document.createElement('td');
    tdComprador.className = 'py-2.5 px-3 font-bold text-white';
    tdComprador.textContent = boleto.nombre_comprador || '-';

    const tdFecha = document.createElement('td');
    tdFecha.className = 'py-2.5 px-3 text-xs text-red-200 hidden sm:table-cell whitespace-nowrap';
    tdFecha.textContent = formatearFecha(boleto.fecha_venta);

    const tdAccion = document.createElement('td');
    tdAccion.className = 'py-2.5 px-3 text-right';

    const btnLiberar = document.createElement('button');
    btnLiberar.type = 'button';
    btnLiberar.className =
      'px-2.5 py-1 rounded-lg bg-red-900/90 hover:bg-red-700 text-red-200 hover:text-white text-xs font-bold border border-red-400/30 transition';
    btnLiberar.title = 'Anular venta y liberar numero';
    btnLiberar.textContent = 'Anular';
    btnLiberar.addEventListener('click', () => liberarBoleto(boleto));

    tdAccion.appendChild(btnLiberar);

    fila.appendChild(tdNumero);
    fila.appendChild(tdComprador);
    fila.appendChild(tdFecha);
    fila.appendChild(tdAccion);

    tablaVendidosBody.appendChild(fila);
  });
}

/**
 * Abre el modal rapido para vender el numero seleccionado
 */
function abrirModalVenta(numero) {
  numeroSeleccionado = numero;
  modalNumeroBadge.textContent = numero;
  modalNumeroTexto.textContent = numero;
  inputComprador.value = '';
  modalError.classList.add('hidden');
  modalError.textContent = '';

  modalVenta.classList.remove('hidden');

  // Foco inmediato en el campo de nombre para escribir y presionar Enter sin mas clics
  setTimeout(() => {
    inputComprador.focus();
  }, 40);
}

/**
 * Cierra el modal de venta
 */
function cerrarModalVenta() {
  if (guardandoVenta) return;
  modalVenta.classList.add('hidden');
  numeroSeleccionado = null;
  inputComprador.value = '';
  modalError.classList.add('hidden');
}

/**
 * Registra la compra en Neon DB al presionar Enter o hacer clic en Guardar
 */
formVenta.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (guardandoVenta || !numeroSeleccionado) return;

  const nombreComprador = inputComprador.value.trim();
  if (!nombreComprador) {
    modalError.textContent = 'Por favor escribe el nombre del comprador.';
    modalError.classList.remove('hidden');
    inputComprador.focus();
    return;
  }

  guardandoVenta = true;
  btnGuardarVenta.disabled = true;
  textoBtnGuardar.textContent = 'Guardando...';
  modalError.classList.add('hidden');

  try {
    const respuesta = await fetch('/api/comprar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: numeroSeleccionado,
        nombre_comprador: nombreComprador,
      }),
    });

    const data = await respuesta.json();

    if (!respuesta.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo registrar la venta.');
    }

    // Actualizar en memoria el boleto vendido inmediatamente
    const idx = boletos.findIndex((b) => b.numero === numeroSeleccionado);
    if (idx !== -1 && data.boleto) {
      boletos[idx] = data.boleto;
    }

    const numeroVendido = numeroSeleccionado;
    guardandoVenta = false;
    btnGuardarVenta.disabled = false;
    textoBtnGuardar.textContent = 'Guardar Venta';

    cerrarModalVenta();
    renderizarTodo();
    mostrarToast(`Boleto #${numeroVendido} registrado a nombre de ${nombreComprador}.`);
  } catch (error) {
    guardandoVenta = false;
    btnGuardarVenta.disabled = false;
    textoBtnGuardar.textContent = 'Guardar Venta';

    modalError.textContent = error.message;
    modalError.classList.remove('hidden');
    await cargarBoletos();
  }
});

/**
 * Permite anular una venta en caso de error de digitacion en el mostrador
 */
async function liberarBoleto(boleto) {
  const confirmar = window.confirm(
    `¿Deseas anular la venta del boleto #${boleto.numero} (${boleto.nombre_comprador}) y dejarlo disponible de nuevo?`
  );
  if (!confirmar) return;

  try {
    const respuesta = await fetch('/api/liberar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: boleto.numero }),
    });

    const data = await respuesta.json();
    if (!respuesta.ok || !data.ok) {
      throw new Error(data.mensaje || 'No se pudo liberar el boleto.');
    }

    const idx = boletos.findIndex((b) => b.numero === boleto.numero);
    if (idx !== -1 && data.boleto) {
      boletos[idx] = data.boleto;
    }

    renderizarTodo();
    mostrarToast(`Boleto #${boleto.numero} liberado y disponible nuevamente.`);
  } catch (error) {
    mostrarToast(error.message);
  }
}

// Eventos de cierre de Modal y Panel Lateral
btnCerrarModal.addEventListener('click', cerrarModalVenta);
btnCancelarVenta.addEventListener('click', cerrarModalVenta);

modalVenta.addEventListener('click', (e) => {
  if (e.target === modalVenta) cerrarModalVenta();
});

btnAbrirCuadre.addEventListener('click', () => {
  panelCuadre.classList.remove('hidden');
  setTimeout(() => inputBuscarVendido.focus(), 50);
});

btnCerrarCuadre.addEventListener('click', () => {
  panelCuadre.classList.add('hidden');
});

panelCuadre.addEventListener('click', (e) => {
  if (e.target === panelCuadre) {
    panelCuadre.classList.add('hidden');
  }
});

inputBuscarVendido.addEventListener('input', renderizarEstadisticasYCuadre);
btnRecargar.addEventListener('click', cargarBoletos);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalVenta.classList.contains('hidden')) {
      cerrarModalVenta();
    } else if (!panelCuadre.classList.contains('hidden') && window.innerWidth < 1024) {
      panelCuadre.classList.add('hidden');
    }
  }
});

// Inicializar aplicacion al cargar
document.addEventListener('DOMContentLoaded', cargarBoletos);
