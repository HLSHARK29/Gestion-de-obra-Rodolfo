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

// --- ESTADO GLOBAL PARA EDICIÓN ---
window.idEdicion = null; 

// --- LÓGICA DEL MODAL ---
const modal = document.getElementById('modal-movimiento');
const btnOpen = document.getElementById('open-movimiento');
const btnClose = document.getElementById('close-modal');
const form = document.getElementById('form-movimiento');

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
    
    const datos = {
        tipo: document.getElementById('tipo').value,
        monto: parseFloat(document.getElementById('monto').value),
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
window.editarMovimiento = (id, concepto, monto, tipo, fecha) => {
    window.idEdicion = id;
    document.getElementById('tipo').value = tipo;
    document.getElementById('monto').value = monto;
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

onSnapshot(query(collection(db, "movimientos"), orderBy("fecha", "desc")), (snapshot) => {
    tablaBody.innerHTML = '';
    let ingresos = 0;
    let gastos = 0;

    snapshot.forEach((docSnap) => {
        const mov = docSnap.data();
        const id = docSnap.id;
        const esIngreso = mov.tipo === 'ingreso';
        
        if (esIngreso) ingresos += mov.monto;
        else gastos += mov.monto;
        
        const row = document.createElement('tr');
        row.className = "border-b border-gray-50 hover:bg-gray-50";
        row.innerHTML = `
            <td class="p-4 text-sm text-gray-600">${mov.fecha}</td>
            <td class="p-4 text-sm font-medium">${mov.concepto}</td>
            <td class="p-4 text-sm capitalize">${mov.tipo}</td>
            <td class="p-4 text-sm font-bold text-right ${esIngreso ? 'text-emerald-600' : 'text-red-600'}">
                ${esIngreso ? '+' : '-'} $${mov.monto.toLocaleString()}
            </td>
            <td class="p-4 text-right flex gap-3 justify-end">
                <button onclick="editarMovimiento('${id}', '${mov.concepto}', ${mov.monto}, '${mov.tipo}', '${mov.fecha}')" 
                        class="text-blue-500 hover:text-blue-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
                <button onclick="eliminarMovimiento('${id}')" 
                        class="text-red-500 hover:text-red-700 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        tablaBody.appendChild(row);
    });

    elTotalIngresos.innerText = `$${ingresos.toLocaleString()}`;
    elTotalGastos.innerText = `$${gastos.toLocaleString()}`;
    elTotalSaldo.innerText = `$${(ingresos - gastos).toLocaleString()}`;
});