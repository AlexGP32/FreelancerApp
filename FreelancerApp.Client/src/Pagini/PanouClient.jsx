import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { useNavigate } from 'react-router-dom'
import { handleAdaugaRecenzie } from '../AdaugaRecenzie'
import { GetAuthHeaders } from '../TokenHeaders'

// Helper function to standardize SweetAlert2 popups throughout the component
const Alerta = (icon, title, text) => {
    return Swal.fire({
        icon: icon,
        title: title,
        text: text,
    })
}

// Main Dashboard for the 'Client' role.
// Handles project creation, offer management, PayPal payments, and job reviews.
export default function PanouClient({ utilizator }) {
    const navigate = useNavigate()

    // --- State: Dashboard Data ---
    const [proiecte, setProiecte] = useState([]) // List of the client's projects
    const [oferte, setOferte] = useState([]) // Offers received from freelancers
    const [angajariEvaluare, setAngajariEvaluare] = useState([]) // Jobs waiting for client review/payment release
    const [angajariFinalizate, setAngajariFinalizate] = useState([]) // Completed and paid jobs

    // --- State: New Project Form ---
    const [titlu, setTitlu] = useState('')
    const [descriere, setDescriere] = useState('')
    const [buget, setBuget] = useState('')
    const [dataLimita, setDataLimita] = useState('')

    // --- State: New Activity Form (Sub-items of a Project) ---
    const [activitati, setActivitati] = useState([]) // Temporary array holding activities before project submission
    const [titluActivitate, setTitluActivitate] = useState('')
    const [descriereActivitate, setDescriereActivitate] = useState('')
    const [nrMaxFreelanceri, setNrMaxFreelanceri] = useState('')
    const [numeCategorie, setNumeCategorie] = useState('')
    const [fisierDocumentatie, setFisierDocumentatie] = useState(null) // Optional documentation file for an activity

    // --- State: Dispute Management ---
    // Object holding dispute reasons, keyed by job ID (idAngajare)
    const [motivDisputa, setMotivDisputa] = useState({})

    // Helper: Returns today's date (YYYY-MM-DD) to prevent selecting past dates in the project deadline input
    const getDataMinima = () => {
        const azi = new Date()
        const an = azi.getFullYear()
        const luna = String(azi.getMonth() + 1).padStart(2, '0')
        const zi = String(azi.getDate()).padStart(2, '0')
        return `${an}-${luna}-${zi}`
    }

    // --- API Fetch Functions ---
    const incarcaProiecte = async () => {
        try {
            const raspuns = await fetch(
                `http://localhost:5129/api/Proiecte/client`,
                { headers: GetAuthHeaders() }
            )
            if (raspuns.ok) {
                const date = await raspuns.json()
                setProiecte(date)
            }
        } catch (eroare) {
            console.error('Eroare la afișarea proiectelor', eroare)
        }
    }

    const incarcaAngajariEvaluare = async () => {
        try {
            const res = await fetch(
                `http://localhost:5129/api/Angajari/client/lucrari?status=In Evaluare`,
                { headers: GetAuthHeaders() }
            )
            if (res.ok) {
                const data = await res.json()
                setAngajariEvaluare(data)
            }
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const incarcaAngajariFinalizate = async () => {
        try {
            const res = await fetch(
                `http://localhost:5129/api/Angajari/client/lucrari?status=Finalizat`,
                { headers: GetAuthHeaders() }
            )
            if (res.ok) {
                const data = await res.json()
                setAngajariFinalizate(data)
            }
        } catch (err) {
            console.error('Eroare:', err)
        }
    }

    const incarcaOferte = async () => {
        try {
            const raspuns = await fetch(
                `http://localhost:5129/api/Oferte/client`,
                { headers: GetAuthHeaders() }
            )
            if (raspuns.ok) {
                const date = await raspuns.json()
                setOferte(date)
            }
        } catch (eroare) {
            console.error('Eroare la aducerea ofertelor', eroare)
        }
    }

    // Fetch all dashboard data when the component mounts
    useEffect(() => {
        incarcaProiecte()
        incarcaOferte()
        incarcaAngajariEvaluare()
        incarcaAngajariFinalizate()
    }, [])

    // --- Form Handlers ---

    // Validates and temporarily stores an activity before the project is submitted
    const handleAdaugaActivitate = (e) => {
        e.preventDefault()
        if (!titluActivitate.trim()) {
            Alerta('warning', 'Atenție', 'Trebuie să dai un titlu activității.')
            return
        }
        if (!descriereActivitate.trim()) {
            Alerta('warning', 'Atenție', 'Trebuie să adaugi o descriere pentru activitate.')
            return
        }
        if (!nrMaxFreelanceri || nrMaxFreelanceri <= 0) {
            Alerta('warning', 'Atenție', 'Trebuie să specifici numărul de freelanceri (minim 1).')
            return
        }
        if (!numeCategorie.trim()) {
            Alerta('warning', 'Atenție', 'Trebuie să introduci o categorie.')
            return
        }
        const contineCifreCategorie = /\d/.test(numeCategorie)
        if (contineCifreCategorie) {
            Alerta('warning', 'Categorie invalidă', 'Numele categoriei nu poate conține cifre.')
            return
        }

        const activitateNoua = {
            NumeCategorie: numeCategorie,
            TitluActivitate: titluActivitate,
            Descriere: descriereActivitate,
            NrMaximFreelanceri: nrMaxFreelanceri ? parseInt(nrMaxFreelanceri) : null,
            fisier: fisierDocumentatie ?? null, // Keep reference to file for later upload
        }
        setActivitati([...activitati, activitateNoua])
        
        // Reset activity form inputs
        setTitluActivitate('')
        setDescriereActivitate('')
        setNrMaxFreelanceri('')
        setNumeCategorie('')
        setFisierDocumentatie(null)
    }

    // Removes an activity from the local array before project submission
    const stergeActivitate = (index) => {
        const noiActivități = activitati.filter((_, i) => i !== index)
        setActivitati(noiActivități)
    }

    // Creates the project and handles sequential file uploads for activities
    const handleAdaugaProiect = async (e) => {
        e.preventDefault()
        // Validate project before submission
        if (activitati.length === 0) {
            Alerta('warning', 'Proiect Gol', 'Trebuie să adaugi cel puțin o activitate la acest proiect!')
            return
        }
        if (proiecte.length > 0) {
            const ultimulProiect = proiecte[0]
            if (ultimulProiect.dataLimita === dataLimita) {
                Alerta('error', 'Dată duplicată', 'Nu poți seta aceeași dată ca proiectul /proiectele trecute')
                return
            }
        }
        const contineCifre = /\d/.test(titlu)
        if (contineCifre) {
            Alerta('warning', 'Titlu invalid', 'Titlul proiectului nu poate conține cifre.')
            return
        }
        const bugetValoare = parseFloat(buget)
        if (bugetValoare <= 0) {
            Alerta('warning', 'Buget invalid', 'Bugetul proiectului trebuie să fie mai mare decât 0.')
            return
        }
        if (dataLimita < getDataMinima()) {
            Alerta('error', 'Dată invalidă', 'Nu poți publica un proiect cu o dată din trecut!')
            return
        }

        const cerere = {
            Titlu: titlu,
            Descriere: descriere,
            Buget: parseFloat(buget),
            DataLimita: dataLimita,
            Activitati: activitati,
        }

        try {
            // 1. Create the project and its JSON activities data
            const response = await fetch('http://localhost:5129/api/Proiecte/adauga', {
                method: 'POST',
                headers: {
                    ...GetAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cerere),
            })
            
            if (response.ok) {
                const data = await response.json()
                
                // 2. Retrieve the new project's ID to upload files correctly
                const proiecteActualizate = await fetch(`http://localhost:5129/api/Proiecte/client`, { headers: GetAuthHeaders() })
                const listaProiecte = await proiecteActualizate.json()
                const idProiectNou = listaProiecte[0].idProiect
                
                // Retrieve the generated IDs for the newly created activities
                const resActivitati = await fetch(`http://localhost:5129/api/Proiecte/${idProiectNou}/activitati-cu-id`, { headers: GetAuthHeaders() })
                const listaActivitati = await resActivitati.json()

                // 3. Loop through activities and upload associated files
                for (let i = 0; i < activitati.length; i++) {
                    if (activitati[i].fisier && listaActivitati[i]) {
                        const formData = new FormData()
                        formData.append('fisier', activitati[i].fisier)

                        // Important: Do NOT set Content-Type manually when using FormData
                        const headersUpload = GetAuthHeaders()
                        delete headersUpload['Content-Type']
                        delete headersUpload['content-type']

                        const responseUpload = await fetch(
                            `http://localhost:5129/api/Proiecte/activitate/${listaActivitati[i].idActivitate}/documentatie`,
                            {
                                method: 'POST',
                                headers: headersUpload,
                                body: formData,
                            }
                        )

                        if (!responseUpload.ok) {
                            const detaliiEroare = await responseUpload.text()
                            console.error(`Upload eșuat pentru activitatea ${listaActivitati[i].idActivitate}:`, detaliiEroare)
                        } else {
                            console.log(`Fișier salvat cu succes pentru activitatea ${listaActivitati[i].idActivitate}!`)
                        }
                    }
                }

                Alerta('success', 'Proiect publicat!', data.mesaj)
                
                // Reset the form and fetch the updated projects
                incarcaProiecte()
                setTitlu('')
                setDescriere('')
                setBuget('')
                setDataLimita('')
                setActivitati([])
            } else {
                const eroare = await response.json()
                Alerta('error', 'Eroare', 'A apărut o problemă: ' + eroare.eroare)
            }
        } catch (error) {
            console.error('Eroare de conexiune', error)
            Alerta('error', 'Eroare de conexiune', 'Nu s-a putut conecta la server')
        }
    }

    // Deletes a project completely
    const handleStergeProiect = async (idProiect) => {
        const rezultat = await Swal.fire({
            title: 'Ești sigur ?',
            text: 'Vrei să ștergi acest proiect?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Da, șterge',
            cancelButtonText: 'Anulează',
        })
        if (!rezultat.isConfirmed) return

        try {
            const response = await fetch(`http://localhost:5129/api/Proiecte/${idProiect}`, {
                method: 'DELETE',
                headers: GetAuthHeaders(),
            })
            if (response.ok) {
                Alerta('success', 'Șters', 'Proiect șters cu succes!')
                setProiecte(proiecte.filter((p) => p.idProiect !== idProiect))
            } else {
                const errorData = await response.json()
                Alerta('error', 'Eroare', 'Eroare la ștergere: ' + errorData.mesaj)
            }
        } catch (error) {
            console.error('Eroare:', error)
            Alerta('error', 'Eroare de conexiune', 'A apărut o eroare la conexiunea cu serverul.')
        }
    }

    // Accepts an offer using a successfully authorized PayPal token (authId).
    // This establishes the formal Job ("Angajare") in the system.
    const handleAcceptaOferta = async (idOferta, authId) => {
        try {
            const response = await fetch(`http://localhost:5129/api/Oferte/accepta/${idOferta}`, {
                method: 'POST',
                headers: {
                    ...GetAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ authorizationId: authId }),
            })
            const data = await response.json()
            if (response.ok) {
                Alerta(
                    'success',
                    'Angajare creată.',
                    'Tranzacția s-a realizat cu succes (banii vor fi blocați până la finalul procesului).' + data.mesaj
                )
                incarcaOferte()
                incarcaAngajariEvaluare()
            } else {
                Alerta('error', 'Eroare', data.eroare || data.mesaj)
            }
        } catch (error) {
            Alerta('error', 'Eroare de conexiune', 'Nu m-am putut conecta la server ')
        }
    }

    // Declines a received offer
    const handleRespingeOferta = async (idOferta) => {
        const rezultat = await Swal.fire({
            title: 'Ești sigur ?',
            text: 'Vrei să respingi aceaastă ofertă ?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Da, respinge',
            cancelButtonText: 'Anulează',
        })
        if (!rezultat.isConfirmed) return

        try {
            const response = await fetch(`http://localhost:5129/api/Oferte/respinge/${idOferta}`, {
                method: 'POST',
                headers: GetAuthHeaders(),
            })
            const data = await response.json()
            if (response.ok) {
                Alerta('info', 'Ofertă Respinsă', data.mesaj)
                incarcaOferte()
            } else {
                Alerta('error', 'Eroare', data.eroare || data.mesaj)
            }
        } catch (error) {
            Alerta('error', 'Eroare de conexiune', 'Conexiune la server eșuată.')
        }
    }

    // Approves the submitted work and finalizes the payment capture process on the backend
    const handleElibereazaPlata = async (idAngajare) => {
        const result = await Swal.fire({
            title: 'Eliberare plată',
            text: 'Confirmi că munca a fost realizată și eliberezi plata către freelancer ?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Da, eliberează plata',
            cancelButtonText: 'Anulează',
        })
        if (!result.isConfirmed) return

        Swal.fire({
            title: 'Se procesează',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        })

        try {
            const res = await fetch(`http://localhost:5129/api/Angajari/${idAngajare}/elibereaza-plata`, {
                method: 'POST',
                headers: GetAuthHeaders(),
            })
            const data = await res.json()
            if (res.ok) {
                Swal.fire('Succes.', data.mesaj, 'success')
                incarcaAngajariEvaluare()
                incarcaAngajariFinalizate()
            } else {
                Swal.fire('Eroare', data.eroare, 'error')
            }
        } catch (err) {
            Swal.fire('Eroare de conexiune', 'Nu s-a putut conecta la server.', 'error')
        }
    }

    // Rejects the submitted work and sends it to a Legal Expert for resolution
    const handleLanseazaDisputa = async (idAngajare) => {
        const motiv = motivDisputa[idAngajare]
        if (!motiv || motiv.trim() === '') {
            Alerta('warning', 'Atenție', 'Trebuie să introduci motivul disputei.')
            return
        }
        const result = await Swal.fire({
            title: 'Lansează dispută?',
            text: 'Cazul va fi trimis expertului legal pentru analiză.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Da, lansează disputa',
            cancelButtonText: 'Anulează',
        })
        if (!result.isConfirmed) return

        try {
            const res = await fetch(`http://localhost:5129/api/Angajari/${idAngajare}/disputa`, {
                method: 'POST',
                headers: {
                    ...GetAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ motiv: motiv }),
            })
            const data = await res.json()
            if (res.ok) {
                Swal.fire('Dispută trimisă.', data.mesaj, 'success')
                setMotivDisputa({ ...motivDisputa, [idAngajare]: '' }) // Clear the text area
                incarcaAngajariEvaluare()
            } else {
                Swal.fire('Eroare', data.eroare, 'error')
            }
        } catch (err) {
            Swal.fire('Eroare de conexiune', 'Nu s-a putut conecta la server.', 'error')
        }
    }

    // Downloads the PDF invoice for a completed job
    const handleDescarcaFactura = async (idAngajare) => {
        try {
            const res = await fetch(`http://localhost:5129/api/Factura/${idAngajare}/descarca`, {
                method: 'GET',
                headers: GetAuthHeaders(),
            })
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Factura_${idAngajare}.pdf`
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } else {
                const data = await res.json()
                Alerta('error', 'Eroare', 'Nu s-a putut descărca factura: ' + (data.eroare || ''))
            }
        } catch (err) {
            console.error('Eroare rețea:', err)
            Alerta('error', 'Eroare de conexiune', 'A apărut o problemă la descărcare.')
        }
    }

    const proiecteActive = proiecte.filter((p) => p.status === 'Activ')

    return (
        // PayPal Initialization wrapper. We use 'authorize' intent to lock funds, not capture them immediately.
        <PayPalScriptProvider
            options={{
                'client-id': 'AWgucYdPmriY2Q5Arkz3YctQjOen2aCiqTh2ovRSInyjaFwjY953PWJ27C-QoZf_KU-JLKEN2dJ6UxkC',
                currency: 'EUR',
                intent: 'authorize',
            }}
        >
            <div className="panou-client-container">
                <h3 className="panou-client-titlu"> Panou Client </h3>
                
                {/* --- SECTION 1: ADD NEW PROJECT --- */}
                <p> Adaugă un proiect nou pentru a găsi freelancerul potrivit. </p>
                <form
                    onSubmit={handleAdaugaProiect}
                    className="form-adaugare-proiect"
                >
                    <label className="form-label">
                        Titlu proiect: <span className="required"> * </span>
                        <input
                            className="form-input"
                            type="text"
                            value={titlu}
                            onChange={(e) => setTitlu(e.target.value)}
                            required
                            onInvalid={(e) =>
                                e.target.setCustomValidity(
                                    'Te rog completează acest câmp !'
                                )
                            }
                            onInput={(e) => e.target.setCustomValidity('')}
                        />
                    </label>
                    <label className="form-label">
                        Descriere: <span className="required"> * </span>
                        <textarea
                            className="form-textarea"
                            value={descriere}
                            onChange={(e) => setDescriere(e.target.value)}
                            rows="4"
                        />
                    </label>
                    <label className="form-label">
                        Buget (EURO): <span className="required"> * </span>
                        <input
                            className="form-input"
                            type="number"
                            value={buget}
                            onChange={(e) => setBuget(e.target.value)}
                            min="1"
                            onInvalid={(e) => {
                                if (!e.target.value) {
                                    e.target.setCustomValidity(
                                        'Te rog completează acest câmp !'
                                    )
                                } else {
                                    e.target.setCustomValidity(
                                        'Valoare trebuie să fie mai mare sau egală cu 1.'
                                    )
                                }
                            }}
                            onInput={(e) => e.target.setCustomValidity('')}
                        />
                    </label>
                    <label className="form-label">
                        Data limită: <span className="required"> * </span>
                        <input
                            className="form-input"
                            type="date"
                            value={dataLimita}
                            onChange={(e) => setDataLimita(e.target.value)}
                            min={getDataMinima()}
                            required
                        />
                    </label>

                    {/* Nested form for Activities within the Project */}
                    <div className="form-activități">
                        <h4 className="form-activitati-titlu">
                            {' '}
                            Adaugă activitați{' '}
                        </h4>
                        <div className="form-activitate">
                            <label className="form-label">
                                Titlu activitate:{' '}
                                <span className="required"> * </span>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={titluActivitate}
                                    onChange={(e) =>
                                        setTitluActivitate(e.target.value)
                                    }
                                ></input>
                            </label>
                            <label className="form-label">
                                Descriere: <span className="required"> * </span>
                                <textarea
                                    className="form-textarea"
                                    value={descriereActivitate}
                                    onChange={(e) =>
                                        setDescriereActivitate(e.target.value)
                                    }
                                    rows="2"
                                ></textarea>
                            </label>
                            <div className="form-activitate-rand">
                                <label className="form-label">
                                    Număr freelanceri:{' '}
                                    <span className="required"> * </span>
                                    <input
                                        className="form-input"
                                        type="number"
                                        value={nrMaxFreelanceri}
                                        onChange={(e) =>
                                            setNrMaxFreelanceri(e.target.value)
                                        }
                                        min="1"
                                        onInvalid={(e) =>
                                            e.target.setCustomValidity(
                                                'Valoarea trebuie să fie mai mare sau egală cu 1.'
                                            )
                                        }
                                        onInput={(e) =>
                                            e.target.setCustomValidity('')
                                        }
                                    />
                                </label>
                                <label className="form-label">
                                    Categorie:{' '}
                                    <span className="required"> * </span>
                                    <input
                                        className="form-input"
                                        type="text"
                                        value={numeCategorie}
                                        onChange={(e) =>
                                            setNumeCategorie(e.target.value)
                                        }
                                    />
                                </label>
                            </div>
                            <label className="form-label">
                                Documentație
                                <input
                                    className="form-input"
                                    type="file"
                                    accept=".pdf,.doc,.docx,.jpg,.png"
                                    onChange={(e) =>
                                        setFisierDocumentatie(e.target.files[0])
                                    }
                                />
                            </label>
                            <button
                                type="button"
                                onClick={handleAdaugaActivitate}
                                className="btn-adauga-activitate"
                            >
                                Adaugă Activitate
                            </button>
                        </div>

                        {/* Preview created activities before creating the whole project */}
                        {activitati.length > 0 && (
                            <div className="lista-activitati-adaugate">
                                <h5 className="form-activitati-titlu">
                                    {' '}
                                    Actvități adăugate ({activitati.length}):
                                </h5>
                                <ul className="lista-activitati-ul">
                                    {activitati.map((act, index) => (
                                        <li
                                            className="activitate-item"
                                            key={index}
                                        >
                                            <strong>
                                                {' '}
                                                {act.TitluActivitate}
                                            </strong>{' '}
                                            <br />
                                            <small> {act.Descriere}</small>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    stergeActivitate(index)
                                                }
                                                className="btn-sterge-activitate"
                                            >
                                                [Șterge]
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <button type="submit" className="btn-trimite">
                        Publică Proiectul
                    </button>
                </form>

                {/* --- SECTION 2: JOBS IN EVALUATION (Awaiting Client Review) --- */}
                <h4 className="panou-sectiune-titlu">
                    {' '}
                    Lucrări în evaluare ({angajariEvaluare.length})
                </h4>
                {angajariEvaluare.length === 0 ? (
                    <div className="sectiune-goala">
                        <p> Nu există lucrări care așteaptă evaluare.</p>
                    </div>
                ) : (
                    <ul className="lista-evaluare">
                        {angajariEvaluare.map((ang) => (
                            <li className="card-evaluare" key={ang.idAngajare}>
                                <h4 className="card-titlu"> {ang.titlu}</h4>
                                <p> {ang.descriere}</p>
                                <p>
                                    {' '}
                                    <strong> Suma blocată: </strong> {ang.suma}{' '}
                                    EUR
                                </p>
                                <p>
                                    {' '}
                                    <strong> Livrabil: </strong>{' '}
                                    <a
                                        href={ang.link}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {' '}
                                        {ang.link}
                                    </a>
                                </p>
                                <p>
                                    {' '}
                                    <strong> Data angajării:</strong>{' '}
                                    {new Date(
                                        ang.dataAngajarii
                                    ).toLocaleDateString('ro-RO')}
                                </p>
                                <button
                                    className="btn-elibereaza"
                                    onClick={() =>
                                        handleElibereazaPlata(ang.idAngajare)
                                    }
                                >
                                    Eliberează Plata
                                </button>
                                
                                {/* Dispute Form attached to the job */}
                                <div className="disputa-container">
                                    <textarea
                                        className="disputa-textarea"
                                        placeholder="Motivul disputei"
                                        value={
                                            motivDisputa[ang.idAngajare] || ''
                                        }
                                        onChange={(e) =>
                                            setMotivDisputa({
                                                ...motivDisputa,
                                                [ang.idAngajare]:
                                                    e.target.value,
                                            })
                                        }
                                        rows={2}
                                    />
                                    <button
                                        className="btn-disputa"
                                        onClick={() =>
                                            handleLanseazaDisputa(
                                                ang.idAngajare
                                            )
                                        }
                                    >
                                        Lansează disputa
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* --- SECTION 3: COMPLETED JOBS --- */}
                <h4 className="panou-sectiune-titlu">
                    {' '}
                    Lucrări finalizate ({angajariFinalizate.length})
                </h4>
                {angajariFinalizate.length === 0 ? (
                    <div className="sectiune-goala">
                        <p> Nu există lucrări finalizate.</p>
                    </div>
                ) : (
                    <ul className="lista-finalizate">
                        {angajariFinalizate.map((ang) => (
                            <li className="card-finalizat" key={ang.idAngajare}>
                                <h4 className="card-titlu"> {ang.titlu}</h4>
                                <p>
                                    <strong>Freelancer:</strong>{' '}
                                    {ang.numeFreelancer}
                                </p>
                                <p>
                                    <strong> Proiect: </strong>{' '}
                                    {ang.titluProiect}
                                </p>
                                <p>
                                    <strong> Sumă plătită:</strong> {ang.suma}{' '}
                                    EUR{' '}
                                </p>
                                <p>
                                    <strong> Data: </strong>{' '}
                                    {new Date(
                                        ang.dataAngajarii
                                    ).toLocaleDateString('ro-RO')}
                                </p>
                                <button
                                    className="btn-recenzie"
                                    onClick={() =>
                                        handleDescarcaFactura(ang.idAngajare)
                                    }
                                >
                                    Descarcă factură
                                </button>
                                <button
                                    className="btn-recenzie"
                                    onClick={() =>
                                        handleAdaugaRecenzie(
                                            ang.idAngajare,
                                            'Client'
                                        )
                                    }
                                >
                                    Scrie o recenzie
                                </button>
                                <button
                                    className="btn-recenzie"
                                    onClick={() =>
                                        navigate(
                                            `/profil-freelancer/${ang.idFreelancer}`
                                        )
                                    }
                                >
                                    Vezi profil
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {/* --- SECTION 4: OFFERS RECEIVED --- */}
                <h4 className="panou-sectiune-titlu">
                    {' '}
                    Oferte Primite ({oferte.length}){' '}
                </h4>
                {oferte.length === 0 ? (
                    <div className="sectiune-goala">
                        <p> Nu ai primit nicio ofertă momentan.</p>
                    </div>
                ) : (
                    <ul className="lista-oferte">
                        {oferte.map((oferta) => (
                            <li className="card-oferta" key={oferta.idOferta}>
                                <h4 className="card-titlu">
                                    {' '}
                                    Ofertă de la {oferta.numeFreelancer}
                                </h4>
                                <p>
                                    <strong> Activitate: </strong>{' '}
                                    {oferta.titluActivitate}
                                </p>
                                <p>{oferta.mesaj}</p>
                                <div>
                                    {/* PayPal integration for accepting offers.
                                        createOrder: Calls our backend to create a PayPal intent.
                                        onApprove: Calls our backend to complete authorization and create Job. */}
                                    <PayPalButtons
                                        key={oferta.idOferta}
                                        createOrder={async () => {
                                            const response = await fetch(
                                                'http://localhost:5129/api/Plati/CreeazaComanda',
                                                {
                                                    method: 'POST',
                                                    headers: {
                                                        ...GetAuthHeaders(),
                                                        'Content-Type':
                                                            'application/json',
                                                    },
                                                    body: JSON.stringify({
                                                        pret: oferta.pret,
                                                        descriere:
                                                            oferta.titluActivitate,
                                                        idOferta:
                                                            oferta.idOferta,
                                                    }),
                                                }
                                            )
                                            const data = await response.json()
                                            if (!data.id) {
                                                throw new Error(
                                                    'Backend-ul nu a returnat un ID valid'
                                                )
                                            }
                                            return data.id
                                        }}
                                        onApprove={async (data) => {
                                            try {
                                                const response = await fetch(
                                                    'http://localhost:5129/api/Plati/FinalizeazaComanda',
                                                    {
                                                        method: 'POST',
                                                        headers: {
                                                            ...GetAuthHeaders(),
                                                            'Content-Type':
                                                                'application/json',
                                                        },
                                                        body: JSON.stringify({
                                                            orderID:
                                                                data.orderID,
                                                            idOferta:
                                                                oferta.idOferta,
                                                        }),
                                                    }
                                                )
                                                const result =
                                                    await response.json()
                                                if (
                                                    response.ok &&
                                                    result.authorizationId
                                                ) {
                                                    await handleAcceptaOferta(
                                                        oferta.idOferta,
                                                        result.authorizationId
                                                    )
                                                } else {
                                                    throw new Error(
                                                        result.mesaj ||
                                                            'Eroare la procesarea pe server.'
                                                    )
                                                }
                                            } catch (error) {
                                                console.error(
                                                    'Eroare Server:',
                                                    error
                                                )
                                                Swal.fire(
                                                    'Eroare',
                                                    'Plata a eșuat datorită comunicării cu serverul.',
                                                    'error'
                                                )
                                            }
                                        }}
                                    />

                                    <button
                                        className="btn-respinge-oferta"
                                        onClick={() =>
                                            handleRespingeOferta(
                                                oferta.idOferta
                                            )
                                        }
                                    >
                                        Respinge Ofertă
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* --- SECTION 5: ACTIVE PROJECTS --- */}
                <h4 className="panou-sectiune-titlu">
                    {' '}
                    Proiectele mele active ({proiecteActive.length}){' '}
                </h4>
                {proiecteActive.length === 0 ? (
                    <div className="sectiune-goala">
                        <p> Nu ai adăugat niciun proiect încă</p>
                    </div>
                ) : (
                    <ul className="lista-proiecte">
                        {proiecteActive.map((proiect) => (
                            <li
                                className="card-proiect"
                                key={proiect.idProiect}
                            >
                                <h5 className="card-titlu">
                                    {' '}
                                    {proiect.titlu}{' '}
                                </h5>
                                <p> {proiect.descriere}</p>
                                <p> Buget: {proiect.buget} EURO </p>
                                <p> Data Limită: {proiect.dataLimita}</p>
                                <p> Status: {proiect.status}</p>
                                <button
                                    className="btn-sterge-proiect"
                                    onClick={() =>
                                        handleStergeProiect(proiect.idProiect)
                                    }
                                >
                                    Șterge Proiect
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </PayPalScriptProvider>
    )
}