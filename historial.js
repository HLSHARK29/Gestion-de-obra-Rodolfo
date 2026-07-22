// --- IMPORTACIONES ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy,
    updateDoc,
    deleteDoc,
    doc 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- CONFIGURACIÓN ---
const firebaseConfig = {
    apiKey: "AIzaSyAM84R5v44h3QbxEg4xVO3fuEVxgZXBJ_g",
    authDomain: "avance-rodo.firebaseapp.com",
    projectId: "avance-rodo",
    storageBucket: "avance-rodo.firebasestorage.app",
    messagingSenderId: "1043766975561",
    appId: "1:1043766975561:web:abd4572f198031a209f398"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO GLOBAL PARA EDICIÓN Y GESTIÓN DE ENTIDADES ---
window.idEdicion = null; 
window.idEntidadEdicion = null;

// --- LÓGICA DEL MODAL DE MOVIMIENTOS ---
const modal = document.getElementById('modal-movimiento');
const btnOpen = document.getElementById('open-movimiento');
const btnClose = document.getElementById('close-modal');
const form = document.getElementById('form-movimiento');
const inputMonto = document.getElementById('monto');

// --- LÓGICA DEL MODAL DE ENTIDADES ---
const modalEntidades = document.getElementById('modal-entidades');
const btnOpenEntidades = document.getElementById('open-entidades');
const btnCloseEntidades = document.getElementById('close-entidades');
const formEntidadAdmin = document.getElementById('form-entidad-admin');
const inputNombreEntidad = document.getElementById('nombre-nueva-entidad');
const btnGuardarEntidad = document.getElementById('btn-guardar-entidad');
const inputEntidadIdEdicion = document.getElementById('entidad-id-edicion');
const listaEtiquetasEntidades = document.getElementById('lista-etiquetas-entidades');
const selectEntidad = document.getElementById('entidad');
const filtroEntidad = document.getElementById('filtro-entidad');
const filtroOrden = document.getElementById('filtro-orden');

// --- RECUPERAR PREFERENCIAS GUARDADAS (LOCALSTORAGE) ---
if (filtroOrden) {
    const ordenGuardado = localStorage.getItem('filtro_orden_movimientos');
    if (ordenGuardado) {
        filtroOrden.value = ordenGuardado;
    } else {
        filtroOrden.value = 'asc'; // Por defecto del más viejo al más nuevo
    }
}

if (filtroEntidad) {
    const entidadGuardada = localStorage.getItem('filtro_entidad_movimientos');
    if (entidadGuardada) {
        filtroEntidad.value = entidadGuardada;
    }
}

if (btnOpenEntidades) {
    btnOpenEntidades.addEventListener('click', () => {
        modalEntidades.classList.remove('opacity-0', 'pointer-events-none');
    });
}

if (btnCloseEntidades) {
    btnCloseEntidades.addEventListener('click', () => {
        modalEntidades.classList.add('opacity-0', 'pointer-events-none');
        formEntidadAdmin.reset();
        inputEntidadIdEdicion.value = '';
        btnGuardarEntidad.textContent = 'Agregar';
    });
}

// --- CACHÉ DE ENTIDADES ---
let entidadesCache = [];

// --- SINCRONIZACIÓN Y GESTIÓN DE ENTIDADES CON FIRESTORE ---
onSnapshot(query(collection(db, "entidades"), orderBy("nombre", "asc")), (snapshot) => {
    entidadesCache = [];
    const valorSeleccionadoActual = selectEntidad ? selectEntidad.value : '';
    const filtroEntidadActual = filtroEntidad ? filtroEntidad.value : localStorage.getItem('filtro_entidad_movimientos') || '';

    if (selectEntidad) {
        selectEntidad.innerHTML = '<option value="" disabled selected>Selecciona la Entidad</option>';
    }
    if (filtroEntidad) {
        filtroEntidad.innerHTML = '<option value="">Todas las entidades</option>';
    }
    if (listaEtiquetasEntidades) {
        listaEtiquetasEntidades.innerHTML = '';
    }

    snapshot.forEach((docSnap) => {
        const ent = docSnap.data();
        const idEnt = docSnap.id;

        entidadesCache.push({ id: idEnt, nombre: ent.nombre });

        // Poblar el select del modal de movimientos
        if (selectEntidad) {
            const option = document.createElement('option');
            option.value = ent.nombre;
            option.textContent = ent.nombre;
            selectEntidad.appendChild(option);
        }

        // Poblar el select del filtro de entidades
        if (filtroEntidad) {
            const optionFiltro = document.createElement('option');
            optionFiltro.value = ent.nombre;
            optionFiltro.textContent = ent.nombre;
            filtroEntidad.appendChild(optionFiltro);
        }

        // Pintar etiquetas en el modal de administración de entidades
        if (listaEtiquetasEntidades) {
            const tag = document.createElement('div');
            tag.className = "flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 border border-gray-200";
            tag.innerHTML = `
                <span>${ent.nombre}</span>
                <button type="button" onclick="editarEntidad('${idEnt}', '${ent.nombre}')" class="text-blue-500 hover:text-blue-700 transition" title="Editar">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button type="button" onclick="eliminarEntidad('${idEnt}')" class="text-red-500 hover:text-red-700 transition" title="Eliminar">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            `;
            listaEtiquetasEntidades.appendChild(tag);
        }
    });

    if (selectEntidad && valorSeleccionadoActual) {
        selectEntidad.value = valorSeleccionadoActual;
    }
    if (filtroEntidad && filtroEntidadActual) {
        filtroEntidad.value = filtroEntidadActual;
    }

    renderizarMovimientos();
});

// Guardar o Actualizar Entidad desde el modal de administración
if (formEntidadAdmin) {
    formEntidadAdmin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombreEntidad = inputNombreEntidad.value.trim();
        const idEdicionEnt = inputEntidadIdEdicion.value;

        if (!nombreEntidad) return;

        try {
            if (idEdicionEnt) {
                await updateDoc(doc(db, "entidades", idEdicionEnt), { nombre: nombreEntidad });
            } else {
                await addDoc(collection(db, "entidades"), { nombre: nombreEntidad });
            }
            formEntidadAdmin.reset();
            inputEntidadIdEdicion.value = '';
            btnGuardarEntidad.textContent = 'Agregar';
        } catch (error) {
            console.error("Error al procesar entidad:", error);
        }
    });
}

window.editarEntidad = (id, nombre) => {
    inputEntidadIdEdicion.value = id;
    inputNombreEntidad.value = nombre;
    btnGuardarEntidad.textContent = 'Actualizar';
};

window.eliminarEntidad = async (id) => {
    if (confirm("¿Estás seguro de eliminar esta entidad?")) {
        try {
            await deleteDoc(doc(db, "entidades", id));
        } catch (error) {
            console.error("Error al eliminar entidad:", error);
        }
    }
};

// --- FORMATEADOR EN VIVO PARA EL MONTO ---
if (inputMonto) {
    inputMonto.addEventListener('input', function (e) {
        let valorLimpio = this.value.replace(/[^0-9.]/g, '');

        const partes = valorLimpio.split('.');
        if (partes.length > 2) {
            valorLimpio = partes[0] + '.' + partes.slice(1).join('');
        }

        if (valorLimpio === '') {
            this.value = '';
            return;
        }

        let [entero, decimal] = valorLimpio.split('.');
        entero = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

        if (decimal !== undefined) {
            decimal = decimal.substring(0, 2);
            this.value = `$ ${entero}.${decimal}`;
        } else if (valorLimpio.endsWith('.')) {
            this.value = `$ ${entero}.`;
        } else {
            this.value = `$ ${entero}`;
        }
    });
}

btnOpen.addEventListener('click', () => {
    window.idEdicion = null;
    form.reset();
    modal.classList.remove('opacity-0', 'pointer-events-none');
});

btnClose.addEventListener('click', () => {
    modal.classList.add('opacity-0', 'pointer-events-none');
});

// --- GUARDAR O ACTUALIZAR MOVIMIENTO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Limpia el formato de moneda ($ y comas) para extraer el número decimal exacto
    const rawMonto = document.getElementById('monto').value;
    const montoNumerico = parseFloat(rawMonto.replace(/[^0-9.]/g, '')) || 0;

    const datos = {
        entidad: document.getElementById('entidad').value,
        tipo: document.getElementById('tipo').value,
        monto: montoNumerico,
        concepto: document.getElementById('concepto').value,
        fecha: document.getElementById('fecha').value,
    };

    try {
        if (window.idEdicion) {
            await updateDoc(doc(db, "movimientos", window.idEdicion), datos);
        } else {
            await addDoc(collection(db, "movimientos"), datos);
        }
        form.reset();
        modal.classList.add('opacity-0', 'pointer-events-none');
        window.idEdicion = null;
    } catch (error) {
        console.error("Error al procesar:", error);
    }
});

// --- FUNCIONES GLOBALES PARA LA TABLA ---
window.editarMovimiento = (id, entidad, concepto, monto, tipo, fecha) => {
    window.idEdicion = id;
    document.getElementById('entidad').value = entidad;
    document.getElementById('tipo').value = tipo;
    
    // Formatear correctamente el monto al cargarlo en el input para edición
    const montoFormateado = Number(monto).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    document.getElementById('monto').value = `$ ${montoFormateado}`;
    
    document.getElementById('concepto').value = concepto;
    document.getElementById('fecha').value = fecha;
    modal.classList.remove('opacity-0', 'pointer-events-none');
};

window.eliminarMovimiento = async (id) => {
    if (confirm("¿Estás seguro de eliminar este movimiento? Esta acción no se puede deshacer.")) {
        try {
            await deleteDoc(doc(db, "movimientos", id));
        } catch (error) {
            console.error("Error al eliminar:", error);
        }
    }
};

// --- CARGAR, LISTAR Y CALCULAR ---
const tablaBody = document.getElementById('tabla-movimientos');
const elTotalIngresos = document.getElementById('total-ingresos');
const elTotalGastos = document.getElementById('total-gastos');
const elTotalSaldo = document.getElementById('total-saldo');
const contenedorSaldosEntidades = document.getElementById('contenedor-saldos-entidades');

let movimientosCache = [];

function renderizarMovimientos() {
    if (!tablaBody) return;
    tablaBody.innerHTML = '';

    const entidadSeleccionada = filtroEntidad ? filtroEntidad.value : '';
    const ordenSeleccionado = filtroOrden ? filtroOrden.value : 'asc';

    // Guardar selecciones en localStorage
    if (filtroEntidad) localStorage.setItem('filtro_entidad_movimientos', entidadSeleccionada);
    if (filtroOrden) localStorage.setItem('filtro_orden_movimientos', ordenSeleccionado);

    // Calcular saldos individuales por entidad con TODOS los movimientos (sin importar el filtro actual de la tabla)
    const saldosPorEntidad = {};
    entidadesCache.forEach(ent => {
        saldosPorEntidad[ent.nombre] = 0;
    });

    movimientosCache.forEach(mov => {
        const entNombre = mov.entidad || 'N/A';
        if (saldosPorEntidad[entNombre] === undefined) {
            saldosPorEntidad[entNombre] = 0;
        }
        if (mov.tipo === 'ingreso') {
            saldosPorEntidad[entNombre] += Number(mov.monto);
        } else {
            saldosPorEntidad[entNombre] -= Number(mov.monto);
        }
    });

    // Renderizar tarjetas dinámicas de saldo por entidad
    if (contenedorSaldosEntidades) {
        contenedorSaldosEntidades.innerHTML = '';
        if (entidadesCache.length === 0) {
            contenedorSaldosEntidades.innerHTML = `<p class="text-xs text-gray-400 col-span-full">No hay entidades registradas.</p>`;
        } else {
            entidadesCache.forEach(ent => {
                const saldoEntidad = saldosPorEntidad[ent.nombre] || 0;
                const tarjeta = document.createElement('div');
                tarjeta.className = "bg-white p-5 rounded-2xl border border-gray-100 shadow-sm text-center";
                tarjeta.innerHTML = `
                    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider truncate" title="Saldo (${ent.nombre})">Saldo (${ent.nombre})</h3>
                    <p class="text-xl font-extrabold ${saldoEntidad >= 0 ? 'text-blue-600' : 'text-red-600'} mt-2">
                        $${saldoEntidad.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                `;
                contenedorSaldosEntidades.appendChild(tarjeta);
            });
        }
    }

    // Filtrar por entidad para la tabla
    let movimientosFiltrados = movimientosCache.filter(mov => {
        if (!entidadSeleccionada) return true;
        return mov.entidad === entidadSeleccionada;
    });

    // Ordenar por fecha
    movimientosFiltrados.sort((a, b) => {
        const fechaA = new Date(a.fecha);
        const fechaB = new Date(b.fecha);
        if (ordenSeleccionado === 'asc') {
            return fechaA - fechaB;
        } else {
            return fechaB - fechaA;
        }
    });

    let ingresos = 0;
    let gastos = 0;

    movimientosFiltrados.forEach((mov) => {
        const esIngreso = mov.tipo === 'ingreso';
        const entidad = mov.entidad || 'N/A';
        
        if (esIngreso) ingresos += mov.monto;
        else gastos += mov.monto;
        
        const row = document.createElement('tr');
        row.className = "border-b border-gray-50 hover:bg-gray-50";
        row.innerHTML = `
            <td class="p-4 text-sm text-gray-600">${mov.fecha}</td>
            <td class="p-4 text-sm font-semibold text-gray-700">${entidad}</td>
            <td class="p-4 text-sm font-medium">${mov.concepto}</td>
            <td class="p-4 text-sm capitalize">${mov.tipo}</td>
            <td class="p-4 text-sm font-bold text-right ${esIngreso ? 'text-emerald-600' : 'text-red-600'}">
                ${esIngreso ? '+' : '-'} $${Number(mov.monto).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </td>
            <td class="p-4 text-right flex gap-3 justify-end">
                <button onclick="editarMovimiento('${mov.id}', '${entidad}', '${mov.concepto}', ${mov.monto}, '${mov.tipo}', '${mov.fecha}')" 
                        class="text-blue-500 hover:text-blue-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onclick="eliminarMovimiento('${mov.id}')" 
                        class="text-red-500 hover:text-red-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        tablaBody.appendChild(row);
    });

    if (elTotalIngresos) elTotalIngresos.innerText = `$${ingresos.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (elTotalGastos) elTotalGastos.innerText = `$${gastos.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    if (elTotalSaldo) elTotalSaldo.innerText = `$${(ingresos - gastos).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

onSnapshot(query(collection(db, "movimientos")), (snapshot) => {
    movimientosCache = [];
    snapshot.forEach((docSnap) => {
        movimientosCache.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });
    renderizarMovimientos();
});

if (filtroEntidad) {
    filtroEntidad.addEventListener('change', renderizarMovimientos);
}

if (filtroOrden) {
    filtroOrden.addEventListener('change', renderizarMovimientos);
}