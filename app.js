// --- IMPORTACIONES ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    onSnapshot, 
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    getDoc,
    updateDoc
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

// --- ESTADO ---
let importanciaSeleccionada = 0;
let sortableInstance = null; 
let sortableSubpartidasInstances = []; 
let renderizadoInicialCompleto = false; 
let subpartidaEnEdicionId = null; 
let ultimaPartidaPadreSeleccionada = ""; 

// --- MODO VISUALIZACIÓN / PIN ---
let modoEdicion = sessionStorage.getItem('modo_edicion_activo') === 'true';

// Estilos globales controlados por clases en el body
function asegurarEstilosCSSGlobales() {
    if (document.getElementById('dinamic-modo-styles')) return;
    const style = document.createElement('style');
    style.id = 'dinamic-modo-styles';
    style.innerHTML = `
        /* Por defecto (Solo lectura): ocultamos controles administrativos y de arrastre */
        #open-partida, 
        #btn-gestionar-partidas, 
        #open-evidencia,
        .drag-handle, 
        .sub-drag-handle, 
        .btn-accion-edicion,
        .acciones-subpartida {
            display: none !important;
        }

        /* Cuando el modo edición está activo, los mostramos */
        body.modo-edicion-activo #open-partida,
        body.modo-edicion-activo #btn-gestionar-partidas,
        body.modo-edicion-activo #open-evidencia {
            display: inline-flex !important;
        }

        body.modo-edicion-activo .drag-handle,
        body.modo-edicion-activo .sub-drag-handle {
            display: inline-block !important;
        }

        body.modo-edicion-activo .acciones-subpartida {
            display: flex !important;
        }
    `;
    document.head.appendChild(style);
}

function aplicarModoVisualizacion() {
    asegurarEstilosCSSGlobales();
    
    if (modoEdicion) {
        document.body.classList.add('modo-edicion-activo');
        document.body.classList.remove('modo-solo-lectura');
    } else {
        document.body.classList.remove('modo-edicion-activo');
        document.body.classList.add('modo-solo-lectura');
    }

    document.querySelectorAll('button, a').forEach(el => {
        const texto = el.textContent.toLowerCase();
        if (texto.includes('agregar evidencia') || texto.includes('nueva evidencia')) {
            el.style.display = modoEdicion ? '' : 'none';
        }
    });
}

// --- CONFIGURACIÓN DEL ACCESO POR PIN EN LA FECHA ---
function configurarAccesoPinFecha() {
    const elementoFecha = document.getElementById('fecha-actualizacion');

    if (elementoFecha) {
        elementoFecha.style.cursor = 'pointer';
        
        elementoFecha.addEventListener('click', (e) => {
            e.preventDefault();

            if (modoEdicion) {
                const cerrar = confirm("¿Deseas cerrar el modo edición y volver a solo lectura?");
                if (cerrar) {
                    modoEdicion = false;
                    sessionStorage.setItem('modo_edicion_activo', 'false');
                    aplicarModoVisualizacion();
                    cargarPartidas();
                }
                return;
            }

            const pinIngresado = prompt("Ingresa el PIN de acceso:");
            
            if (pinIngresado === "0000") {
                modoEdicion = true;
                sessionStorage.setItem('modo_edicion_activo', 'true');
                aplicarModoVisualizacion();
                cargarPartidas();
                console.log("🔓 Modo Edición Activado mediante PIN");
            } else if (pinIngresado !== null) {
                alert("PIN incorrecto.");
            }
        });
    } else {
        console.warn("No se encontró el elemento con id 'fecha-actualizacion' en el HTML.");
    }
}

// --- CATEGORÍAS DINÁMICAS ---
const categorias = ["Todas", "Estructura", "Acabados", "Instalaciones", "Electricidad"];

function renderizarFiltros() {
    const contenedor = document.getElementById('filtros-categoria');
    if (!contenedor) return;
    contenedor.innerHTML = ''; 

    categorias.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.innerText = cat;
        btn.className = `px-4 py-1.5 rounded-full text-sm font-bold transition ${index === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('#filtros-categoria button').forEach(b => b.className = 'px-4 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200');
            btn.className = 'px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-bold';
        });
        contenedor.appendChild(btn);
    });
}

// --- LÓGICA DE INTERFAZ (MODALES) ---
const modalPartida = document.getElementById('modal-partida');
const modalGestor = document.getElementById('modal-gestor-partidas');
const btnOpenPartida = document.getElementById('open-partida');
const btnClosePartida = document.getElementById('close-partida');
const formPartida = document.getElementById('form-partida');

function toggleModal(modal, show) {
    if (!modal) return;
    modal.classList.toggle('opacity-0', !show);
    modal.classList.toggle('opacity-100', show);
    modal.classList.toggle('pointer-events-none', !show);
    document.body.classList.toggle('modal-active', show);
}

if (btnOpenPartida) btnOpenPartida.addEventListener('click', () => {
    if (formPartida) formPartida.reset();
    subpartidaEnEdicionId = null; 
    document.getElementById('nombre-subpartida').disabled = false;
    actualizarPalaUI(0);
    
    if (ultimaPartidaPadreSeleccionada) {
        const selectPadre = document.getElementById('partida-select');
        if (selectPadre) selectPadre.value = ultimaPartidaPadreSeleccionada;
    }

    toggleModal(modalPartida, true);
});
if (btnClosePartida) btnClosePartida.addEventListener('click', () => toggleModal(modalPartida, false));
const btnGestionarPartidasEl = document.getElementById('btn-gestionar-partidas');
if (btnGestionarPartidasEl) btnGestionarPartidasEl.addEventListener('click', () => toggleModal(modalGestor, true));
const closeGestorEl = document.getElementById('close-gestor');
if (closeGestorEl) closeGestorEl.addEventListener('click', () => toggleModal(modalGestor, false));

// --- CERRAR MODALES CON TECLA ESC ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modalPartida && !modalPartida.classList.contains('pointer-events-none')) {
            toggleModal(modalPartida, false);
        }
        if (modalGestor && !modalGestor.classList.contains('pointer-events-none')) {
            toggleModal(modalGestor, false);
        }
    }
});

// --- GESTIÓN DE PARTIDAS (CONFIGURACIÓN) ---
async function cargarPartidas() {
    const snapshot = await getDocs(collection(db, "partidas_config"));
    const select = document.getElementById('partida-select');
    const contenedorTags = document.getElementById('lista-tags-partidas');
    
    if (select) select.innerHTML = '<option value="">Seleccionar...</option>';
    if (contenedorTags) contenedorTags.innerHTML = '';

    let partidasArray = [];
    snapshot.forEach(docSnap => {
        partidasArray.push({ id: docSnap.id, ...docSnap.data() });
    });

    partidasArray.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

    partidasArray.forEach((partidaObj, index) => {
        const partidaId = partidaObj.id;
        
        if (select) {
            const option = document.createElement('option');
            option.value = partidaId;
            option.innerText = partidaId;
            select.appendChild(option);
        }

        if (contenedorTags) {
            const tag = document.createElement('div');
            tag.className = "bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 select-none";
            tag.dataset.id = partidaId;

            tag.innerHTML = `
                <span>${partidaId}</span>
                <div class="flex items-center gap-1 ml-auto">
                    <button type="button" class="text-blue-600 hover:text-blue-800 font-bold ml-1" title="Editar Concepto Padre">✏️</button>
                    <button type="button" class="text-red-500 hover:text-red-700 font-bold" title="Eliminar Concepto Padre">×</button>
                </div>`;
            
            const botonesEdicionPadre = tag.querySelectorAll('button');
            if (botonesEdicionPadre.length >= 2) {
                botonesEdicionPadre[0].onclick = async () => {
                    const nuevoNombre = prompt("Editar nombre del concepto padre:", partidaId);
                    if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre.trim() !== partidaId) {
                        const nombreLimpio = nuevoNombre.trim();
                        const ordenActual = partidaObj.orden ?? index;
                        
                        await setDoc(doc(db, "partidas_config", nombreLimpio), { creado: partidaObj.creado || new Date(), orden: ordenActual });
                        await deleteDoc(doc(db, "partidas_config", partidaId));

                        const avancesSnap = await getDocs(collection(db, "avances_obra"));
                        avancesSnap.forEach(async (avDoc) => {
                            const avData = avDoc.data();
                            if (avData.padreId === partidaId) {
                                const subName = avData.subpartida || avDoc.id.replace(partidaId + '_', '');
                                const nuevoSubId = `${nombreLimpio}_${subName}`;
                                await setDoc(doc(db, "avances_obra", nuevoSubId), {
                                    ...avData,
                                    padreId: nombreLimpio
                                });
                                await deleteDoc(doc(db, "avances_obra", avDoc.id));
                            }
                        });
                        cargarPartidas();
                    }
                };

                botonesEdicionPadre[1].onclick = async () => {
                    if (confirm(`¿Eliminar la partida padre "${partidaId}" y todas sus subpartidas asociadas?`)) {
                        await deleteDoc(doc(db, "partidas_config", partidaId));
                        const avancesSnap = await getDocs(collection(db, "avances_obra"));
                        avancesSnap.forEach(async (avDoc) => {
                            if (avDoc.data().padreId === partidaId) {
                                await deleteDoc(doc(db, "avances_obra", avDoc.id));
                            }
                        });
                        cargarPartidas();
                    }
                };
            }

            contenedorTags.appendChild(tag);
        }
    });

    if (ultimaPartidaPadreSeleccionada && select) {
        select.value = ultimaPartidaPadreSeleccionada;
    }
}

// --- LÓGICA: AVANCES PONDERADOS JERÁRQUICOS Y FECHA DINÁMICA ---
function escucharAvances() {
    onSnapshot(collection(db, "avances_obra"), async (snapshot) => {
        const contenedor = document.getElementById('contenedor-estado-partidas');
        if (!contenedor) return;
        
        const configSnap = await getDocs(collection(db, "partidas_config"));
        const ordenMap = {};
        configSnap.forEach(docSnap => {
            ordenMap[docSnap.id] = docSnap.data().orden ?? 999;
        });

        const agrupadoPorPadre = {};
        let fechaMasReciente = null;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const subpartidaId = docSnap.id;
            const padreId = data.padreId || subpartidaId; 

            if (data.ultimaActualizacion) {
                const fechaMod = new Date(data.ultimaActualizacion);
                if (!fechaMasReciente || fechaMod > fechaMasReciente) {
                    fechaMasReciente = fechaMod;
                }
            }

            if (!agrupadoPorPadre[padreId]) {
                agrupadoPorPadre[padreId] = {
                    pesoPadre: data.pesoPadre || 5,
                    orden: ordenMap[padreId] ?? 999,
                    subpartidas: []
                };
            }

            agrupadoPorPadre[padreId].subpartidas.push({
                docId: subpartidaId,
                id: data.subpartida || subpartidaId,
                porcentaje: Number(data.porcentaje) || 0,
                peso: Number(data.importancia) || 1,
                notas: data.notas || '',
                orden: data.orden ?? 999
            });
        });

        actualizarFechaUltimoCambio(fechaMasReciente);

        const padresOrdenados = Object.keys(agrupadoPorPadre).sort((a, b) => {
            return (agrupadoPorPadre[a].orden) - (agrupadoPorPadre[b].orden);
        });

        let sumaContribucionGeneral = 0;
        let sumaPesosGenerales = 0;

        let abiertosGuardados = [];
        try {
            abiertosGuardados = JSON.parse(localStorage.getItem('accordion_abiertos') || '[]');
        } catch (e) {
            abiertosGuardados = [];
        }

        const existenPadresEnDOM = contenedor.children.length === padresOrdenados.length;
        let idsActualesEnDOM = Array.from(contenedor.children).map(el => el.dataset.id);
        let estructuraIgual = existenPadresEnDOM && padresOrdenados.every((id, idx) => idsActualesEnDOM[idx] === id);

        if (!renderizadoInicialCompleto || !estructuraIgual) {
            contenedor.innerHTML = '';
            sortableSubpartidasInstances = [];
        }

        for (const padreId of padresOrdenados) {
            const grupo = agrupadoPorPadre[padreId];
            grupo.subpartidas.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));

            let sumaContribucionPadre = 0;
            let sumaPesosPadre = 0;

            grupo.subpartidas.forEach(sub => {
                sumaContribucionPadre += (sub.porcentaje * sub.peso);
                sumaPesosPadre += sub.peso;
            });

            const avancePadre = sumaPesosPadre > 0 ? (sumaContribucionPadre / sumaPesosPadre).toFixed(2) : "0.00";
            const pesoPropioPadre = grupo.pesoPadre;

            sumaContribucionGeneral += (Number(avancePadre) * pesoPropioPadre);
            sumaPesosGenerales += pesoPropioPadre;

            let itemPadre = contenedor.querySelector(`[data-id="${padreId}"]`);

            let htmlSubpartidas = '';
            grupo.subpartidas.forEach(sub => {
                htmlSubpartidas += `
                    <div class="flex justify-between items-center text-sm py-1.5 pl-3 pr-2 border-l-2 border-blue-200 my-1 ml-6 bg-gray-50 rounded-r" data-docid="${sub.docId}">
                        <div class="flex items-center gap-2">
                            <span class="sub-drag-handle text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing text-base select-none px-0.5" title="Mover subpartida" onclick="event.stopPropagation()">⋮</span>
                            <div>
                                <span class="text-gray-600 font-medium">${sub.id}</span>
                                ${sub.notas ? `<p class="text-xs text-gray-400 italic">Nota: ${sub.notas}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-gray-700">${sub.porcentaje}% <span class="text-xs text-gray-400 font-normal">(peso: ${sub.peso})</span></span>
                            <div class="flex gap-1 acciones-subpartida">
                                <button onclick="window.editarSubpartida('${sub.docId}', '${padreId}', '${sub.id}', ${sub.porcentaje}, ${sub.peso}, '${sub.notas}')" class="text-blue-600 hover:text-blue-800 text-xs px-1" title="Editar Subpartida">✏️</button>
                                <button onclick="window.eliminarSubpartida('${sub.docId}')" class="text-red-500 hover:text-red-700 text-xs px-1 font-bold" title="Eliminar Subpartida">×</button>
                            </div>
                        </div>
                    </div>
                `;
            });

            if (itemPadre) {
                const spanAvancePadre = itemPadre.querySelector('.avance-padre-val');
                if (spanAvancePadre) spanAvancePadre.innerText = `${avancePadre}%`;
                
                const subContainer = itemPadre.querySelector('.subpartidas-container');
                if (subContainer) subContainer.innerHTML = htmlSubpartidas;
            } else {
                itemPadre = document.createElement('div');
                itemPadre.className = "py-3 border-b item-partida-padre bg-white";
                itemPadre.dataset.id = padreId; 

                itemPadre.innerHTML = `
                    <div class="flex justify-between items-center font-bold text-gray-800 cursor-pointer select-none header-partida-padre">
                        <div class="flex items-center gap-2">
                            <span class="flecha-desplegar transition-transform duration-200 inline-block text-gray-400 text-sm">▼</span>
                            <span>🏗️ ${padreId}</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="text-gray-500 font-normal text-sm">Avance <span class="avance-padre-val font-bold text-blue-600">${avancePadre}%</span> <span class="text-xs font-normal">ponderado</span></span>
                            <span class="drag-handle text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing text-lg px-1 select-none" title="Mantén presionado para mover" onclick="event.stopPropagation()">⋮</span>
                        </div>
                    </div>
                    <div class="mt-2 space-y-1 subpartidas-container hidden" data-padre-container="${padreId}">
                        ${htmlSubpartidas}
                    </div>
                `;

                const headerEl = itemPadre.querySelector('.header-partida-padre');
                const subContainer = itemPadre.querySelector('.subpartidas-container');
                const flechaEl = itemPadre.querySelector('.flecha-desplegar');

                const estaAbiertoGuardado = abiertosGuardados.includes(padreId);
                if (estaAbiertoGuardado) {
                    subContainer.classList.remove('hidden');
                    flechaEl.style.transform = 'rotate(0deg)';
                } else {
                    flechaEl.style.transform = 'rotate(-90deg)';
                }

                headerEl.addEventListener('click', () => {
                    const estaOculto = subContainer.classList.contains('hidden');
                    subContainer.classList.toggle('hidden', !estaOculto);
                    flechaEl.style.transform = estaOculto ? 'rotate(0deg)' : 'rotate(-90deg)';

                    let actuales = [];
                    try {
                        actuales = JSON.parse(localStorage.getItem('accordion_abiertos') || '[]');
                    } catch (e) {
                        actuales = [];
                    }

                    if (estaOculto) {
                        if (!actuales.includes(padreId)) actuales.push(padreId);
                    } else {
                        actuales = actuales.filter(id => id !== padreId);
                    }
                    localStorage.setItem('accordion_abiertos', JSON.stringify(actuales));
                });

                contenedor.appendChild(itemPadre);
            }

            if (typeof Sortable !== 'undefined' && modoEdicion) {
                const subContainerEl = itemPadre.querySelector(`[data-padre-container="${padreId}"]`);
                if (subContainerEl && !subContainerEl.sortableInitialized) {
                    const subSortable = Sortable.create(subContainerEl, {
                        handle: '.sub-drag-handle',
                        animation: 150,
                        onEnd: async function () {
                            const itemsSub = Array.from(subContainerEl.children);
                            for (let j = 0; j < itemsSub.length; j++) {
                                const docIdSub = itemsSub[j].dataset.docid;
                                if (docIdSub) {
                                    await updateDoc(doc(db, "avances_obra", docIdSub), { orden: j });
                                }
                            }
                        }
                    });
                    subContainerEl.sortableInitialized = true;
                    sortableSubpartidasInstances.push(subSortable);
                }
            }
        }

        const avanceTotalGlobal = sumaPesosGenerales > 0 ? (sumaContribucionGeneral / sumaPesosGenerales).toFixed(2) : "0.00";
        
        const kpiBig = document.getElementById('kpi-avance-big');
        if (kpiBig) kpiBig.innerText = `${avanceTotalGlobal}%`;
        
        const circle = document.getElementById('svg-circle');
        if (circle) {
            circle.style.strokeDasharray = `${(200 * Number(avanceTotalGlobal)) / 100} 200`;
        }

        if (typeof Sortable !== 'undefined' && contenedor && modoEdicion) {
            if (!sortableInstance) {
                sortableInstance = Sortable.create(contenedor, {
                    handle: '.drag-handle',
                    animation: 150,
                    onEnd: async function () {
                        const elementosActualizados = Array.from(contenedor.children);
                        for (let i = 0; i < elementosActualizados.length; i++) {
                            const idPadre = elementosActualizados[i].dataset.id;
                            if (idPadre) {
                                await updateDoc(doc(db, "partidas_config", idPadre), { orden: i });
                            }
                        }
                    }
                });
            }
        }

        renderizadoInicialCompleto = true;
    });
}

function actualizarFechaUltimoCambio(fecha) {
    const fechaObj = fecha || new Date();
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', opciones);
    const fechaCapitalizada = fechaFormateada.replace(/^\w/, c => c.toUpperCase());

    const elementoFecha = document.getElementById('fecha-actualizacion');
    if (elementoFecha) {
        elementoFecha.innerText = `Actualizado: ${fechaCapitalizada}`;
    }
}

window.editarSubpartida = async (docId, padreId, subNombre, porcentaje, peso, notas) => {
    subpartidaEnEdicionId = docId; 
    ultimaPartidaPadreSeleccionada = padreId; 
    document.getElementById('partida-select').value = padreId;
    const inputSub = document.getElementById('nombre-subpartida');
    inputSub.value = subNombre;
    inputSub.disabled = false; 
    document.getElementById('nuevo-avance').value = porcentaje;
    actualizarPalaUI(peso);
    const inputNotas = document.getElementById('input-notas-avance');
    if (inputNotas) inputNotas.value = notas !== 'undefined' ? notas : '';
    
    toggleModal(modalPartida, true);
};

window.eliminarSubpartida = async (docId) => {
    if (confirm("¿Estás seguro de eliminar esta subpartida?")) {
        await deleteDoc(doc(db, "avances_obra", docId));
    }
};

function actualizarPalaUI(nivel) {
    importanciaSeleccionada = nivel;
    const contenedorPalas = document.getElementById('selector-importancia');
    if (!contenedorPalas) return;
    const palas = contenedorPalas.children;
    Array.from(palas).forEach((p, idx) => {
        p.className = idx < nivel ? "opacity-100 cursor-pointer" : "opacity-30 cursor-pointer";
    });
}

const btnAgregarPartidaEl = document.getElementById('btn-agregar-partida');
if (btnAgregarPartidaEl) {
    btnAgregarPartidaEl.addEventListener('click', async () => {
        const input = document.getElementById('nueva-partida-input');
        const nombre = input.value.trim();
        if (!nombre) return;

        const snapshot = await getDocs(collection(db, "partidas_config"));
        const existe = snapshot.docs.some(d => d.id.toLowerCase() === nombre.toLowerCase());

        if (existe) {
            alert(`Ya existe esta partida registrada: ${nombre.toUpperCase()}`);
        } else {
            const nuevoOrden = snapshot.size;
            await setDoc(doc(db, "partidas_config", nombre), { creado: new Date(), orden: nuevoOrden });
            input.value = '';
            renderizadoInicialCompleto = false; 
            cargarPartidas();
        }
    });
}

const contenedorPalas = document.getElementById('selector-importancia');
if (contenedorPalas) {
    for (let i = 1; i <= 5; i++) {
        const span = document.createElement('span');
        span.innerText = '⛏️';
        span.className = "opacity-30 hover:opacity-100 cursor-pointer";
        span.onclick = () => actualizarPalaUI(i);
        contenedorPalas.appendChild(span);
    }
}

if (formPartida) {
    formPartida.addEventListener('submit', async (e) => {
        e.preventDefault();
        const padreId = document.getElementById('partida-select').value;
        const nombreSub = document.getElementById('nombre-subpartida').value.trim();
        const avance = document.getElementById('nuevo-avance').value;
        const inputNotas = document.getElementById('input-notas-avance');
        const notasTexto = inputNotas ? inputNotas.value.trim() : '';

        if (!padreId || !nombreSub || importanciaSeleccionada === 0) {
            return alert("Selecciona la partida padre, escribe el nombre de la subpartida e indica su importancia.");
        }

        ultimaPartidaPadreSeleccionada = padreId;
        const nuevoSubpartidaId = `${padreId}_${nombreSub}`;
        let ordenAsignado = 0;

        if (subpartidaEnEdicionId) {
            const docActual = await getDoc(doc(db, "avances_obra", subpartidaEnEdicionId));
            if (docActual.exists() && docActual.data().orden !== undefined) {
                ordenAsignado = docActual.data().orden;
            } else {
                const docAnteriorRenombrado = await getDoc(doc(db, "avances_obra", nuevoSubpartidaId));
                ordenAsignado = docAnteriorRenombrado.exists() ? (docAnteriorRenombrado.data().orden ?? 0) : 0;
            }

            if (subpartidaEnEdicionId !== nuevoSubpartidaId) {
                await deleteDoc(doc(db, "avances_obra", subpartidaEnEdicionId));
            }
        } else {
            const subSnap = await getDocs(collection(db, "avances_obra"));
            subSnap.forEach(d => { 
                if (d.data().padreId === padreId) ordenAsignado++; 
            });
        }

        await setDoc(doc(db, "avances_obra", nuevoSubpartidaId), {
            padreId: padreId,
            subpartida: nombreSub,
            porcentaje: Number(avance),
            importancia: importanciaSeleccionada,
            notas: notasTexto,
            orden: ordenAsignado,
            ultimaActualizacion: new Date().toISOString()
        }, { merge: true });
        
        alert("Subpartida y avance guardados correctamente");
        
        document.getElementById('nombre-subpartida').value = '';
        document.getElementById('nombre-subpartida').disabled = false;
        document.getElementById('nuevo-avance').value = '';
        if (inputNotas) inputNotas.value = '';
        actualizarPalaUI(0);
        subpartidaEnEdicionId = null;
        
        document.getElementById('partida-select').value = ultimaPartidaPadreSeleccionada;
    });
}

function escucharMovimientos() {
    onSnapshot(collection(db, "movimientos"), (snapshot) => {
        let ingresos = 0;
        let gastos = 0;
        snapshot.forEach((doc) => {
            const mov = doc.data();
            if (mov.tipo === 'ingreso') ingresos += mov.monto;
            else gastos += mov.monto;
        });
        const saldo = ingresos - gastos;
        const elSaldo = document.getElementById('kpi-saldo');
        if (elSaldo) elSaldo.innerText = `$${saldo.toLocaleString()}`;
        const elRecibido = document.getElementById('val-recibido');
        if (elRecibido) elRecibido.innerText = `$${ingresos.toLocaleString()}`;
        const elGastado = document.getElementById('val-gastado');
        if (elGastado) elGastado.innerText = `-$${gastos.toLocaleString()}`;
        const elCaja = document.getElementById('val-caja');
        if (elCaja) elCaja.innerText = `$${saldo.toLocaleString()}`;
        const elReporteFinanciero = document.getElementById('reporte-financiero-privadas-de-las-plazas');
        if (elReporteFinanciero) {
            elReporteFinanciero.innerText = `Saldo Actualizado: $${saldo.toLocaleString()}`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarModoVisualizacion();
    configurarAccesoPinFecha();
    escucharMovimientos();
    escucharAvances();
    renderizarFiltros();
    cargarPartidas();
});